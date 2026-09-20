# ABSICHERUNG.md — Sicherheitsstatus

## Netzwerk-Exposition, by Design

| Port | Exposition | Warum |
|---|---|---|
| 22 (SSH) | Beschränkt auf die eigene IP des Admins `/32` | Standardpraxis; bei dynamischer IP sind gelegentliche manuelle Updates nötig |
| 80/443 (HTTP/S) | `0.0.0.0/0` | Erforderlich — öffentlicher Webverkehr; TLS wird bei Nginx über Let's Encrypt beendet |
| 51820 (WireGuard) | `0.0.0.0/0` | Erforderlich, da die Heim-IP des Laptop-Peers dynamisch ist; geringes Risiko durch Protokolldesign (verwirft ungültige Pakete stillschweigend, zeigt nicht, dass es lauscht) |
| 5678 (n8n) | Nur `127.0.0.1` | Niemals öffentlich — nur über SSH-Tunnel, siehe `DEPLOYMENT_DECISIONS.md` #6 |
| 8080 (LAM) | Nur `127.0.0.1` | Niemals öffentlich — nur über SSH-Tunnel |
| 5432 (Postgres), 389 (LDAP) | Nur Docker-intern, keine Host-Bindung | Nicht einmal vom eigenen Loopback der VM aus erreichbar |

## Bewusster Kompromiss: Direkte Exposition statt Cloudflare Tunnel

Siehe `DEPLOYMENT_DECISIONS.md` #5 für die vollständige Begründung. Nettoeffekt: Die echte IP und die offenen Ports dieser VM sind für Internet-Scanner sichtbar, anders als bei einer Bereitstellung hinter einem Cloudflare-Tunnel, die den Ursprung vollständig verbirgt. Dies wurde für eine Portfolio-Bereitstellung mit 0-€-Budget akzeptiert.

## Angewandte SSH-Absicherung

- Nur Schlüssel-Authentifizierung (`PasswordAuthentication no`)
- Kein Root-Login (`PermitRootLogin no`)
- Dedizierter, schreibgeschützter GitHub Deploy Key für Repository-Abrufe — getrennt vom persönlichen SSH-Schlüssel, keine Schreibrechte, geringere Auswirkungen, falls die VM kompromittiert wird.

## Verwaltung von Geheimnissen (Secrets)

- `/opt/it-automation/.env`: `chmod 600`, im Besitz von `ubuntu` (nicht root — Root-Besitz würde `docker compose` als normaler Benutzer stören), vollständig außerhalb des git-verfolgten Repos (`/opt/it-automation/app` ist das Repo; `.env` liegt eine Ebene höher).
- Als Symlink in `infra/.env` eingebunden für die `${VAR}`-Ersetzung von Compose — eine einzige Quelle der Wahrheit, keine zwei Dateien, die synchron gehalten werden müssen.
- Niemals committet — vom ersten Tag an überprüft.

## Bekannte, akzeptierte Lücken

- **n8n hat keine eigene Authentifizierung** (`DEPLOYMENT_DECISIONS.md` #6) — verlässt sich vollständig darauf, dass der Zugriff nur über den SSH-Tunnel erfolgt.
- **Keine Firewall auf Host-Ebene (`ufw`/ zusätzliche `iptables`-Absicherung über das Dokumentierte hinaus)** — Die Security List von Oracle erledigt die eigentliche Arbeit auf Netzwerkebene. Dies wird auf Host-Ebene nicht dupliziert, um das Risiko von zwei sich überschneidenden, schwer abzustimmenden Regelsätzen zu vermeiden.
- **Hardcodierte E-Mail für `WEEKLY_RECIPIENTS`** existierte in der Git-Historie, bevor sie in eine Umgebungsvariable verschoben wurde — das Repo wird speziell deswegen privat gehalten (`DEPLOYMENT_DECISIONS.md` #8).
- **Repo ist derzeit privat** — der Zugriff über den Deploy Key funktioniert identisch, egal ob öffentlich oder privat. Ein späterer Wechsel erfordert also keine Infrastruktur-Änderungen, nur eine Änderung der GitHub-Sichtbarkeit und optional eine Bereinigung der Git-Historie.

## Wenn dies in eine echte (Nicht-Portfolio-)Produktion gehen würde

Prioritäten, grob in dieser Reihenfolge: Mindestens Basis-Authentifizierung für n8n → Cloudflare Tunnel oder Ähnliches, um die Ursprungs-IP zu verstecken → externe Überwachung/Alarmierung → Backup-Upload in Object Storage → Firewall auf Host-Ebene als Verteidigung in der Tiefe → Bereinigung der Git-Historie von der hardcodierten E-Mail → dediziertes, immer eingeschaltetes Gerät für die WireGuard-Gateway-Rolle statt eines Laptops.