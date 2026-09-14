# MONITORING.md

## What exists today

**Docker healthchecks** (self-healing, not alerting):
- `fastapi`: `GET /health` every 10s, 12 retries, 15s start period
- `postgres`: `pg_isready` every 5s, 5 retries

These drive `restart: always` recovery and `depends_on: condition:
service_healthy` ordering — they keep things running, but nothing
outside the VM is notified when they fire.

**Log rotation** (all services): `json-file` driver, `max-size: 10m`,
`max-file: 3` (5m/2 for lighter services) — prevents disk fill from
runaway logs, doesn't surface anything proactively.

**Certbot** (`systemd`, not Docker): `certbot.timer` runs twice daily,
checks/renews certs within 30 days of expiry.

**DuckDNS updater** (`cron`, every 5 min): keeps DNS pointed at the VM's
IP; logs to `~/duckdns/duck.log`, not actively monitored.

## What does NOT exist (honest gap list)

- **No external uptime monitoring.** Nothing alerts if
  `christian-it-automation.duckdns.org` becomes unreachable, if TLS
  expires unexpectedly, or if the VM itself goes down. A free tier of
  UptimeRobot, Better Stack, or similar (checking `/health` every few
  minutes) would close this gap at €0 — recommended next step, not yet
  implemented.
- **No alerting on container restarts.** If `fastapi` crash-loops, Docker
  keeps restarting it silently — nobody is told.
- **No WireGuard tunnel health check.** No automated way to know the
  laptop-gateway path is down except noticing scan results are empty.
- **No disk space monitoring** on the VM itself (boot volume, Docker
  volumes, backup accumulation).
- **No log aggregation.** Logs live only in each container's own
  `json-file` rotation — checking anything means SSHing in and running
  `docker compose logs`.

## Manual health check commands (until real monitoring exists)

```bash
curl -s https://christian-it-automation.duckdns.org/health
docker compose -f docker-compose.prod.yml ps
df -h                                    # disk space
sudo wg show                              # tunnel status
docker compose -f docker-compose.prod.yml exec pg_backup ls -la /backups
```

## Recommended next steps (not yet built, ordered by effort/value)

1. Free external uptime monitor hitting `/health` — lowest effort,
   highest value gap to close
2. A scheduled fastapi task that pings a known home-LAN device through
   the tunnel and logs/alerts if it fails — directly catches the "laptop
   on wrong WiFi" and "tunnel down" failure modes from `CHAOS-TESTING.md`
3. Basic disk space alerting (even a simple cron + email would do)