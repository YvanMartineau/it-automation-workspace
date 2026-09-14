# DEPLOYMENT.md — Full Deployment Guide

How to stand up this stack from nothing. Written to be followable by
someone who has never done this before (that's how it was actually built).
Assumes you're starting from a fresh Oracle Cloud account.

Current live deployment: `130.61.157.106` (Oracle Frankfurt, EU),
`https://christian-it-automation.duckdns.org`.

---

## 1. Provision the Oracle VM

- Region: Frankfurt (`eu-frankfurt-1`) — required for EU data residency
- Shape: `VM.Standard.A1.Flex`, Always Free — take whatever OCPU/RAM your
  tenancy offers (this deployment runs on 1 OCPU / 6GB RAM)
- Image: Ubuntu 24.04 Minimal
- **Boot volume:** leave at default "Balanced" performance (10 VPU/GB) —
  the "Lower Cost" 0-VPU tier is not available for boot volumes, only
  block volumes. The console's estimated-cost widget will show a nonzero
  price for Always-Free-eligible resources — this is a known display bug,
  not a real charge, as long as you stay within Always Free limits.
- **Public IPv4:** enable it. If the toggle is greyed out, your selected
  subnet is private — create/select a **public** subnet (route table with
  an Internet Gateway rule, `0.0.0.0/0 → Internet Gateway`).
- SSH keys: let Oracle generate them, download the private key
  immediately (shown once), `chmod 400`.

## 2. Harden the VM

```bash
ssh -i <key> ubuntu@<VM_IP>
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Europe/Berlin
```

Restrict SSH in the OCI Security List (Networking → VCN → Security Lists
→ Default Security List) to your own IP `/32`, not `0.0.0.0/0`.

Edit `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
```
Validate before restarting: `sudo sshd -t`, then `sudo systemctl restart ssh`
— keep your original session open until a fresh connection is confirmed.

Check for a drop-in override (`/etc/ssh/sshd_config.d/*.conf`) that might
silently take precedence over your edits.

Swap: Oracle's Ubuntu image ships with a swapfile already configured —
check with `free -h` before assuming you need to create one.

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y docker-compose-plugin
```

Fix Docker's container DNS if builds fail with
`Temporary failure resolving 'deb.debian.org'`:
```bash
sudo nano /etc/docker/daemon.json
```
```json
{ "dns": ["1.1.1.1", "8.8.8.8"] }
```
```bash
sudo systemctl restart docker
```

## 4. Set up the WireGuard tunnel (for remote device scanning)

See `DEPLOYMENT_DECISIONS.md` #3 for why this topology (VM = server, laptop = client
+ NAT gateway). Full command sequence:

**On the VM (server):**
```bash
sudo apt install -y wireguard
sudo mkdir -p /etc/wireguard && sudo chmod 700 /etc/wireguard
umask 077
wg genkey | sudo tee /etc/wireguard/server_private.key | wg pubkey | sudo tee /etc/wireguard/server_public.key
```
`/etc/wireguard/wg0.conf`:
```ini
[Interface]
Address = 10.10.0.1/24
ListenPort = 51820
PrivateKey = <server_private.key contents>

[Peer]
PublicKey = <laptop's public key>
AllowedIPs = 10.10.0.2/32, 192.168.179.0/24
```
```bash
sudo chmod 600 /etc/wireguard/wg0.conf
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
```

Open UDP 51820 in the Security List (`0.0.0.0/0`, since the laptop's IP is
dynamic), and in the VM's own iptables:
```bash
sudo iptables -I INPUT 5 -p udp --dport 51820 -j ACCEPT
sudo netfilter-persistent save
```

**On the laptop (client + gateway), on the MAIN network (not guest/isolated):**
```bash
sudo apt install -y wireguard
sudo mkdir -p /etc/wireguard && sudo chmod 700 /etc/wireguard
umask 077
wg genkey | sudo tee /etc/wireguard/laptop_private.key | wg pubkey | sudo tee /etc/wireguard/laptop_public.key
```
`/etc/wireguard/wg0.conf`:
```ini
[Interface]
PrivateKey = <laptop_private.key contents>
Address = 10.10.0.2/24

[Peer]
PublicKey = <server public key>
Endpoint = 130.61.157.106:51820
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25
```
```bash
sudo chmod 600 /etc/wireguard/wg0.conf
sudo wg-quick up wg0
sudo sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf
sudo iptables -t nat -A POSTROUTING -o <wifi-interface> -j MASQUERADE
sudo iptables -I FORWARD 1 -i wg0 -o <wifi-interface> -j ACCEPT
sudo iptables -I FORWARD 2 -i <wifi-interface> -o wg0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo netfilter-persistent save
```

Test from the VM: `ping 10.10.0.2` then `ping 192.168.179.1` (or any
known device on the home LAN).

## 5. DNS + TLS (DuckDNS + Let's Encrypt)

- Register a subdomain at duckdns.org, point it at the VM's public IP
- Auto-updater cron (every 5 min) — see `RUNBOOK.md` for the script
- Open TCP 80/443 in the Security List and VM iptables
- `sudo apt install -y certbot`
- `sudo certbot certonly --standalone -d <your-subdomain>.duckdns.org`
- Confirm `certbot.timer` is active (`systemctl status certbot.timer`)
- Add renewal hooks to stop/start the nginx container around renewal
  (see `DEPLOYMENT_DECISIONS.md` #5, `RUNBOOK.md` for exact scripts)

## 6. Clone the repo

```bash
sudo mkdir -p /opt/it-automation && sudo chown $USER:$USER /opt/it-automation
cd /opt/it-automation
git clone git@github.com:<user>/<repo>.git app
```
Use a dedicated, read-only Deploy Key (GitHub repo → Settings → Deploy
keys), not your personal SSH key, and `IdentitiesOnly yes` in
`~/.ssh/config` scoped to `Host github.com`.

## 7. Build `.env`

```bash
sudo nano /opt/it-automation/.env
sudo chown ubuntu:ubuntu /opt/it-automation/.env   # NOT root — docker compose runs as your user
sudo chmod 600 /opt/it-automation/.env
ln -s /opt/it-automation/.env /opt/it-automation/app/infra/.env   # for ${VAR} substitution in the compose file itself
```
See `infra/.env.example` in the repo for the full variable list. Generate
secrets with `python3 -c "import secrets; print(secrets.token_hex(32))"`
(adjust length per variable).

## 8. Build and start

```bash
cd /opt/it-automation/app/infra
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```
Every service should show `Up` (or `Up (healthy)` for fastapi/postgres).

## 9. Run migrations and seed

```bash
docker compose -f docker-compose.prod.yml exec fastapi alembic upgrade head
docker compose -f docker-compose.prod.yml exec fastapi python seed.py
```

## 10. Verify

```bash
curl https://<your-subdomain>.duckdns.org/health
```
Then log in through the real frontend and confirm a page refresh keeps
you authenticated (tests the cross-origin cookie fix specifically).

## 11. n8n workflow setup

Tunnel in: `ssh -i <key> -L 5678:localhost:5678 ubuntu@<VM_IP>`, then
browse to `http://localhost:5678`. Set `N8N_WEBHOOK_URL=http://localhost:5678`
(not `http://n8n:5678` — that's only valid for container-to-container
calls, not for what a human's browser/Google OAuth needs to see). Any
HTTP Request node calling back into fastapi should target
`http://fastapi:8000/...` (the Docker service name, reachable on the
shared bridge network) — not `host.docker.internal`, which is a local-dev-only
mechanism tied to `network_mode: host`.