# BACKUP-RESTORE.md

Since Postgres is self-hosted on the VM (see `DEPLOYMENT_DECISIONS.md` #1), backups
are entirely our responsibility — no managed-provider safety net.

## How backups work

The `pg_backup` service (`infra/backup.sh`) runs continuously inside a
lightweight `postgres:16-alpine` container:
- `pg_dump` to a custom-format dump, once every 24 hours
- Written to the named volume `backup_data`, mounted at `/backups` inside
  the container
- 7-day local retention — anything older is deleted automatically

**Known gap:** backups currently live only on the same VM as the database
they protect. If the VM's boot volume is lost entirely, backups are lost
with it. Uploading to Oracle Object Storage (EU) is the documented
next step — not yet implemented, to avoid the added complexity of OCI
API key auth during initial deployment.

## Checking backups exist

```bash
docker compose -f docker-compose.prod.yml exec pg_backup ls -la /backups
```

## Manually triggering a backup (don't wait for the 24h cycle)

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U prod -d automation_prod -F c -f /tmp/manual_backup.dump
docker compose -f docker-compose.prod.yml cp postgres:/tmp/manual_backup.dump ./manual_backup.dump
```

## Restoring from a backup

**Stop fastapi first** (avoid writes during restore):
```bash
docker compose -f docker-compose.prod.yml stop fastapi
```

Copy the desired dump file into the postgres container, then restore:
```bash
docker compose -f docker-compose.prod.yml cp ./backup_YYYY-MM-DD_HHMMSS.dump postgres:/tmp/restore.dump
docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U prod -d automation_prod --clean --if-exists /tmp/restore.dump
```

Restart fastapi:
```bash
docker compose -f docker-compose.prod.yml start fastapi
```

## Getting a copy off the VM (manual, until Object Storage upload exists)

```bash
scp ubuntu@130.61.157.106:/var/lib/docker/volumes/infra_backup_data/_data/backup_*.dump ./local-backups/
```
(Path assumes Docker's default volume storage location — confirm with
`docker volume inspect infra_backup_data` if it's ever moved.)

## Recovery time expectation

For a database of this current scale (portfolio project, low data volume),
a full restore should complete in under a minute. This has not yet been
tested end-to-end with a full VM loss scenario — recommended as a chaos
test (see `CHAOS-TESTING.md`).