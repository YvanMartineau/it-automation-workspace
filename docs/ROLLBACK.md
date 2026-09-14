# ROLLBACK.md

## Rolling back a bad code deploy

```bash
cd /opt/it-automation/app
git log --oneline -10          # find the last known-good commit
git checkout <good_commit_hash>
cd infra
docker compose -f docker-compose.prod.yml build fastapi
docker compose -f docker-compose.prod.yml up -d
```

To get back onto the branch tip later (once a real fix is pushed):
```bash
git checkout main
git pull
```

**Caveat — database migrations don't auto-reverse.** If the bad deploy
included an Alembic migration that already ran, checking out older code
does *not* undo the schema change. Check `alembic history` and consider
whether `alembic downgrade <revision>` is safe before assuming a code
rollback alone is sufficient — it usually isn't if a migration was
involved.

## Rolling back a bad `docker-compose.prod.yml` or `nginx.conf` change

Same mechanism — these are just files in the same repo:
```bash
git log --oneline -- infra/docker-compose.prod.yml
git checkout <good_commit_hash> -- infra/docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d
```

## Rolling back a bad `.env` change

`.env` isn't in git (by design, see `HARDENING.md`) — no automatic
history. Manually keep a dated copy before making risky changes:
```bash
cp /opt/it-automation/.env /opt/it-automation/.env.bak-$(date +%Y%m%d)
```
If a change breaks something, restore the backup and `docker compose up -d`
to apply it.

## Full database rollback

See `BACKUP-RESTORE.md` — restore from the most recent `pg_dump` prior to
the bad change. Accept up to 24h of data loss (the backup interval)
unless a manual backup was taken first.

## When in doubt: local fallback

If a cloud rollback isn't straightforward or is taking too long, the
local Docker Compose stack (`docker-compose.yml`, not `.prod.yml`) is
unaffected by anything happening on the VM — see `FAILOVER.md`. Switching
the frontend to point locally buys time to fix the cloud deployment
without user-facing downtime (for a solo portfolio project, "user-facing"
mostly means demo continuity).