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

**Context:** This Project is an auth-gated internal IT dashboard. No public-facing pages, no SEO surface.

**Options considered:** Next.js 14, React + Vite, Angular, Streamlit

**Decision:** React 18 + TypeScript + Vite.

**Rationale:** SSR provides zero value for an internal dashboard — all data is fetched client-side after authentication. Vite static SPA build requires no Node runtime on the Oracle VM. openapi-typescript auto-generates TypeScript interfaces from FastAPI's OpenAPI spec — the Pydantic-to-TS contract is a demonstrable engineering skill. Streamlit eliminated: no RBAC, no WebSocket/SSE support, signals data-science prototype not enterprise tooling.

**Consequences:** No SSR. CORS must be configured correctly (Vite proxy in dev, explicit origins in prod).
---

## ADR-004 — Database: Self-hosted Postgres container, not Aiven (for V1)

**Date:** Project start
**Status:** Accepted

**Context:** Project 1 processes personal data (new hire names, email addresses) — GDPR-relevant. Must remain zero cost.

**Options considered:** Supabase Free, Neon Free, Aiven Free, self-hosted PostgreSQL on Oracle VM

**Decision:** Run postgres:16-alpine as a container on the VM instead of using Aiven's managed free-tier Postgres. 

**Why:** Aiven integration is deferred to V2. Keeping V1 self-contained on
one VM reduces moving parts during initial deployment.

**Rationale:** Aiven is Finland-headquartered (EU-incorporated, no CLOUD Act exposure at the Aiven layer). Positions the project as GDPR-aware infrastructure — a direct signal to German IT hiring managers. SQLite rejected: file-based, no cross-deployment sharing, write contention under demo load.

**Consequences:** Backups are now entirely our responsibility (see `BACKUP-RESTORE.md`) — no managed-provider safety net. Revisit in V2.
For V2:Sub-processor is DigitalOcean (US-headquartered). Documented in PRIVACY.md. sslmode=require mandatory — connection string uses ssl=require with asyncpg driver. Free instance stops after inactivity — GitHub Actions keep-alive cron required.

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

**Decision:** FastAPI fires n8n webhook as a BackgroundTask (non-blocking). If n8n fails, onboarding partially succeeds and the semi-failure is logged.

**Rationale:** n8n is notification infrastructure, not core onboarding logic. The user exists in OpenLDAP regardless of whether the welcome email was sent. Making onboarding depend on n8n availability creates a fragile critical path for a free-tier self-hosted service.

**Consequences:** Welcome email delivery is eventually-consistent, not synchronous. httpx timeout of 5 seconds prevents hung requests.

---

## ADR-008 — UI Component Library: shadcn/ui
**Date:** Project start
**Status:** Accepted
**Context:** The frontend needs a professional, accessible, and maintainable component set that works cleanly with Next.js 15 App Router, TypeScript, and Tailwind CSS under zero-cost constraints.
**Decision:** Use shadcn/ui (Radix primitives + Tailwind). Components are copied into the repository and fully owned by the project.
**Rationale:** 
- Full source ownership and auditability
- Excellent accessibility via Radix
- Zero runtime CSS-in-JS overhead
- Minimal bundle size
- Perfect alignment with the chosen stack
- Demonstrates higher engineering maturity than heavy design systems
**Consequences:** 
- Components live in the repo and must be maintained deliberately
- Initial setup is slightly higher than using MUI/Chakra
- Long-term flexibility and control are significantly better

---

## ADR-009 — Platform User Bootstrapping & Provisioning (Deferred to V3)
**Date:** ...
**Status:** Accepted

**Context:** The system needs at least one authenticated operator to demonstrate the dashboard and trigger onboarding. Subsequent operators should be created through the same governed onboarding process rather than a separate admin UI.

**Decision:**
1. Initial platform administrator is created exclusively via database seed (run once at first deployment / local setup). This seed user has the highest privilege role (`admin`).
2. When the onboarding form is submitted with a role belonging to the operator set (`IT Support`, `HR`, `System Administrator`), the FastAPI control plane:
   - Creates the simulated organisational identity (Samba groups, temporary password, etc.) as usual.
   - **Additionally** creates a corresponding platform user account with a constrained role (`operator` or `viewer` according to policy).
   - Never grants `platform_admin` through the automated path.
3. Platform user creation is an explicit, audited step inside the FastAPI transaction / saga, not a side-effect hidden inside n8n.
4. The temporary password for the platform account is delivered through the same secure channel as the organisational account (or a separate one-time link). Password is never stored in clear text after initial set.

**Rationale:**
- Solves the bootstrap problem cleanly.
- Keeps the onboarding flow as the single source of truth for identity.
- Demonstrates least-privilege: only the seed user is `platform_admin`; all subsequent operators are created with reduced rights.
- Maintains full auditability and correlation IDs across both identity domains.

**Consequences:**
- Role-to-platform-permission mapping must be defined in configuration (not hard-coded).
- An optional approval gate can later be inserted before platform-user creation without redesigning the flow.
- Seed script must be documented as a one-time, destructive operation that is never run in a shared demo environment after initial setup.

---

*Add entries as you build. Every significant choice — including ones you reverse — belongs here.*
