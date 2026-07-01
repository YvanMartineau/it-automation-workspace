# IT Automation Platform — Project 1

> Automated device management, secure onboarding, real-time network scanning, and GDPR-compliant audit logging.

[![CI](https://github.com/YOUR_USERNAME/p1-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/p1-automation/actions/workflows/ci.yml)
[![Aiven Keep-Alive](https://github.com/YOUR_USERNAME/p1-automation/actions/workflows/aiven-keepalive.yml/badge.svg)](https://github.com/YOUR_USERNAME/p1-automation/actions/workflows/aiven-keepalive.yml)

**Live demo:** https://your-cloudflare-domain.com  
**API docs:** https://your-cloudflare-domain.com/api/docs

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel (free)         │  Oracle ARM VM (free, 4c/24GB)     │
│                        │                                     │
│  React + TypeScript    │  Nginx (reverse proxy)             │
│  Vite SPA              │    ├── FastAPI :8000               │
│  shadcn/ui + Tailwind  │    └── n8n    :5678               │
│  TanStack Query        │                                     │
│         │              │  Cloudflare Tunnel (free)           │
│         └──── HTTPS ───┤  ← public URL, no open ports       │
└─────────────────────────────────────────────────────────────┘
         │                        │
   Aiven PostgreSQL           M365 E5 Tenant
   (EU, free tier)            Microsoft Graph API
```

## Stack

| Layer       | Technology                    | Why                                        |
|-------------|-------------------------------|--------------------------------------------|
| Frontend    | React 18 + TypeScript + Vite  | Type-safe SPA, Pydantic→TS contract        |
| UI          | shadcn/ui + Tailwind CSS      | Accessible, enterprise-grade components    |
| Backend     | FastAPI + Python 3.12         | Async-first, auto-generated OpenAPI docs   |
| ORM         | SQLAlchemy 2.0 async + Alembic| Async-native, versioned migrations         |
| Database    | PostgreSQL on Aiven EU        | GDPR-aware, EU-incorporated provider       |
| Identity    | Microsoft Graph API (M365 E5) | Real Entra ID provisioning, not simulation |
| Automation  | n8n Community Edition         | Visual workflow, version-controlled JSON   |
| Auth        | JWT + httpOnly cookies        | Stateless, XSS-safe refresh token storage  |
| Scanning    | python-nmap + asyncio         | Concurrent scan, SSE real-time progress    |
| Scheduling  | APScheduler                   | Cron reports and threshold alerting        |
| PDF         | WeasyPrint                    | HTML→PDF, no external API                 |
| Tunnel      | Cloudflare Tunnel             | HTTPS, no open VM ports, free              |

See [docs/DECISIONS.md](docs/DECISIONS.md) for the full rationale behind every choice.

## Quick start (local)

```bash
# 1. Clone and enter
git clone https://github.com/YOUR_USERNAME/p1-automation.git
cd p1-automation

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — fill in DATABASE_URL, GRAPH_*, GMAIL_*, JWT_SECRET_KEY

# 3. Start backend + n8n + local postgres
cd infra && docker compose up -d

# 4. Start frontend
cd ../frontend && npm install && npm run dev

# 5. Seed demo data (creates demo user, triggers scan, sends test report)
cd ../backend && python seed.py
```

Open http://localhost:5173 — login with the demo credentials from seed.py output.

## Documentation

- [Architecture Decisions](docs/DECISIONS.md)
- [Runbook](docs/RUNBOOK.md)
- [Privacy Notice](docs/PRIVACY.md)

## Testing

```bash
cd backend
pytest tests/ --cov=backend --cov-report=term-missing
```

Requires local PostgreSQL running (see docker compose).

## Repository structure

```
p1-automation/
├── backend/          FastAPI application
├── frontend/         React + Vite SPA
├── infra/            docker-compose, nginx, n8n workflows
├── docs/             DECISIONS.md, RUNBOOK.md, PRIVACY.md
├── .github/          CI workflows, keep-alive cron
├── .git-hooks/       Pre-commit and commit-msg hooks
├── .env.example      All required variables documented
└── README.md
```
