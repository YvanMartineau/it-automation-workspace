# ZURUECKROLLEN.md

## Ein fehlerhaftes Code-Deployment zurückrollen

```bash
cd /opt/it-automation/app
git log --oneline -10          # finde den letzten bekannten guten Commit
git checkout <guter_commit_hash>
cd infra
docker compose -f docker-compose.prod.yml build fastapi
docker compose -f docker-compose.prod.yml up -d
```

Um später wieder auf den aktuellen Stand des Branches zu wechseln (sobald ein echter Fix gepusht wurde):
```bash
git checkout main
git pull
```

**Wichtig — Datenbank-Migrationen laufen nicht automatisch rückwärts.** Wenn das fehlerhafte Deployment eine Alembic-Migration enthielt, die schon ausgeführt wurde, macht das Auschecken des älteren Codes die Schema-Änderung *nicht* rückgängig. Prüfe `alembic history` und überlege, ob `alembic downgrade <revision>` sicher ist, bevor du annimmst, dass ein reines Code-Rollback ausreicht — das ist es normalerweise nicht, wenn eine Migration beteiligt war.

## Ein fehlerhaftes `docker-compose.prod.yml` oder `nginx.conf` zurückrollen

Gleicher Mechanismus — das sind nur Dateien im selben Repository:
```bash
git log --oneline -- infra/docker-compose.prod.yml
git checkout <guter_commit_hash> -- infra/docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d
```

## Ein fehlerhaftes `.env` zurückrollen

`.env` liegt nicht in Git (absichtlich, siehe `HAERTUNG.md`) — es gibt keine automatische Historie. Bewahre manuell eine Kopie mit Datum, bevor du riskante Änderungen machst:
```bash
cp /opt/it-automation/.env /opt/it-automation/.env.bak-$(date +%Y%m%d)
```
Wenn eine Änderung etwas kaputt macht, stelle das Backup wieder her und führe `docker compose up -d` aus, um es anzuwenden.

## Vollständiges Datenbank-Rollback

Siehe `BACKUP-WIEDERHERSTELLUNG.md` — stelle aus dem letzten `pg_dump` vor der fehlerhaften Änderung wieder her. Akzeptiere bis zu 24 Stunden Datenverlust (das Backup-Intervall), es sei denn, vorher wurde ein manuelles Backup erstellt.

## Im Zweifelsfall: lokaler Fallback

Wenn ein Cloud-Rollback nicht einfach ist oder zu lange dauert, ist der lokale Docker-Compose-Stack (`docker-compose.yml`, nicht `.prod.yml`) von allem, was auf der VM passiert, unberührt — siehe `FAILOVER.md`. Wenn das Frontend auf lokal zeigt, gewinnst du Zeit, um das Cloud-Deployment zu reparieren, ohne Ausfallzeit für die Nutzer (bei einem Solo-Portfolio-Projekt bedeutet „nutzerseitig" meist die Kontinuität der Demo).
