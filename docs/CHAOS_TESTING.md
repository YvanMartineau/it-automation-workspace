# CHAOS-TESTING.md — Failure Scenario Checklist

Each scenario: how to trigger it, what should happen, pass/fail criteria.
Status column tracks what's actually been tested vs. only reasoned about.

| Scenario | How to trigger | Expected behavior | Status |
|---|---|---|---|
| fastapi container dies | `docker compose kill fastapi` | `restart: always` brings it back; nginx returns 502 briefly during the gap | Not yet tested |
| postgres container dies | `docker compose kill postgres` | fastapi's healthcheck fails, container marked unhealthy; `restart: always` on postgres recovers it; fastapi should recover once postgres is healthy again | Not yet tested |
| n8n down during onboarding | `docker compose stop n8n`, then trigger onboarding | Per `ADR-007` in `settings.py` comments: n8n is "fire-and-continue," non-critical-path — onboarding should NOT fail or block waiting on n8n | Not yet tested — verify against `services/onboarding_pipeline.py` |
| Gmail send fails | Invalid `GMAIL_OAUTH_REFRESH_TOKEN` temporarily | Report generation should fail gracefully with a clear error status, not crash the app or the scheduler | Not yet tested |
| Duplicate onboarding submitted twice | Submit the same onboarding request twice quickly | Second attempt should hit the `ConflictError` → 409, not create a duplicate user | Confirmed by code review (`onboard.py`'s `except ConflictError`) — not load-tested |
| VM reboot (full) | `sudo reboot` | All services should auto-start (`restart: always` on everything except `lam`/`k6` which are profile-gated); WireGuard should reconnect (`systemctl enable wg-quick@wg0`); cert renewal hooks should survive (systemd-managed, not compose-managed) | Not yet tested end-to-end |
| Laptop (WireGuard gateway) goes offline | Disconnect laptop from WiFi or shut it down | Device scanning times out; every other feature (auth, dashboard, onboarding, reports) continues working normally — see `FAILOVER.md` | Confirmed by design — see `DEPLOYMENT_DECISIONS.md` #3 |
| DuckDNS outage | Can't force this safely — reason about it instead | Domain becomes unreachable; VM still reachable by raw IP with a cert mismatch warning; local fallback stack unaffected | Reasoned about only — see `FAILOVER.md` |
| Let's Encrypt renewal failure | Manually run `certbot renew --dry-run` and inspect | Pre-hook stops nginx, post-hook restarts it — if renewal itself fails (e.g. DuckDNS down at that exact moment, blocking the HTTP-01 challenge), nginx could be left stopped by the pre-hook with no successful post-hook to restart it | **Real identified risk, not yet mitigated** — see Known Gaps below |
| WireGuard laptop reconnects to guest network by mistake | Manually switch laptop WiFi to guest SSID | NAT/forwarding rules still reference `wlp2s0` by interface name (works on any network the interface is connected to) — but the *destination* subnet for scanning would silently become the guest network's isolated segment instead of the real LAN | Confirmed as a real risk during initial setup (this exact mistake happened) — no automated detection exists |
| Database backup restore | Full restore drill using `BACKUP-RESTORE.md` steps against a copy | Should recover to last nightly backup point, data loss bounded by backup interval (up to 24h) | Not yet tested end-to-end |

## Known gaps (identified, not yet fixed)

1. **Cert renewal failure could leave nginx stopped.** The pre-hook
   unconditionally stops nginx; if `certbot renew` then fails for any
   reason, the post-hook (which only runs on success in some Certbot
   configurations) may never fire. Recommended fix: change the post-hook
   to run unconditionally (Certbot's `--deploy-hook` vs `--post-hook`
   semantics differ here — verify before relying on this in a real
   incident).
2. **No automated detection of "laptop is on the wrong WiFi network."**
   This exact mistake happened once during setup and was only caught by
   manually noticing scan results were empty. A basic health check
   (periodically curl a known home-LAN device's IP from fastapi, alert if
   it fails) would catch this — not yet built, see `MONITORING.md`.
3. **No load testing performed** beyond what `k6` is set up for locally
   (`docker-compose.yml`'s `k6` service, `--profile performance`) — not
   run against the production deployment.
4. **Remote scans never return MAC address or CPU/RAM for any home-LAN
   device — confirmed root cause in `scanner.py`, not a guess.** MAC
   requires ARP (local-segment only, impossible across the tunnel);
   CPU/RAM enrichment only ever runs for the scanning process's own
   interfaces, which never match the home subnet in this topology. OS
   detection is IP-based and works across the tunnel, just less reliably.
   Not a failure mode to test/alert on — an accepted, permanent
   characteristic of this architecture. See `DEPLOYMENT_DECISIONS.md` #11.