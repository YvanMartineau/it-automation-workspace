# Betriebsanleitung — Projekt 1: IT-Automatisierungsplattform
> Erkennung → Sofortmaßnahmen → Fallback → Wiederherstellung prüfen
> Teste jedes Szenario vor dem Demo-Tag.

---

## SZENARIO 1 — Aiven-PostgreSQL-Instanz offline

**Erkennung:** FastAPI gibt 503 zurück. Logs zeigen `asyncpg.exceptions.ConnectionDoesNotExistError`. Das Aiven-Dashboard zeigt den Instanzstatus „Gestoppt".

**Sofortmaßnahmen:**
1. Logge dich in die Aiven-Konsole unter console.aiven.io ein
2. Finde den PostgreSQL-Dienst — klicke auf „Einschalten"
3. Warte ca. 60 Sekunden, bis die Instanz startet
4. Prüfen: `psql $DATABASE_URL -c "SELECT 1;"`
5. FastAPI neu starten: `docker compose restart fastapi`

**Fallback (falls Aiven während der Demo länger als 5 Minuten nicht verfügbar ist):**
1. `docker compose up postgres_local` — startet lokales PostgreSQL
2. Aktualisiere `DATABASE_URL` in `.env` auf den Wert von `DEV_DATABASE_URL`
3. `docker compose restart fastapi`
4. Führe `python seed.py` aus, um Demo-Daten neu zu laden
5. Mache mit der Demo auf der lokalen Datenbank weiter — erkläre dem Interviewer: „Das ist der lokale Failover, der in meiner Betriebsanleitung dokumentiert ist."

**Prävention:** GitHub Actions Keep-Alive-Cron pingt Aiven jeden Montag. Prüfe, ob der Cron aktiv ist unter github.com → Repository → Actions → Aiven Keep-Alive.

---

## SZENARIO 2 — Oracle-VM nicht erreichbar

**Erkennung:** Die öffentliche URL (Cloudflare-Domain) gibt 502 zurück oder läuft in einen Timeout. SSH zur VM schlägt fehl.

**Sofortmaßnahmen:**
1. Prüfe die Oracle-Cloud-Konsole — verifiziere, dass die VM läuft
2. Wenn die VM „Gestoppt" zeigt: Starte sie aus der OCI-Konsole
3. Warte 2 Minuten, bis systemd docker-compose neu startet
4. Per SSH einloggen und prüfen: `docker compose ps` — alle Dienste sollten „Up" zeigen
5. Falls der Tunnel ausgefallen ist: `sudo systemctl restart cloudflared`

**Fallback (Demo-Modus):**
1. `cd p1-automation && docker compose up` auf dem lokalen Rechner
2. Demo läuft auf localhost — die öffentliche URL ist für eine lokale Demo nicht nötig
3. Erkläre: „Die Oracle-VM hatte ein Problem — ich zeige dir die identische lokale Umgebung."

**Prävention:** Die Systemd-Service-Unit startet docker-compose nach einem Neustart neu. Test: `sudo reboot` → nach 2 Min. wieder per SSH einloggen → prüfen, ob die Dienste laufen.

---

## SZENARIO 3 — M365-Developer-Tenant abgelaufen

**Erkennung:** `POST /onboard` gibt 401 von Microsoft Graph zurück. Logs zeigen `AuthenticationError`. Das M365-Admin-Center ist nicht erreichbar.

**Sofortmaßnahmen:**
1. Gehe zu developer.microsoft.com/microsoft-365/dev-program
2. Einloggen → Tenant-Status prüfen → auf „Erneuern" klicken, falls verfügbar
3. Falls der Tenant dauerhaft abgelaufen ist: neu registrieren → App-Registrierung neu erstellen → GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET in .env aktualisieren
4. FastAPI neu starten: `docker compose restart fastapi`

**Fallback (Demo-Modus):**
1. Aktiviere in `services/graph_client.py` den lokalen Simulationsmodus:
   `SIMULATION_MODE = os.getenv("GRAPH_SIMULATION", "false") == "true"`
2. Setze `GRAPH_SIMULATION=true` in .env
3. Die Simulation gibt eine gefälschte user_id zurück — der Onboarding-Prozess läuft durch, E-Mail/Jira werden weiterhin über n8n ausgelöst
4. Erkläre dem Interviewer: „Der M365-Tenant ist abgelaufen — ich zeige den Simulations-Fallback, den ich genau für diesen Fall gebaut habe."

**Prävention:** Kalendererinnerung alle 21 Tage: bei developer.microsoft.com einloggen. Der Tenant verfällt nach 90 Tagen Inaktivität.

---

## SZENARIO 4 — n8n-Webhook schlägt fehl (Willkommens-E-Mail / Jira-Ticket wird nicht erstellt)

**Erkennung:** Onboarding gibt 200 (Erfolg) zurück, aber die Willkommens-E-Mail kommt nicht an. Jira-Ticket wird nicht erstellt. Logs zeigen `n8n webhook call failed`.

**Hinweis:** Das ist erwartet und wird behandelt — n8n liegt nicht im kritischen Pfad. Der Benutzer wurde erfolgreich in Entra ID erstellt.

**Sofortmaßnahmen:**
1. n8n prüfen: localhost:5678 oder cloudflare-domain/n8n öffnen
2. n8n-Ausführungshistorie prüfen — die fehlgeschlagene Ausführung finden
3. Die fehlgeschlagene Ausführung manuell aus der n8n-Oberfläche erneut ausführen
4. Falls der n8n-Container ausgefallen ist: `docker compose restart n8n`

**Prävention:** n8n hat mem_limit: 512m in docker-compose. Ohne das kann es einen OOM-Fehler geben. Prüfen: `docker stats` — die Speichernutzung von n8n sollte unter 400 MB bleiben.

---

## SZENARIO 5 — Cloudflare-Tunnel getrennt

**Erkennung:** Öffentliche URL gibt 502 zurück. Oracle-VM ist per SSH erreichbar. Docker-Dienste laufen.

**Sofortmaßnahmen:**
1. Per SSH zur VM verbinden
2. Tunnel-Status prüfen: `sudo systemctl status cloudflared`
3. Wenn gestoppt: `sudo systemctl start cloudflared`
4. Falls fehlerhaft: `cloudflared tunnel run p1-automation` — Fehlerausgabe prüfen
5. Prüfen: öffentliche URL von außerhalb der VM mit curl aufrufen

**Fallback:** Demo auf localhost. Der Tunnel ist für eine lokale Demo nicht nötig.

---

## SZENARIO 6 — Docker Compose startet nach Neustart auf der Oracle-VM nicht

**Erkennung:** SSH zur VM. `docker compose ps` zeigt alle Dienste als „Exited".

**Sofortmaßnahmen:**
1. `docker compose logs fastapi` — Startfehler prüfen (meist fehlende Umgebungsvariable)
2. Prüfen, ob die `.env`-Datei existiert: `ls -la .env`
3. `docker compose up -d` — alle Dienste neu starten
4. Falls FastAPI sofort beendet wird: `docker compose logs fastapi --tail 50` — nach `ValidationError` von settings.py suchen (fehlende Umgebungsvariable)

**Prävention:** settings.py löst beim Start einen ValueError aus, wenn eine erforderliche Umgebungsvariable fehlt. Die Fehlermeldung nennt die fehlende Variable. Korrigiere die .env und starte neu.
