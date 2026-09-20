# BETRIEBSANLEITUNG.md — Täglicher Betrieb

## Dienstkarte

| Dienst | Erreichbar | Anmerkungen |
|---|---|---|
| fastapi | nur über nginx (`/api/`), kein veröffentlichter Port | Healthcheck: `/health` |
| postgres | nur intern, kein veröffentlichter Port | Healthcheck: `pg_isready` |
| n8n | `127.0.0.1:5678` nur auf der VM | SSH-Tunnel für die Oberfläche, siehe unten |
| openldap | nur intern | kein veröffentlichter Port |
| lam (LDAP-Admin-Oberfläche) | `127.0.0.1:8080` nur auf der VM | SSH-Tunnel, `--profile tools` |
| nginx | `80`/`443` öffentlich | TLS über Let's Encrypt |
| pg_backup | intern, keine Ports | tägliches `pg_dump`, siehe `BACKUP-WIEDERHERSTELLUNG.md` |

## Häufige Befehle

Alle werden aus `/opt/it-automation/app/infra/` ausgeführt.

```bash
docker compose -f docker-compose.prod.yml ps                    # Status
docker compose -f docker-compose.prod.yml logs -f fastapi        # Logs verfolgen
docker compose -f docker-compose.prod.yml restart fastapi        # einen Dienst neu starten
docker compose -f docker-compose.prod.yml up -d --build fastapi  # einen Dienst nach einer Code-Änderung neu bauen und einsetzen
```

## Eine Code-Änderung einsetzen

```bash
cd /opt/it-automation/app
git pull
cd infra
docker compose -f docker-compose.prod.yml build fastapi   # nur wenn backend/ geändert wurde
docker compose -f docker-compose.prod.yml up -d
```
Änderungen an `nginx.conf` brauchen keinen Neubau — die Datei ist als Live-Volume eingebunden, `up -d` übernimmt die neue Datei. Frontend-Änderungen erfolgen separat und werden direkt über Cloudflare Pages eingesetzt.

## Die n8n-Oberfläche erreichen

```bash
ssh -i ~/.ssh/oracle_it_automation.key -L 5678:localhost:5678 ubuntu@130.61.157.106
```
Dieses Terminal offen lassen, dann im Browser `http://localhost:5678` öffnen. n8n hat derzeit keine eingebaute Authentifizierung — siehe `ENTSCHEIDUNGEN.md` Nr. 6.

## Den LDAP Account Manager (LAM) erreichen

```bash
ssh -i ~/.ssh/oracle_it_automation.key -L 8080:localhost:8080 ubuntu@130.61.157.106
docker compose -f docker-compose.prod.yml --profile tools up -d lam   # falls noch nicht läuft
```
Im Browser `http://localhost:8080` öffnen.

## Die Zertifikatserneuerung prüfen

```bash
sudo systemctl status certbot.timer
sudo certbot certificates
```
Bestätigt das Ablaufdatum und dass die Erneuerungs-Hooks (Stop/Start nginx) existieren:
```bash
ls /etc/letsencrypt/renewal-hooks/pre/ /etc/letsencrypt/renewal-hooks/post/
```

## Den WireGuard-Tunnel prüfen (nötig für das Live-Gerätescanning)

**Auf der VM:**
```bash
sudo wg show
ping 192.168.179.1   # oder ein beliebiges bekanntes Gerät im Heimnetz
```
**Auf dem Laptop:** Stelle sicher, dass er im Haupt-WLAN ist (nicht im Gast-WLAN mit Isolierung),
und dass der Tunnel aktiv ist: `sudo wg show`. Wenn eine Seite keinen aktuellen Handshake zeigt, ist der Laptop wahrscheinlich im Schlafmodus oder nicht im Netzwerk — das ist die bekannte, dokumentierte Verfügbarkeitsbeschränkung (`ENTSCHEIDUNGEN.md` Nr. 3), kein Fehler, dem man nachjagen muss.

**Erwartete Daten bei einem erfolgreichen Remote-Scan:** Geräte werden entdeckt (IP, offene Ports, Erreichbarkeit, bestmögliche Vermutung zum Betriebssystem mit angezeigter Konfidenz), aber MAC-Adresse und CPU/RAM erscheinen nie bei einem Gerät im Heimnetz — bestätigte, dauerhafte Grenzen dieser Topologie, keine Anzeichen eines defekten Tunnels. Siehe `ENTSCHEIDUNGEN.md` Nr. 11 für den genauen Mechanismus, falls das in einer Demo/einem Gespräch zur Sprache kommt.

## DuckDNS-Updater

Cron-Eintrag (`crontab -e` auf der VM), läuft alle 5 Minuten:
```
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```
Prüfe `~/duckdns/duck.log` — sollte `OK` anzeigen. `KO` bedeutet Token/Subdomain stimmen in `~/duckdns/duck.sh` nicht überein.

## Ein Geheimnis rotieren (z. B. JWT_SECRET_KEY, POSTGRES_PASSWORD)

1. Neuen Wert erzeugen, `/opt/it-automation/.env` bearbeiten
2. `docker compose -f docker-compose.prod.yml up -d` (erstellt jeden Dienst neu, dessen Env sich geändert hat)
3. Hinweis: Das Rotieren von `JWT_SECRET_KEY` macht alle bestehenden Sitzungen ungültig —
   jeder Benutzer muss sich erneut anmelden. Das Rotieren von `POSTGRES_PASSWORD` erfordert
   zusätzlich die Aktualisierung innerhalb von Postgres selbst
   (`ALTER USER prod WITH PASSWORD '...'`), da Postgres `.env` nach der ersten Initialisierung nicht mehr liest — die Compose-Umgebungsvariable wirkt nur bei der Erstinitialisierung oder einem frischen Volume.
