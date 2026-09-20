# CHAOS-TESTING.md — Checkliste für Fehlerszenarien

Jedes Szenario: wie man es auslöst, was passieren sollte, Bestehen/Nicht-Bestehen-Kriterien.
Die Status-Spur verfolgt, was tatsächlich getestet wurde vs. nur durchdacht.

| Szenario | Auslösung | Erwartetes Verhalten | Status |
|---|---|---|---|
| fastapi-Container stirbt | `docker compose kill fastapi` | `restart: always` bringt ihn zurück; nginx gibt während der Lücke kurz 502 zurück | Noch nicht getestet |
| postgres-Container stirbt | `docker compose kill postgres` | Der Healthcheck von fastapi schlägt fehl, Container als unhealthy markiert; `restart: always` auf postgres stellt ihn wieder her; fastapi sollte sich erholen, sobald postgres wieder gesund ist | Noch nicht getestet |
| n8n während des Onboardings ausgefallen | `docker compose stop n8n`, dann Onboarding auslösen | Laut `ADR-007` in den Kommentaren von `settings.py`: n8n ist „Fire-and-Continue", nicht im kritischen Pfad — Onboarding sollte NICHT fehlschlagen oder auf n8n warten | Noch nicht getestet — gegen `services/onboarding_pipeline.py` prüfen |
| Gmail-Versand schlägt fehl | Ungültiges `GMAIL_OAUTH_REFRESH_TOKEN` vorübergehend | Die Report-Generierung sollte mit einem klaren Fehlerstatus elegant fehlschlagen, nicht die App oder den Scheduler zum Absturz bringen | Noch nicht getestet |
| Doppeltes Onboarding zweimal abgeschickt | Dieselbe Onboarding-Anfrage schnell zweimal abschicken | Der zweite Versuch sollte auf den `ConflictError` → 409 stoßen, nicht einen doppelten Benutzer anlegen | Durch Code-Review bestätigt (`except ConflictError` in `onboard.py`) — nicht Last-getestet |
| VM-Neustart (vollständig) | `sudo reboot` | Alle Dienste sollten automatisch starten (`restart: always` auf allem außer `lam`/`k6`, die Profil-gesteuert sind); WireGuard sollte sich neu verbinden (`systemctl enable wg-quick@wg0`); Zertifikatserneuerungs-Hooks sollten überleben (systemd-verwaltet, nicht compose-verwaltet) | Noch nicht End-zu-Ende getestet |
| Laptop (WireGuard-Gateway) geht offline | Laptop vom WLAN trennen oder herunterfahren | Gerätescan läuft in einen Timeout; jedes andere Feature (Auth, Dashboard, Onboarding, Reports) funktioniert normal weiter — siehe `FAILOVER.md` | Durch Design bestätigt — siehe `DEPLOYMENT_DECISIONS.md` Nr. 3 |
| DuckDNS-Ausfall | Kann nicht sicher erzwungen werden — stattdessen durchdenken | Domain wird unerreichbar; VM bleibt über die rohe IP mit einer Zertifikat-Fehler-Warnung erreichbar; lokaler Fallback-Stack unberührt | Nur durchdacht — siehe `FAILOVER.md` |
| Let's-Encrypt-Erneuerung schlägt fehl | Manuell `certbot renew --dry-run` ausführen und prüfen | Pre-Hook stoppt nginx, Post-Hook startet ihn neu — wenn die Erneuerung selbst fehlschlägt (z. B. DuckDNS genau in dem Moment ausgefallen, blockiert die HTTP-01-Challenge), könnte nginx vom Pre-Hook gestoppt bleiben, ohne dass ein erfolgreicher Post-Hook ihn neu startet | **Reales identifiziertes Risiko, noch nicht gemildert** — siehe Bekannte Lücken unten |
| WireGuard-Laptop verbindet sich versehentlich mit dem Gastnetzwerk | Laptop-WLAN manuell auf Gast-SSID umschalten | NAT/Forwarding-Regeln referenzieren `wlp2s0` weiterhin über den Schnittstellennamen (funktioniert in jedem Netzwerk, mit dem die Schnittstelle verbunden ist) — aber das *Ziel*-Subnetz für den Scan würde still zum isolierten Segment des Gastnetzwerks statt zum echten LAN | Während des ersten Setups als reales Risiko bestätigt (genau dieser Fehler ist passiert) — keine automatische Erkennung vorhanden |
| Datenbank-Backup-Wiederherstellung | Vollständige Wiederherstellungsübung mit den Schritten aus `BACKUP-WIEDERHERSTELLUNG.md` gegen eine Kopie | Sollte auf den letzten nächtlichen Backup-Punkt zurückkehren, Datenverlust begrenzt durch das Backup-Intervall (bis zu 24h) | Noch nicht End-zu-Ende getestet |

## Bekannte Lücken (identifiziert, noch nicht behoben)

1. **Erneuerungsfehler könnte nginx gestoppt lassen.** Der Pre-Hook
   stoppt nginx bedingungslos; wenn `certbot renew` dann aus irgendeinem
   Grund fehlschlägt, feuert der Post-Hook (der in manchen Certbot-
   Konfigurationen nur bei Erfolg läuft) möglicherweise nie. Empfohlener Fix: Den Post-Hook
   bedingungslos laufen lassen (Certbots `--deploy-hook` vs. `--post-hook`-
   Semantik unterscheiden sich hier — vor dem Verlassen in einem echten
   Vorfall prüfen).
2. **Keine automatische Erkennung von „Laptop ist im falschen WLAN-Netzwerk".**
   Genau dieser Fehler ist einmal während des Setups passiert und wurde nur durch
   manuelles Bemerken leerer Scan-Ergebnisse entdeckt. Ein einfacher Health-Check
   (regelmäßig die IP eines bekannten Heimnetz-Geräts von fastapi aus mit curl aufrufen, Alarm bei Fehlschlag) würde das abfangen — noch nicht gebaut, siehe `MONITORING.md`.
3. **Keine Lasttests durchgeführt** über das hinaus, wofür `k6` lokal
   eingerichtet ist (der `k6`-Dienst in `docker-compose.yml`, `--profile performance`) — nicht
   gegen das Produktions-Deployment laufen lassen.
4. **Remote-Scans geben niemals MAC-Adresse oder CPU/RAM für ein Heimnetz-Gerät zurück — bestätigte Ursache in `scanner.py`, keine Vermutung.** MAC erfordert ARP (nur lokales Segment, unmöglich über den Tunnel);
   CPU/RAM-Anreicherung läuft nur für die Schnittstellen des eigenen Scan-Prozesses, die in dieser Topologie niemals zum Heimnetz passen. OS-Erkennung ist IP-basiert und funktioniert über den Tunnel, nur weniger zuverlässig.
   Kein Fehlermodus zum Testen/Alarmieren — eine akzeptierte, dauerhafte
   Eigenschaft dieser Architektur. Siehe `DEPLOYMENT_DECISIONS.md` Nr. 11.
