# Runbook — Project 1: IT Automation Platform
> Detection → Immediate steps → Fallback → Verify recovery
> Test every scenario before demo day.

---

## SCENARIO 1 — Aiven PostgreSQL instance offline

**Detection:** FastAPI returns 503. Logs show `asyncpg.exceptions.ConnectionDoesNotExistError`. Aiven dashboard shows instance status "Stopped".

**Immediate steps:**
1. Log in to Aiven console at console.aiven.io
2. Find the PostgreSQL service — click "Power On"
3. Wait ~60 seconds for instance to start
4. Verify: `psql $DATABASE_URL -c "SELECT 1;"`
5. Restart FastAPI: `docker compose restart fastapi`

**Fallback (if Aiven is unavailable for >5 minutes during demo):**
1. `docker compose up postgres_local` — starts local PostgreSQL
2. Update `DATABASE_URL` in `.env` to `DEV_DATABASE_URL` value
3. `docker compose restart fastapi`
4. Run `python seed.py` to repopulate demo data
5. Continue demo on local DB — explain to interviewer: "This is the local failover documented in my runbook."

**Prevention:** GitHub Actions keep-alive cron pings Aiven every Monday. Verify cron is active at github.com → repo → Actions → Aiven Keep-Alive.

---

## SCENARIO 2 — Oracle VM unreachable

**Detection:** Public URL (Cloudflare domain) returns 502 or times out. SSH to VM fails.

**Immediate steps:**
1. Check Oracle Cloud console — verify VM is running
2. If VM shows "Stopped": Start from OCI console
3. Wait 2 minutes for systemd to restart docker-compose
4. SSH in and verify: `docker compose ps` — all services should show "Up"
5. If tunnel is down: `sudo systemctl restart cloudflared`

**Fallback (demo mode):**
1. `cd p1-automation && docker compose up` on local machine
2. Demo runs on localhost — public URL not required for a local demo
3. Explain: "The Oracle VM had an issue — I'm showing you the identical local environment."

**Prevention:** Systemd service unit restarts docker-compose on reboot. Test: `sudo reboot` → SSH back after 2 min → verify services running.

---

## SCENARIO 3 — M365 Developer Tenant lapsed

**Detection:** `POST /onboard` returns 401 from Microsoft Graph. Logs show `AuthenticationError`. M365 admin center inaccessible.

**Immediate steps:**
1. Go to developer.microsoft.com/microsoft-365/dev-program
2. Log in → check tenant status → click "Renew" if available
3. If tenant is permanently expired: re-register → recreate app registration → update GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET in .env
4. Restart FastAPI: `docker compose restart fastapi`

**Fallback (demo mode):**
1. In `services/graph_client.py`, enable the local simulation mode:
   `SIMULATION_MODE = os.getenv("GRAPH_SIMULATION", "false") == "true"`
2. Set `GRAPH_SIMULATION=true` in .env
3. Simulation returns a fake user_id — onboarding flow completes, email/Jira still fire via n8n
4. Explain to interviewer: "The M365 tenant lapsed — I'm showing the simulation fallback I built for exactly this scenario."

**Prevention:** Calendar reminder every 21 days: log into developer.microsoft.com. Tenant lapses after 90 days of inactivity.

---

## SCENARIO 4 — n8n webhook fails (welcome email / Jira ticket not created)

**Detection:** Onboarding returns 200 (success) but welcome email not received. Jira ticket not created. Logs show `n8n webhook call failed`.

**Note:** This is expected and handled — n8n is not in the critical path. The user was created in Entra ID successfully.

**Immediate steps:**
1. Check n8n: open localhost:5678 or cloudflare-domain/n8n
2. Check n8n execution history — find the failed execution
3. Re-run the failed execution manually from n8n UI
4. If n8n container is down: `docker compose restart n8n`

**Prevention:** n8n has mem_limit: 512m in docker-compose. Without this it can OOM. Verify: `docker stats` — n8n memory usage should stay under 400MB.

---

## SCENARIO 5 — Cloudflare Tunnel disconnected

**Detection:** Public URL returns 502. Oracle VM is reachable via SSH. Docker services are running.

**Immediate steps:**
1. SSH to VM
2. Check tunnel status: `sudo systemctl status cloudflared`
3. If stopped: `sudo systemctl start cloudflared`
4. If failing: `cloudflared tunnel run p1-automation` — check error output
5. Verify: curl the public URL from outside the VM

**Fallback:** Demo on localhost. Tunnel is not required for local demo.

---

## SCENARIO 6 — Docker compose fails to start on Oracle VM after reboot

**Detection:** SSH to VM. `docker compose ps` shows all services "Exited".

**Immediate steps:**
1. `docker compose logs fastapi` — check for startup error (usually missing env var)
2. Verify `.env` file exists: `ls -la .env`
3. `docker compose up -d` — restart all services
4. If FastAPI exits immediately: `docker compose logs fastapi --tail 50` — look for `ValidationError` from settings.py (missing env var)

**Prevention:** settings.py raises ValueError at startup if any required env var is missing. The error message names the missing variable. Fix the .env and restart.
