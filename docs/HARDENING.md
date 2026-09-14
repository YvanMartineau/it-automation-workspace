# HARDENING.md — Security Posture

## Network exposure, by design

| Port | Exposure | Why |
|---|---|---|
| 22 (SSH) | Restricted to admin's own IP `/32` | Standard practice; dynamic IP means occasional manual updates needed |
| 80/443 (HTTP/S) | `0.0.0.0/0` | Required — public web traffic; TLS terminated at nginx via Let's Encrypt |
| 51820 (WireGuard) | `0.0.0.0/0` | Required since the laptop peer's home IP is dynamic; low-risk by protocol design (silently drops invalid packets, doesn't reveal it's listening) |
| 5678 (n8n) | `127.0.0.1` only | Never public — SSH tunnel only, see `DEPLOYMENT_DECISIONS.md` #6 |
| 8080 (LAM) | `127.0.0.1` only | Never public — SSH tunnel only |
| 5432 (Postgres), 389 (LDAP) | Docker-internal only, no host binding at all | Not reachable even from the VM's own loopback |

## Deliberate trade-off: direct exposure instead of Cloudflare Tunnel

See `DEPLOYMENT_DECISIONS.md` #5 for the full reasoning. Net effect: this VM's real
IP and open ports are visible to internet scanners, unlike a
Cloudflare-Tunnel-fronted deployment which hides the origin entirely.
Accepted for a €0-constrained portfolio deployment.

## SSH hardening applied

- Key-only auth (`PasswordAuthentication no`)
- No root login (`PermitRootLogin no`)
- Dedicated, read-only GitHub Deploy Key for repo pulls — separate from
  personal SSH key, no write access, smaller blast radius if the VM is
  ever compromised

## Secrets management

- `/opt/it-automation/.env`: `chmod 600`, owned by `ubuntu` (not root —
  root ownership breaks `docker compose` running as a regular user),
  outside the git-tracked repo entirely (`/opt/it-automation/app` is the
  repo; `.env` sits one level up)
- Symlinked into `infra/.env` for Compose's `${VAR}` substitution — one
  source of truth, not two files to keep in sync
- Never committed — verified from day one

## Known, accepted gaps

- **n8n has no authentication of its own** (`DEPLOYMENT_DECISIONS.md` #6) — relies
  entirely on the SSH-tunnel-only access path holding.
- **No host-level firewall (`ufw`/ additional `iptables` hardening
  beyond what's documented)** — Oracle's Security List is doing the real
  work at the network level; not duplicated at the host level to avoid
  the risk of two overlapping, hard-to-reconcile rule sets.
- **`WEEKLY_RECIPIENTS` hardcoded email** existed in git history before
  being moved to an env var — repo kept private specifically because of
  this (`DEPLOYMENT_DECISIONS.md` #8).
- **Repo currently private** — deploy key access works identically
  whether public or private, so switching later requires no
  infrastructure rework, only a GitHub visibility toggle plus optional
  git history cleanup.

## If this were headed toward real (non-portfolio) production

Priorities, roughly in order: n8n basic auth at minimum → Cloudflare
Tunnel or equivalent to hide origin IP → external uptime/alerting →
Object Storage backup upload → host-level firewall as defense-in-depth →
git history scrub of the hardcoded email → dedicated always-on device
for the WireGuard gateway role instead of a laptop.