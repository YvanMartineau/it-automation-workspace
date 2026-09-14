# DEPLOYMENT_DECISIONS.md — Architecture Decision Log

Each entry: the decision, why, and what it costs. Written so a reviewer
(or future-you) can see this was reasoned about, not defaulted into.

---

## 1. Self-hosted Postgres container, not Aiven (V1)

**Decision:** Run `postgres:16-alpine` as a container on the VM instead of
using Aiven's managed free-tier Postgres.

**Why:** Aiven integration is deferred to V2. Keeping V1 self-contained on
one VM reduces moving parts during initial deployment.

**Cost:** Backups are now entirely our responsibility (see
`BACKUP-RESTORE.md`) — no managed-provider safety net. Revisit in V2.

---

## 2. `network_mode: host` dropped for prod fastapi (then partially reinstated)

**Decision:** Local dev uses `network_mode: host` + `NET_RAW`/`NET_ADMIN` so
nmap can do real ARP/ICMP discovery on the home LAN. Prod uses an isolated
bridge network (`itautomation_net`) instead, but **keeps** `NET_RAW`/
`NET_ADMIN` capabilities.

**Why:** Host networking gives a container the VM's entire network stack —
unnecessary attack surface for an internet-facing box. Bridge networking
plus the VM's own routing table (which includes a route to the home LAN
via `wg0`, see below) is sufficient for TCP/ICMP-based scanning, without
full host exposure. `NET_RAW`/`NET_ADMIN` are still required for nmap's
raw socket operations regardless of network mode.

**Known limitation:** nmap's fastest local-discovery method (ARP scan) is
Layer-2 and cannot cross a routed WireGuard tunnel. Only IP-layer methods
(ICMP echo, TCP SYN/connect probes) work remotely. This is inherent to the
topology, not a bug — accepted trade-off for remote scanning capability.

---

## 3. Remote device scanning via WireGuard tunnel, laptop as gateway (not Fritz!Box)

**Decision:** The Oracle VM runs a WireGuard **server** (`wg0`,
`10.10.0.1/24`, UDP 51820). The user's Linux laptop runs a WireGuard
**client** (`10.10.0.2/24`) and acts as a NAT gateway into the home LAN
(`192.168.179.0/24`), via IP forwarding + `iptables MASQUERADE` on
`wlp2s0`.

**Why not Fritz!Box as the VPN endpoint:** No admin credentials available
for the Fritz!Box, and no way to recover them. Fritz!Box's WireGuard
"Remote Access" mode is otherwise the well-supported path (unlike its
buggy "Network-to-Network" mode) — if credentials are ever recovered,
this is the natural upgrade path.

**Cost — availability, accepted honestly:** Scanning only works while the
laptop is powered on, awake, and connected to the correct (main, not
guest-isolated) WiFi network. This is a real, named single point of
failure for the scanning feature specifically — not for the platform as a
whole (see `FAILOVER.md`). A dedicated always-on device (Raspberry Pi,
~€20-40 secondhand) would remove this constraint; deliberately not
purchased, to preserve the €0 hard requirement.

**Firewall exception:** UDP 51820 opened to `0.0.0.0/0` on the VM's
Security List — necessary since the laptop's home IP is dynamic and can't
be allowlisted like SSH was. WireGuard's protocol design makes this
low-risk: it silently drops any packet that isn't cryptographically
valid, revealing nothing to a port scanner.

---

## 4. DNS resolver override for `fastapi` only

**Decision:** `fastapi`'s Docker service sets `dns: [192.168.179.1]`
(the home Fritz!Box), while the rest of the daemon uses `1.1.1.1`/`8.8.8.8`.

**Why:** Docker's build-time DNS failures (`Temporary failure resolving
'deb.debian.org'`) were fixed by setting daemon-wide public DNS servers in
`/etc/docker/daemon.json`. This is correct for build-time `apt-get`, but
broke reverse-DNS hostname lookups for scanned home devices at runtime,
since public resolvers know nothing about local LAN hostnames. Scoping the
fix to just `fastapi` preserves both behaviors.

**Known limitation:** if home device hostnames were ever discovered via
mDNS/NetBIOS (broadcast, Layer-2) rather than real DNS, this fix wouldn't
help — same fundamental limitation as ARP scanning (#2). Confirmed working
in practice after this change, so likely real unicast DNS was in play.

---

## 5. Ingress: DuckDNS + Let's Encrypt, not Cloudflare Tunnel

**Decision:** Public ingress is `christian-it-automation.duckdns.org` via
Let's Encrypt TLS terminated directly in nginx, with ports 80/443 opened
on the VM's Security List. No Cloudflare Tunnel, no cloudflared container.

**Why:** Cloudflare Tunnel's persistent, named-tunnel token requires a
domain added as a zone in Cloudflare (nameservers delegated) — genuinely
free domain options (Freenom-era free TLDs) no longer exist reliably;
remaining "free domain" providers are reputationally poor for a portfolio
project. Spending even €1-3/year was explicitly rejected to preserve a
hard €0 requirement. DuckDNS was chosen over Dynu for its stronger
self-hosting community track record and lack of periodic reactivation
requirement, despite DuckDNS having suffered one unexplained full outage
in August 2025 (resolved; monitoring shows current stability).

**Cost, accepted knowingly:**
- Direct 80/443 exposure on the VM, rather than Cloudflare's proxy hiding
  the origin IP and absorbing DDoS/scanning traffic.
- DNS reliability now depends on a free, community-run service with a
  documented outage history, rather than a company with an SLA.
- Certificate renewal requires briefly stopping nginx (see hook below) —
  a small, automated maintenance window every ~60 days.

**Mitigation:** `/etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh` and
`.../post/start-nginx.sh` stop/restart the nginx container around
`certbot renew`, since Certbot's `--standalone` mode needs port 80 free.

---

## 6. n8n: internal-only, no exposed UI, no built-in auth

**Decision:** n8n is published only on `127.0.0.1:5678` on the VM —
reachable exclusively via SSH tunnel (`ssh -L 5678:localhost:5678 ...`).
No Cloudflare Access policy, no public DNS record, no
`N8N_BASIC_AUTH_*` variables configured.

**Why:** n8n's UI is a workflow *editor* — a much larger attack surface
than a JSON API (arbitrary HTTP requests, code nodes, credential storage).
Keeping it off the public internet entirely removes an entire class of
risk for a feature (workflow editing) used infrequently.

**Known gap, accepted:** n8n currently has zero authentication of its own.
Security relies entirely on the SSH-tunnel-only access path. If that
single control is ever bypassed (e.g., someone later publishes the port
directly, or the Security List rule is misconfigured), there is nothing
behind it. Acceptable for a portfolio deployment; would need
`N8N_BASIC_AUTH_ACTIVE=true` at minimum before any real production use.

---

## 7. Real LDAP kept (not simulated), Graph API dropped from V1 scope

**Decision:** `IDENTITY_PROVIDER=ldap` in production, running the same
`openldap` + `lam` containers as local dev, with synthetic/fake user data
only. Microsoft Graph API integration (`entra_id` provider) is out of
scope for V1 — not yet built, correctly excluded rather than half-wired.

**Why:** Matches what's actually implemented; avoids introducing a new,
unbuilt technology under deployment pressure.

**GDPR note:** LDAP directory must contain only synthetic/fake identities,
never real people's data, even though it's a "real" (non-mocked) LDAP
server.

---

## 8. Hardcoded personal email in `main.py` (flagged, fix path given)

**Finding:** `WEEKLY_RECIPIENTS = "martineaubadou9@gmail.com"` was
hardcoded directly in source, visible in git history even after moving to
`ADMIN_ALERT_EMAIL` going forward (unless history is rewritten with
BFG Repo-Cleaner / `git filter-repo`). Low severity (mostly spam-list
exposure), consciously accepted rather than rewriting git history.
Repo kept **private** for now specifically because of this, pending
optional history cleanup before ever going public.

---

## 9. Known app-code bugs found and fixed during deployment

Two occurrences of the same bug: `backend/db/engine.py` and
`backend/db/migrations/env.py` both read `settings.DEV_DATABASE_URL`
instead of `settings.DATABASE_URL` — a local-dev leftover that caused the
app to construct a database connection from an empty string in
production (`ArgumentError: Could not parse SQLAlchemy URL from string ''`).
Both fixed, one line each, confirmed via `grep -rn "DEV_DATABASE_URL"
backend/` to check for further occurrences.

Also fixed: `_set_refresh_cookie()` in `routers/auth.py` used
`samesite="strict"`, written under an assumption of same-origin deployment
(frontend/backend behind one proxy). Actual deployment is cross-origin
(Cloudflare Pages frontend, DuckDNS backend) — `SameSite=Strict` silently
blocks the browser from ever sending the refresh cookie cross-site.
Changed to `samesite="none"` (valid since `secure=True` was already set).

---

## 10. nginx SSE support required manual addition

**Finding:** `/scan/{job_id}/stream` and `/onboard/jobs/{job_id}/stream`
use Server-Sent Events, but nginx buffers proxied responses by default —
would have held back live progress updates until the whole stream
finished. Fixed by adding `proxy_buffering off; proxy_cache off;
chunked_transfer_encoding off;` to the `/api/` location block.

---

## 11. Remote scan data is incomplete by nature of the tunnel topology — MAC, OS, CPU/RAM

Observed: devices discovered via the WireGuard-tunneled scan (`DEPLOYMENT_DECISIONS.md`
#3) show less data than the same devices showed in local, same-LAN dev
testing — specifically missing MAC address, less reliable OS detection,
and no CPU/RAM figures (even for devices that showed these in dev).

**MAC address — permanent, not fixable.** Confirmed in `scanner.py`'s own
docstring: MAC address comes from nmap's `-sn` ping sweep, which "usually
already yields hostname + MAC via nmap's own ARP behavior" — but only on
a local Ethernet segment. Once traffic crosses the WireGuard tunnel
(Layer-3/routed) and is NAT'd through the laptop gateway, ARP never
happens for those hosts, so `mac_address` stays `None` for every remote
device. Same underlying limitation as #2. Not fixable without changing
the topology (e.g., an agent installed on each device — see the
"Option C" agent pattern discussed but deferred during initial planning).

**OS detection — degraded, not broken; confirmed IP-based, not ARP-based.**
Uses `nmap --privileged -O -F`, which fingerprints via TCP/IP stack
behavior (TTL, window size, timing) — this is IP-layer, so it can still
work across the tunnel in principle, unlike MAC/ARP. Expect it to be
less reliable than same-LAN scanning (NAT rewriting, added latency), not
uniformly absent. The code already surfaces its own confidence
percentage inline (`"{name} ({accuracy}% confidence)"`) specifically so
low-confidence guesses are visible rather than silently presented as fact.

**CPU/RAM — confirmed, permanently unavailable for any remote device in
this topology, not a guess.** `scanner.py`'s `_enrich_local_host_sync()`
only runs when a scanned IP matches one of the *scanning process's own*
network interfaces (`_get_local_ip_addresses()`, via `psutil`) — this is
deliberate, documented local-introspection-only enrichment, not a bug:
"legitimate, since this is local introspection, not remote polling."
In local dev, this fired for the Linux laptop because the laptop *was*
the scanning host and its own IP was inside the scanned subnet — never
for the phone, a genuinely separate device. **In production, this path
can never fire for any home-LAN device**: the VM's own interfaces
(Docker bridge, `wg0` tunnel endpoint `10.10.0.1`) are never members of
`192.168.179.0/24`, so `local_ips` never intersects with any scanned
host. This isn't a regression from dev — dev's apparent "it works" was
only ever true for the one machine that happened to be both the scanner
and a target simultaneously. The real fix, if ever wanted, is the
agent-based pattern (a lightweight process on each target device
reporting its own `psutil` stats up to the API) — the same pattern
flagged and deliberately deferred as future work during initial scanning
architecture decisions (see #3).

**One thing working correctly *because* of this:** `_compute_health_score()`
treats `cpu_percent`/`memory_percent` as `None` → full 100 score
("absence of evidence isn't evidence of a problem") — so the total
absence of this data for every remote device does not incorrectly
trigger health alerts. Worth knowing this is a deliberate design choice
holding up under a condition (100% of remote hosts lacking this data)
that likely wasn't the primary case it was written for.

**Finding:** `/scan/{job_id}/stream` and `/onboard/jobs/{job_id}/stream`
use Server-Sent Events, but nginx buffers proxied responses by default —
would have held back live progress updates until the whole stream
finished. Fixed by adding `proxy_buffering off; proxy_cache off;
chunked_transfer_encoding off;` to the `/api/` location block.