# AUSFALLSICHERUNG.md — Online- / Lokale Ausfallsicherung

## Die grundlegende Aufteilung

- **Cloud (Oracle VM, dauerhaft online):** Dashboard, Authentifizierung, Onboarding, Berichte, Audit-Logs — alles außer dem Live-Scan von Geräten im Heimnetzwerk, der eine Abhängigkeit hat (siehe unten).
- **Lokales Docker Compose:** Volle Funktionalität inklusive Scannen, da es direkt im Heimnetzwerk mit `network_mode: host` läuft.

## Frontend auf lokale Umgebung umstellen

Die API-Adresse des Frontends wird durch `VITE_API_URL` beim Erstellen festgelegt (siehe `frontend/src/lib/api.ts`). Es gibt derzeit keinen Schalter zur Laufzeit. Das Umstellen erfordert:

1. `VITE_API_URL=http://localhost:8000` (oder die IP-Adresse Ihres lokalen Rechners im Netzwerk)
2. Neu erstellen und entweder in einer neuen Cloudflare-Pages-Umgebung bereitstellen oder das Frontend ebenfalls lokal ausführen (`npm run dev`).

**Dokumentierte Lücke:** Es gibt noch keinen Schalter für eine Ausfallsicherung mit einem Klick — das ist ein manueller Schritt zum Neu-Erstellen. Für ein Portfolio-Projekt reicht dieses Konzept aus. Ein echtes Produktionssystem bräuchte einen Schalter über Umgebungsvariablen zur Laufzeit.

## Lokalen Ersatz-Stack starten

```bash
cd infra
docker compose up -d
```
Nutzt `docker-compose.yml` (nicht `.prod.yml`) — enthält `postgres_local`, `k6` (Leistungstest, `--profile performance`) und führt `fastapi` mit `network_mode: host` aus für vollen Zugriff auf das lokale Netzwerk.

## Der echte Schwachpunkt der Scan-Funktion

Das Entfernte Scannen von Geräten (Cloud-Modus) hängt vom Weg über den Laptop als WireGuard-Gateway ab (`BEREITSTELLUNGSENTSCHEIDUNGEN.md` #3). Wenn der Laptop ausgeschaltet ist, schläft oder nicht mit dem richtigen WLAN verbunden ist:

- Der WireGuard-Tunnel hat keinen aktiven Partner — Scans laufen in einen Timeout, stürzen aber nicht ab.
- Es gibt aktuell keinen automatischen Alarm für diesen Zustand (siehe Lücke in `UEBERWACHUNG.md`).
- **Das betrifft keine anderen Funktionen** — Anmeldung, Onboarding, Berichte, Dashboard und Audit-Logs funktionieren normal weiter, da sie nicht vom Heimnetzwerk abhängen.

## Was den WireGuard-Tunnel wirklich braucht

| Funktion | Hängt vom Tunnel ab? |
|---|---|
| Login / Authentifizierung | Nein |
| Dashboard | Nein |
| Onboarding (LDAP + n8n) | Nein |
| Berichte (Gmail) | Nein |
| Audit-Logs | Nein |
| **Geräte-Scan** | **Ja** |

## Ausfall von Cloudflare Pages (Frontend)

Das Frontend-Hosting ist komplett getrennt von der Backend-Infrastruktur. Ein Ausfall von Cloudflare Pages betrifft das Backend nicht und umgekehrt. Es gibt keine spezielle Ausfallsicherung für das Frontend außer der Zuverlässigkeit von Cloudflare selbst.

## Ausfall von DuckDNS

Wenn der Dienst von DuckDNS ausfällt (gab es bisher einmal, siehe `BEREITSTELLUNGSENTSCHEIDUNGEN.md` #5), ist die Domain `christian-it-automation.duckdns.org` nicht mehr erreichbar. Die VM selbst ist unbetroffen und weiterhin über die reine IP-Adresse erreichbar (`https://130.61.157.106`, wobei der Browser wegen des Zertifikats eine Warnung anzeigt). Das ist das bekannte Risiko bei der Wahl eines kostenlosen DNS-Anbieters.