# Architecture Decision Records — Project 1: IT Automation Platform

> Format: Context → Options considered → Decision → Rationale → Consequences
> Add a new entry for every significant architectural choice made during the build.

---

## ADR-001 — Monorepo: single repository for frontend, backend, and infra

**Date:** Project start
**Status:** Accepted

**Context:** Both projects (React frontend, FastAPI backend) are owned by one developer, deployed together, and share no code with any other project.

**Options considered:**
- Two separate repos (frontend-only, backend-only)
- One monorepo with `/frontend`, `/backend`, `/infra` directories

**Decision:** Single monorepo.

**Rationale:** Atomic commits that touch both layers (e.g. "add /onboard endpoint + form UI") stay in one PR. One CI pipeline covers the full stack. One README, one DECISIONS.md, one RUNBOOK. For a solo junior portfolio, monorepo reduces operational overhead with zero downside.

**Consequences:** Both frontend and backend are visible to any recruiter opening the repo. This is intentional — the full stack is the portfolio.

---

## ADR-002 — Backend: FastAPI over Django or Flask

**Date:** Project start
**Status:** Accepted

**Context:** Backend must handle async concurrent network scanning, receive n8n webhooks, auto-generate OpenAPI docs for React type generation.

**Options considered:** Flask, Django + DRF, FastAPI

**Decision:** FastAPI (Python 3.12).

**Rationale:** Async-first by design — no retrofit needed. Pydantic v2 gives request validation, response serialisation, and OpenAPI generation with zero boilerplate. Django is a web application framework, not an automation engine — ORM, admin scaffolding, and URL routing add overhead for a focused API layer. Flask requires manually wiring async support and has no built-in validation.

**Consequences:** No built-in admin panel (mitigated by React dashboard). Audit log must be hand-built (this is a portfolio advantage — candidate can explain every line).

---

## ADR-003 — Frontend: React + TypeScript + Vite (not Next.js)

**Date:** Project start
**Status:** Accepted

**Context:** Project 1 is an auth-gated internal IT dashboard. No public-facing pages, no SEO surface.

**Options considered:** Next.js 14, React + Vite, Angular, Streamlit

**Decision:** React 18 + TypeScript + Vite.

**Rationale:** SSR provides zero value for an internal dashboard — all data is fetched client-side after authentication. Vite static SPA build requires no Node runtime on the Oracle VM, keeping RAM free for FastAPI + n8n + Ollama (Project 2). openapi-typescript auto-generates TypeScript interfaces from FastAPI's OpenAPI spec — the Pydantic-to-TS contract is a demonstrable engineering skill. Streamlit eliminated: no RBAC, no WebSocket/SSE support, signals data-science prototype not enterprise tooling.

**Consequences:** No SSR. CORS must be configured correctly (Vite proxy in dev, explicit origins in prod). Next.js saved for Project 2 where SSR benefits the public ticket portal.

---

## ADR-004 — Database: Aiven PostgreSQL (EU, free tier)

**Date:** Project start
**Status:** Accepted

**Context:** Project 1 processes personal data (new hire names, email addresses) — GDPR-relevant. Must remain zero cost.

**Options considered:** Supabase Free, Neon Free, Aiven Free, self-hosted PostgreSQL on Oracle VM

**Decision:** Aiven Free Tier, EU region (DigitalOcean Frankfurt).

**Rationale:** Aiven is Finland-headquartered (EU-incorporated, no CLOUD Act exposure at the Aiven layer). Positions the project as GDPR-aware infrastructure — a direct signal to German IT hiring managers. SQLite rejected: file-based, no cross-deployment sharing, write contention under demo load.

**Consequences:** Sub-processor is DigitalOcean (US-headquartered). Documented in PRIVACY.md. sslmode=require mandatory — connection string uses ssl=require with asyncpg driver. Free instance stops after inactivity — GitHub Actions keep-alive cron required.

---

## ADR-005 — Password generation: secrets module (not random)

**Date:** Project start
**Status:** Accepted

**Context:** Backend generates temporary passwords for new hires during onboarding.

**Decision:** Python's `secrets` module exclusively.

**Rationale:** `secrets` uses the OS entropy pool (CSPRNG). `random` is a PRNG seeded deterministically — predictable under certain conditions. This is the first line a security-aware interviewer checks. Passwords are never stored in the database or logs. Set via Microsoft Graph PATCH /users/{id} and returned once in the API response.

**Consequences:** None — secrets module is stdlib, zero dependencies.

---

## ADR-006 — Audit log: hand-built (not django-auditlog)

**Date:** Project start
**Status:** Accepted

**Context:** GDPR compliance requires an immutable record of who did what to whose data.

**Decision:** Custom AuditLog SQLAlchemy model with a PostgreSQL trigger that raises an exception on UPDATE or DELETE.

**Rationale:** A library the candidate cannot fully explain is a liability in a technical interview. The hand-built audit log is 40 lines of code. The candidate can explain every line: the JSONB payload, the append-only trigger, the actor/action/target schema, the legal basis under Article 5(2) GDPR (accountability principle).

**Consequences:** No auto-wiring — every mutating route must explicitly inject the audit_logger dependency. This is a feature: the explicit call makes the audit trail visible in code review.

---

## ADR-007 — n8n in non-critical path (fire-and-continue)

**Date:** Project start
**Status:** Accepted

**Context:** n8n handles welcome email and Jira ticket creation after onboarding.

**Decision:** FastAPI fires n8n webhook as a BackgroundTask (non-blocking). If n8n fails, onboarding succeeds and the failure is logged.

**Rationale:** n8n is notification infrastructure, not core onboarding logic. The user exists in Entra ID regardless of whether the welcome email was sent. Making onboarding depend on n8n availability creates a fragile critical path for a free-tier self-hosted service.

**Consequences:** Welcome email delivery is eventually-consistent, not synchronous. httpx timeout of 5 seconds prevents hung requests.

---

## ADR-008 — Public exposure: Cloudflare Tunnel (not open VM ports)

**Date:** Project start
**Status:** Accepted

**Context:** Oracle ARM VM must be publicly accessible for portfolio demo. VM has a public IP but opening inbound ports exposes attack surface.

**Decision:** Cloudflare Tunnel (cloudflared) — outbound-only connection from VM to Cloudflare edge. No inbound firewall rules required.

**Rationale:** Free forever. HTTPS automatic. No open inbound ports (VM firewall: only 80/443). Survives VM IP changes. Cloudflare provides DDoS protection at the edge. The candidate can explain the security model: the VM initiates the tunnel, the attacker has no direct path to the VM.

**Consequences:** ~30–80ms additional latency on EU routing. Acceptable for a dashboard demo.

---

*Add entries as you build. Every significant choice — including ones you reverse — belongs here.*
