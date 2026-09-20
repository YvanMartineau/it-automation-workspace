# BACKUP-WIEDERHERSTELLUNG.md

Da Postgres auf der VM selbst gehostet wird (siehe `DEPLOYMENT_DECISIONS.md` Nr. 1), sind Backups
vollständig unsere Verantwortung — kein Sicherheitsnetz eines Managed-Providers.

## Wie Backups funktionieren

Der Dienst `pg_backup` (`infra/backup.sh`) läuft dauerhaft in einem
leichtgewichtigen `postgres:16-alpine`-Container:
- `pg_dump` in ein Custom-Format-Dump, einmal alle 24 Stunden
- Geschrieben in das benannte Volume `backup_data`, eingebunden unter `/backups` im
  Container
- 7-tägige lokale Aufbewahrung — alles Ältere wird automatisch gelöscht

**Bekannte Lücke:** Backups liegen derzeit nur auf derselben VM wie die Datenbank,
die sie schützen. Wenn das Boot-Volume der VM komplett verloren geht, gehen die
Backups mit verloren. Der Upload in den Oracle Object Storage (EU) ist der dokumentierte
nächste Schritt — noch nicht umgesetzt, um die zusätzliche Komplexität der OCI-
API-Key-Authentifizierung während des ersten Deployments zu vermeiden.

## Prüfen, dass Backups existieren

```bash
docker compose -f docker-compose.prod.yml exec pg_backup ls -la /backups
```

## Ein Backup manuell auslösen (nicht auf den 24h-Zyklus warten)

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U prod -d automation_prod -F c -f /tmp/manual_backup.dump
docker compose -f docker-compose.prod.yml cp postgres:/tmp/manual_backup.dump ./manual_backup.dump
```

## Aus einem Backup wiederherstellen

**Zuerst fastapi stoppen** (Schreibzugriffe während der Wiederherstellung vermeiden):
```bash
docker compose -f docker-compose.prod.yml stop fastapi
```

Kopiere die gewünschte Dump-Datei in den postgres-Container, stelle dann wieder her:
```bash
docker compose -f docker-compose.prod.yml cp ./backup_YYYY-MM-DD_HHMMSS.dump postgres:/tmp/restore.dump
docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U prod -d automation_prod --clean --if-exists /tmp/restore.dump
```

fastapi neu starten:
```bash
docker compose -f docker-compose.prod.yml start fastapi
```

## Eine Kopie von der VM holen (manuell, bis Object-Storage-Upload existiert)

```bash
scp ubuntu@130.61.157.106:/var/lib/docker/volumes/infra_backup_data/_data/backup_*.dump ./local-backups/
```
(Der Pfad geht von Dockers Standard-Speicherort für Volumes aus — bestätige mit
`docker volume inspect infra_backup_data`, falls er je verschoben wird.)

## Erwartung zur Wiederherstellungszeit

Für eine Datenbank dieses aktuellen Ausmaßes (Portfolio-Projekt, geringes Datenvolumen)
sollte eine vollständige Wiederherstellung in unter einer Minute abgeschlossen sein. Das wurde
noch nicht End-zu-Ende mit einem vollständigen VM-Verlust-Szenario getestet — empfohlen als
Chaos-Test (siehe `CHAOS-TESTING.md`).
