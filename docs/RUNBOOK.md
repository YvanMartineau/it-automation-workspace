# RUNBOOK.md — Day-to-Day Operations

## Service map

| Service | Reachable | Notes |
|---|---|---|
| fastapi | via nginx only (`/api/`), no published port | healthcheck: `/health` |
| postgres | internal only, no published port | healthcheck: `pg_isready` |
| n8n | `127.0.0.1:5678` on VM only | SSH tunnel to reach UI, see below |
| openldap | internal only | no published port |
| lam (LDAP admin UI) | `127.0.0.1:8080` on VM only | SSH tunnel, `--profile tools` |
| nginx | `80`/`443` public | TLS via Let's Encrypt |
| pg_backup | internal, no ports | daily `pg_dump`, see `BACKUP-RESTORE.md` |

## Common commands

All run from `/opt/it-automation/app/infra/`.

```bash
docker compose -f docker-compose.prod.yml ps                    # status
docker compose -f docker-compose.prod.yml logs -f fastapi        # tail logs
docker compose -f docker-compose.prod.yml restart fastapi        # restart one service
docker compose -f docker-compose.prod.yml up -d --build fastapi  # rebuild + redeploy one service after a code change
```

## Deploying a code change

```bash
cd /opt/it-automation/app
git pull
cd infra
docker compose -f docker-compose.prod.yml build fastapi   # only if backend/ changed
docker compose -f docker-compose.prod.yml up -d
```
`nginx.conf` changes need no rebuild — it's a live-mounted volume, `up -d`
picks up the new file. Frontend changes are out of band, deployed via
Cloudflare Pages directly.

## Reaching n8n's UI

```bash
ssh -i ~/.ssh/oracle_it_automation.key -L 5678:localhost:5678 ubuntu@130.61.157.106
```
Keep that terminal open, then browse to `http://localhost:5678`. n8n has
no built-in authentication currently — see `DECISIONS.md` #6.

## Reaching LDAP Account Manager (LAM)

```bash
ssh -i ~/.ssh/oracle_it_automation.key -L 8080:localhost:8080 ubuntu@130.61.157.106
docker compose -f docker-compose.prod.yml --profile tools up -d lam   # if not already running
```
Browse to `http://localhost:8080`.

## Checking certificate renewal health

```bash
sudo systemctl status certbot.timer
sudo certbot certificates
```
Confirms expiry date and that the renewal hooks (stop/start nginx) exist:
```bash
ls /etc/letsencrypt/renewal-hooks/pre/ /etc/letsencrypt/renewal-hooks/post/
```

## Checking the WireGuard tunnel (needed for live device scanning)

**On the VM:**
```bash
sudo wg show
ping 192.168.179.1   # or any known home-LAN device
```
**On the laptop:** confirm it's on the main WiFi (not guest-isolated),
and the tunnel is up: `sudo wg show`. If either side shows no recent
handshake, the laptop is likely asleep/off-network — this is the known,
documented availability constraint (`DECISIONS.md` #3), not a bug to
chase.

**Expected data when a remote scan succeeds:** devices will be discovered
(IP, open ports, reachability, best-effort OS guess with its confidence
shown), but MAC address and CPU/RAM will never appear for any home-LAN
device — confirmed, permanent limitations of this topology, not signs of
a broken tunnel. See `DECISIONS.md` #11 for the exact mechanism if this
comes up in a demo/interview.

## DuckDNS updater

Cron entry (`crontab -e` on the VM), runs every 5 minutes:
```
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```
Check `~/duckdns/duck.log` — should read `OK`. `KO` means token/subdomain
mismatch in `~/duckdns/duck.sh`.

## Rotating a secret (e.g. JWT_SECRET_KEY, POSTGRES_PASSWORD)

1. Generate a new value, edit `/opt/it-automation/.env`
2. `docker compose -f docker-compose.prod.yml up -d` (recreates any
   service whose env changed)
3. Note: rotating `JWT_SECRET_KEY` invalidates all existing sessions —
   every user must log in again. Rotating `POSTGRES_PASSWORD` requires
   also updating it inside Postgres itself
   (`ALTER USER prod WITH PASSWORD '...'`) since Postgres doesn't read
   `.env` after first init — the compose env var only affects first-init
   or a fresh volume.