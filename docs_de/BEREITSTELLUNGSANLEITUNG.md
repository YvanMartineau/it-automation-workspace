# BEREITSTELLUNGSANLEITUNG.md — Vollständige Anleitung zur Bereitstellung

So bauen Sie diesen Software-Stack von Grund auf auf. Geschrieben für Personen ohne Vorkenntnisse. Geht von einem neuen Oracle-Cloud-Konto aus.

Aktuelle Live-Bereitstellung: `130.61.157.106` (Oracle Frankfurt, EU), `https://christian-it-automation.duckdns.org`.

---

## 1. Oracle VM bereitstellen

- Region: Frankfurt (`eu-frankfurt-1`) — erforderlich für Datenspeicherung in der EU
- Form (Shape): `VM.Standard.A1.Flex`, Immer Kostenlos (Always Free) — nutzen Sie die verfügbaren OCPU/RAM-Ressourcen (diese Bereitstellung läuft auf 1 OCPU / 6 GB RAM)
- Betriebssystem-Image: Ubuntu 24.04 Minimal
- **Start-Volume (Boot Volume):** Auf der Standard-Leistung "Ausgewogen" belassen (10 VPU/GB) — die Stufe "Niedrigere Kosten" mit 0 VPU gibt es nur für Speicher-Volumes, nicht für Start-Volumes. Die Preis-Anzeige zeigt eventuell Kosten für Always-Free-Ressourcen an — das ist ein bekannter Anzeigefehler und keine echte Berechnung, solange Sie in den Grenzen bleiben.
- **Öffentliche IPv4:** Aktivieren. Wenn der Schalter grau ist, ist das Subnetz privat — erstellen oder wählen Sie ein **öffentliches** Subnetz (Routentabelle mit Internet-Gateway-Regel, `0.0.0.0/0 → Internet-Gateway`).
- SSH-Schlüssel: Von Oracle erstellen lassen, den privaten Schlüssel sofort herunterladen (wird nur einmal angezeigt), `chmod 400` ausführen.

## 2. VM absichern

```bash
ssh -i <schluessel> ubuntu@<VM_IP>
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Europe/Berlin
```

Beschränken Sie SSH in der OCI Security List (Netzwerk → VCN → Security Lists → Default Security List) auf Ihre eigene IP `/32`, nicht `0.0.0.0/0`.

Bearbeiten Sie `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
```
Vor dem Neustart prüfen: `sudo sshd -t`, dann `sudo systemctl restart ssh` — lassen Sie Ihre aktuelle Sitzung offen, bis eine neue Verbindung erfolgreich getestet wurde.

Prüfen Sie, ob Konfigurationsdateien in `/etc/ssh/sshd_config.d/*.conf` Ihre Einstellungen unbemerkt überschreiben.

Auslagerungsspeicher (Swap): Das Ubuntu-Image von Oracle hat bereits einen Auslagerungsspeicher konfiguriert — prüfen Sie dies mit `free -h`.

## 3. Docker installieren

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y docker-compose-plugin
```

Reparieren Sie den Container-DNS von Docker, wenn das Erstellen mit der Meldung `Temporary failure resolving 'deb.debian.org'` fehlschlägt:
```bash
sudo nano /etc/docker/daemon.json
```
```json
{ "dns": ["1.1.1.1", "8.8.8.8"] }
```
```bash
sudo systemctl restart docker
```

## 4. WireGuard-Tunnel einrichten (für das Fernscannen von Geräten)

Siehe `BEREITSTELLUNGSENTSCHEIDUNGEN.md` #3 für die Gründe dieser Struktur (VM = Server, Laptop = Client + NAT-Gateway). Vollständige Befehle:

**Auf der VM (Server):**
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
PrivateKey = <Inhalt von server_private.key>

[Peer]
PublicKey = <Öffentlicher Schlüssel des Laptops>
AllowedIPs = 10.10.0.2/32, 192.168.179.0/24
```
```bash
sudo chmod 600 /etc/wireguard/wg0.conf
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
```

Öffnen Sie UDP 51820 in der Security List (`0.0.0.0/0`, da die IP des Laptops dynamisch ist) und in der Firewall der VM:
```bash
sudo iptables -I INPUT 5 -p udp --dport 51820 -j ACCEPT
sudo netfilter-persistent save
```

**Auf dem Laptop (Client + Gateway) im HAUPTNETZWERK (nicht Gastnetzwerk):**
```bash
sudo apt install -y wireguard
sudo mkdir -p /etc/wireguard && sudo chmod 700 /etc/wireguard
umask 077
wg genkey | sudo tee /etc/wireguard/laptop_private.key | wg pubkey | sudo tee /etc/wireguard/laptop_public.key
```
`/etc/wireguard/wg0.conf`:
```ini
[Interface]
PrivateKey = <Inhalt von laptop_private.key>
Address = 10.10.0.2/24

[Peer]
PublicKey = <Öffentlicher Schlüssel des Servers>
Endpoint = 130.61.157.106:51820
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25
```
```bash
sudo chmod 600 /etc/wireguard/wg0.conf
sudo wg-quick up wg0
sudo sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf
sudo iptables -t nat -A POSTROUTING -o <wlan-schnittstelle> -j MASQUERADE
sudo iptables -I FORWARD 1 -i wg0 -o <wlan-schnittstelle> -j ACCEPT
sudo iptables -I FORWARD 2 -i <wlan-schnittstelle> -o wg0 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo netfilter-persistent save
```

Test von der VM aus: `ping 10.10.0.2`, dann `ping 192.168.179.1` (oder ein bekanntes Gerät im Heimnetzwerk).

## 5. DNS + TLS (DuckDNS + Let's Encrypt)

- Registrieren Sie eine Subdomain auf duckdns.org und verweisen Sie auf die öffentliche IP der VM.
- Automatische Aktualisierung per Cron-Job (alle 5 Minuten) — siehe `BETRIEBSHANDBUCH.md` für das Skript.
- Öffnen Sie TCP 80/443 in der Security List und in der Firewall der VM.
- `sudo apt install -y certbot`
- `sudo certbot certonly --standalone -d <ihre-subdomain>.duckdns.org`
- Prüfen Sie, ob `certbot.timer` aktiv ist (`systemctl status certbot.timer`).
- Fügen Sie Skripte hinzu, um den nginx-Container während der Erneuerung zu stoppen und neu zu starten (siehe `BEREITSTELLUNGSENTSCHEIDUNGEN.md` #5).

## 6. Repository klonen

```bash
sudo mkdir -p /opt/it-automation && sudo chown $USER:$USER /opt/it-automation
cd /opt/it-automation
git clone git@github.com:<benutzer>/<repository>.git app
```
Verwenden Sie einen eigenen Deploy-Schlüssel mit Leserechten (GitHub → Settings → Deploy keys), nicht Ihren persönlichen SSH-Schlüssel.

## 7. `.env` erstellen

```bash
sudo nano /opt/it-automation/.env
sudo chown ubuntu:ubuntu /opt/it-automation/.env   # NICHT root — docker compose läuft als Ihr Benutzer
sudo chmod 600 /opt/it-automation/.env
ln -s /opt/it-automation/.env /opt/it-automation/app/infra/.env   # Für Variablen-Ersatz in der Compose-Datei
```
Siehe `infra/.env.example` im Repository für die Liste aller Variablen. Erstellen Sie Geheime Schlüssel mit: `python3 -c "import secrets; print(secrets.token_hex(32))"`.

## 8. Erstellen und starten

```bash
cd /opt/it-automation/app/infra
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```
Jeder Dienst sollte `Up` zeigen (oder `Up (healthy)` für fastapi/postgres).

## 9. Migrationen und Daten-Import ausführen

```bash
docker compose -f docker-compose.prod.yml exec fastapi alembic upgrade head
docker compose -f docker-compose.prod.yml exec fastapi python seed.py
```

## 10. Überprüfen

```bash
curl https://<ihre-subdomain>.duckdns.org/health
```
Melden Sie sich dann über das echte Frontend an und prüfen Sie, ob Sie nach dem Neuladen der Seite angemeldet bleiben (prüft die Korrektur der Cross-Origin-Cookies).

## 11. n8n Workflow-Einrichtung

Verbindung aufbauen: `ssh -i <schluessel> -L 5678:localhost:5678 ubuntu@<VM_IP>`, dann im Browser `http://localhost:5678` öffnen. Setzen Sie `N8N_WEBHOOK_URL=http://localhost:5678`. Anfragen von n8n an fastapi müssen an `http://fastapi:8000/...` gerichtet werden (der Name des Docker-Dienstes im gemeinsamen Netzwerk).