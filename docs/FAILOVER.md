# FAILOVER.md — Online / Local Failover

## The core split

- **Cloud (Oracle VM, always-on):** dashboard, auth, onboarding, reports,
  audit logs — everything except live device scanning of the home LAN,
  which has a real dependency (below).
- **Local Docker Compose:** full functionality including scanning, since
  it runs directly on the home network with `network_mode: host`.

## Switching the frontend to point at local

The frontend's API base URL is controlled by `VITE_API_URL` at build
time (see `frontend/src/lib/api.ts`). There is currently no runtime
toggle — switching requires:

1. `VITE_API_URL=http://localhost:8000` (or your local machine's LAN IP,
   if accessing from another device)
2. Rebuild and either redeploy to a separate Cloudflare Pages
   environment, or run the frontend locally too (`npm run dev`)

**Documented gap:** there is no single-click failover switch yet — this
is a manual rebuild-and-redeploy step. Acceptable for a portfolio
project's demonstrated failover *concept*; a real production system
would want an environment-variable-driven runtime toggle instead of a
build-time one.

## Starting the local fallback stack

```bash
cd infra
docker compose up -d
```
Uses `docker-compose.yml` (not `.prod.yml`) — includes `postgres_local`,
`k6` (performance testing, `--profile performance`), and runs `fastapi`
with `network_mode: host` for full local-network scanning capability.

## The scanning feature's real single point of failure

Remote (cloud-mode) device scanning depends on the laptop-as-WireGuard-
gateway path (`DEPLOYMENT_DECISIONS.md` #3). If the laptop is off, asleep, or
disconnected from the correct WiFi network:

- The WireGuard tunnel simply has no live peer — scans will time out,
  not crash
- No alert currently fires for this condition (see `MONITORING.md` for
  the gap)
- **This does not affect any other feature** — auth, onboarding, reports,
  dashboard, audit logs all continue working normally, since none of them
  depend on the home-LAN route

## What actually needs the WireGuard tunnel vs. what doesn't

| Feature | Depends on tunnel? |
|---|---|
| Login / auth | No |
| Dashboard | No |
| Onboarding (LDAP + n8n) | No |
| Reports (Gmail) | No |
| Audit logs | No |
| **Device scanning** | **Yes** |

## Cloudflare Pages (frontend) outage

Frontend hosting is entirely separate infrastructure from the backend —
a Cloudflare Pages outage doesn't affect the backend's health, and vice
versa. No specific failover exists for the frontend beyond Cloudflare's
own platform reliability; out of scope to build a redundant frontend host
for a portfolio project.

## DuckDNS outage

If DuckDNS's own service goes down (has happened once before, see
`DEPLOYMENT_DECISIONS.md` #5), the domain `christian-it-automation.duckdns.org`
becomes unreachable — the VM itself is unaffected and still reachable by
raw IP (`https://130.61.157.106`, though the TLS certificate won't match
that hostname, so browsers will warn). This is the honest failure mode
of choosing a free DNS provider over Cloudflare Tunnel or a paid domain —
documented, not silently hidden.