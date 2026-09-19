# IT Automation Platform — Project 1

> Automated device management, secure onboarding, real-time network scanning, and GDPR-conscious audit logging.

[![CI](https://github.com/YvanMartineau/it-automation-workspace/actions/workflows/ci.yml/badge.svg)](https://github.com/YvanMartineau/it-automation-workspace/actions/workflows/ci.yml)
[![Aiven Keep-Alive](https://github.com/YvanMartineau/it-automation-workspace/actions/workflows/aiven-keepalive.yml/badge.svg)](https://github.com/YvanMartineau/it-automation-workspace/actions/workflows/aiven-keepalive.yml) **V2 — Aiven not yet in use, see below**

**Live demo:** https://it-automation-workspace.martineaubadou9.workers.dev 
**API docs:** https://christian-it-automation.duckdns.org/api/openapi.json

---

## Architecture (as actually deployed)

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (free)   │  Oracle ARM VM (free, 1c/6GB,  │
│                             │  Frankfurt/EU)                 │
│  React + TypeScript        │                                 │
│  Vite SPA                  │  Nginx (TLS via Let's Encrypt) │
│  shadcn/ui + Tailwind      │    ├── FastAPI     :8000       │
│  TanStack Query            │    ├── Postgres 16 (internal)  │
│         │                  │    ├── OpenLDAP + LAM          │
│         │                  │    └── n8n :5678 (SSH-tunnel   │
│         │                  │        only, not public)       │
│         └──── HTTPS ───────┤                                 │
│                             │  DuckDNS (free DDNS)            │
│                             │  ← christian-it-automation.    │
│                             │    duckdns.org                 │
│                             │                                 │
│                             │  WireGuard tunnel ──────────┐  │
└─────────────────────────────┼──────────────────────────────┼─┘
                                                               │
                                                    Home laptop (WireGuard
                                                    client + NAT gateway) ──
                                                    home LAN, for remote
                                                    device scanning only
```

**What changed from the original plan, and why** — full reasoning for
every substitution below lives in
[docs/DECISIONS.md](docs/DECISIONS.md):
- Aiven → self-hosted Postgres (V1; Aiven integration planned for V2,
  keep-alive workflow above is scaffolding for that, not yet load-bearing)
- Microsoft Graph/Entra ID → LDAP (Graph API not yet built, correctly
  excluded from V1 rather than half-wired)
- Cloudflare Tunnel → DuckDNS + Let's Encrypt (persistent tunnel tokens
  require owning a domain; free-domain options are unreliable/not
  professional-looking; a paid domain was intentionally declined to keep
  a hard €0 budget)
- Vercel → Cloudflare Pages (frontend hosting choice)

## Stack

| Layer       | Technology                          | Why                                                  |
|-------------|--------------------------------------|-------------------------------------------------------|
| Frontend    | React 18 + TypeScript + Vite         | Type-safe SPA, Pydantic→TS contract                   |
| Frontend host | Cloudflare Pages                   | Free, integrates with the same Cloudflare account     |
| UI          | shadcn/ui + Tailwind CSS             | Accessible, enterprise-grade components               |
| Backend     | FastAPI + Python 3.12                | Async-first, auto-generated OpenAPI docs              |
| ORM         | SQLAlchemy 2.0 async + Alembic       | Async-native, versioned migrations                    |
| Database    | PostgreSQL 16 (self-hosted, Docker)  | V1; Aiven EU managed Postgres planned for V2           |
| Identity    | OpenLDAP + LDAP Account Manager      | Real (non-mocked) directory, synthetic data only; Graph API/Entra ID deferred to V2 |
| Automation  | n8n Community Edition                | Visual workflow, version-controlled JSON; internal-only, SSH-tunnel access |
| Auth        | JWT + httpOnly cookies (`SameSite=None`) | Stateless, cross-origin-safe refresh token storage (frontend and backend are different domains) |
| Scanning    | python-nmap + asyncio                | Concurrent scan, SSE real-time progress               |
| Remote scan path | WireGuard (VM ⟷ home laptop, NAT gateway) | Lets the cloud-hosted backend reach the home LAN for device discovery — see `DECISIONS.md` for the real constraints this introduces (no MAC, no CPU/RAM, laptop-dependent availability) |
| Scheduling  | APScheduler                          | Cron reports and threshold alerting                    |
| PDF         | WeasyPrint                           | HTML→PDF, no external API                              |
| Ingress/TLS | Nginx + Let's Encrypt + DuckDNS      | Free DDNS + free TLS; direct 80/443 exposure (documented trade-off vs. Cloudflare Tunnel) |

See [docs/DECISIONS.md](docs/DECISIONS.md) for the full rationale behind every choice, including the ones that changed mid-project.

## Quick start (local)

```bash
# 1. Clone and enter
git clone https://github.com/YvanMartineau/it-automation-workspace.git
cd it-automation-workspace

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — fill in DATABASE_URL, LDAP_*, GMAIL_*, JWT_SECRET_KEY
# (GRAPH_* variables exist in .env.example for V2 and are not required for V1)

# 3. Start backend + n8n + local postgres + LDAP
cd infra && docker compose up -d

# 4. Start frontend
cd ../frontend && npm install && npm run dev

# 5. Run migrations, then seed demo data
cd ../backend
alembic upgrade head
python seed.py
```

Open http://localhost:5173 — login with the demo credentials from `seed.py`'s output.

## Production deployment

Live on an Oracle Cloud Always Free VM (Frankfurt). Full step-by-step
deployment guide, including the WireGuard remote-scanning setup:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

- [Architecture Decisions](docs/DECISIONS.md)
- [Deployement Decisions](docs/DEPLOYMENT_DECISIONS.md) — every trade-off made for deployment and why, including mid-project pivots
- [Deployment Guide](docs/DEPLOYMENT.md) — full from-scratch setup
- [Runbook](docs/RUNBOOK.md) — day-to-day operations
- [Backup & Restore](docs/BACKUP-RESTORE.md)
- [Failover](docs/FAILOVER.md) — online/local split, known single points of failure
- [Chaos Testing Checklist](docs/CHAOS-TESTING.md) — failure scenarios, tested and untested
- [Monitoring](docs/MONITORING.md) — what exists, honest gap list
- [Hardening](docs/HARDENING.md) — security posture and accepted trade-offs
- [Rollback](docs/ROLLBACK.md)
- [Privacy Notice](docs/PRIVACY.md)


## Testing

```bash
cd backend
pytest tests/ --cov=backend --cov-report=term-missing
```

Requires local PostgreSQL running (see docker compose).

## Repository structure

```
it-automation-workspace/
├── backend/          FastAPI application
├── frontend/         React + Vite SPA
├── infra/            docker-compose (local + prod), nginx, n8n workflows, backup script
├── docs/             DECISIONS.md, DEPLOYMENT.md, RUNBOOK.md, BACKUP-RESTORE.md...
├── .github/          CI workflows, Aiven keep-alive cron (V2 scaffolding)
├── .git-hooks/       Pre-commit and commit-msg hooks
├── .env.example      All required variables documented
└── README.md
```