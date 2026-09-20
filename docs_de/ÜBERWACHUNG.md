# ÜBERWACHUNG.md

## Was heute existiert

**Docker-Healthchecks** (selbstheilend, keine Alarmierung):
- `fastapi`: `GET /health` alle 10s, 12 Wiederholungen, 15s Startperiode
- `postgres`: `pg_isready` alle 5s, 5 Wiederholungen

Diese steuern die `restart: always`-Wiederherstellung und die Reihenfolge über `depends_on: condition: service_healthy`. Sie halten die Dienste am Laufen, aber nichts außerhalb der VM wird benachrichtigt, wenn sie ausgelöst werden.

**Log-Rotation** (alle Dienste): `json-file`-Treiber, `max-size: 10m`, `max-file: 3` (5m/2 für leichtere Dienste) — verhindert, dass die Festplatte durch unkontrollierte Logs voll läuft, meldet aber nichts proaktiv.

**Certbot** (`systemd`, nicht Docker): `certbot.timer` läuft zweimal täglich und prüft/erneuert Zertifikate innerhalb von 30 Tagen vor Ablauf.

**DuckDNS-Updater** (`cron`, alle 5 Min.): Hält den DNS auf die IP der VM gerichtet; protokolliert in `~/duckdns/duck.log`, wird aber nicht aktiv überwacht.

## Was NICHT existiert (ehrliche Liste der Lücken)

- **Keine externe Überwachung der Verfügbarkeit (Uptime).** Nichts warnt, wenn `christian-it-automation.duckdns.org` nicht erreichbar ist, wenn TLS unerwartet abläuft oder wenn die VM selbst ausfällt. Ein kostenloser Tarif von UptimeRobot, Better Stack oder Ähnlichem (prüft `/health` alle paar Minuten) würde diese Lücke für 0 € schließen — empfohlener nächster Schritt, aber noch nicht umgesetzt.
- **Keine Alarmierung bei Container-Neustarts.** Wenn `fastapi` in einer Schleife abstürzt, startet Docker es stillschweigend immer wieder neu — niemand wird informiert.
- **Kein Healthcheck für den WireGuard-Tunnel.** Es gibt keine automatisierte Möglichkeit zu wissen, dass der Pfad über das Laptop-Gateway unten ist, außer dass man bemerkt, dass Scan-Ergebnisse leer sind.
- **Keine Überwachung des Festplattenspeichers** auf der VM selbst (Boot-Volume, Docker-Volumes, Ansammlung von Backups).
- **Keine Log-Aggregation.** Logs leben nur in der eigenen `json-file`-Rotation jedes Containers — um etwas zu prüfen, muss man sich per SSH einloggen und `docker compose logs` ausführen.

## Manuelle Healthcheck-Befehle (bis echtes Monitoring existiert)

    curl -s https://christian-it-automation.duckdns.org/health
    docker compose -f docker-compose.prod.yml ps
    df -h                                    # Festplattenspeicher
    sudo wg show                             # Tunnel-Status
    docker compose -f docker-compose.prod.yml exec pg_backup ls -la /backups

## Empfohlene nächste Schritte (noch nicht gebaut, geordnet nach Aufwand/Nutzen)

1. Kostenloser externer Uptime-Monitor, der `/health` aufruft — geringster Aufwand, größte Lücke, die geschlossen werden sollte.
2. Eine geplante FastAPI-Aufgabe, die ein bekanntes Heim-LAN-Gerät durch den Tunnel anpingt und protokolliert/warnt, wenn es fehlschlägt — fängt direkt die Fehlermodi "Laptop im falschen WLAN" und "Tunnel unten" aus `CHAOS-TESTING.md` ab.
3. Einfache Alarmierung bei Festplattenspeicher (selbst ein einfacher Cron-Job + E-Mail würde reichen).