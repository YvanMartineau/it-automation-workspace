# BEREITSTELLUNGSENTSCHEIDUNGEN.md — Architektur-Entscheidungsprotokoll

Jeder Eintrag zeigt: die Entscheidung, den Grund und die Kosten. Es ist so geschrieben, dass ein Prüfer (oder Sie selbst in der Zukunft) verstehen kann, dass diese Punkte gut überlegt wurden.

---

## 1. Selbstgehosteter Postgres-Container statt Aiven (V1)

**Entscheidung:** Wir führen `postgres:16-alpine` als Container auf der virtuellen Maschine (VM) aus, anstatt den verwalteten kostenlosen Postgres-Dienst von Aiven zu nutzen.

**Grund:** Die Aiven-Integration wird auf V2 verschoben. Wenn V1 auf einer einzigen VM bleibt, gibt es bei der ersten Bereitstellung weniger bewegliche Teile.

**Kosten:** Backups liegen nun vollständig in unserer Verantwortung (siehe `SICHERUNG_UND_WIEDERHERSTELLUNG.md`) — es gibt kein Sicherheitsnetz von einem externen Anbieter. Wir prüfen das in V2 erneut.

---

## 2. `network_mode: host` für Prod-FastAPI entfernt (dann teilweise wieder aktiviert)

**Entscheidung:** Die lokale Entwicklung nutzt `network_mode: host` + `NET_RAW`/`NET_ADMIN`, damit nmap echte ARP/ICMP-Suchen im Heimnetzwerk durchführen kann. Die Produktion nutzt stattdessen ein isoliertes Bridge-Netzwerk (`itautomation_net`), **behält** aber die Berechtigungen `NET_RAW`/`NET_ADMIN`.

**Grund:** Das Host-Netzwerk gibt einem Container den gesamten Netzwerk-Stack der VM. Das ist ein unnötiges Sicherheitsrisiko für einen Server, der mit dem Internet verbunden ist. Bridge-Netzwerk zusammen mit der Routing-Tabelle der VM (die eine Route zum Heimnetzwerk über `wg0` enthält, siehe unten) reicht für TCP/ICMP-Scans aus. `NET_RAW`/`NET_ADMIN` sind unabhängig vom Netzwerkmodus weiterhin für die Socket-Operationen von nmap erforderlich.

**Bekannte Einschränkung:** Die schnellste Methode von nmap zur lokalen Suche (ARP-Scan) arbeitet auf Layer-2 und kann keinen gerouteten WireGuard-Tunnel überqueren. Nur Methoden auf IP-Ebene (ICMP-Echo, TCP SYN/Connect) funktionieren aus der Ferne. Das liegt an der Topologie und ist kein Fehler — ein akzeptierter Kompromiss für die Fernscan-Funktion.

---

## 3. Fernscan von Geräten über WireGuard-Tunnel mit Laptop als Gateway (nicht Fritz!Box)

**Entscheidung:** Die Oracle-VM betreibt einen WireGuard-**Server** (`wg0`, `10.10.0.1/24`, UDP 51820). Der Linux-Laptop des Benutzers betreibt einen WireGuard-**Client** (`10.10.0.2/24`) und arbeitet als NAT-Gateway in das Heimnetzwerk (`192.168.179.0/24`) über IP-Weiterleitung + `iptables MASQUERADE` auf `wlp2s0`.

**Warum nicht die Fritz!Box als VPN-Endpunkt:** Es gibt keine Admin-Zugangsdaten für die Fritz!Box und keine Möglichkeit, sie wiederherzustellen. Der WireGuard-Modus "Fernzugriff" der Fritz!Box ist sonst der gut unterstützte Weg. Wenn Zugangsdaten wieder beschafft werden, ist das der natürliche Weg für ein Upgrade.

**Kosten — Verfügbarkeit (ehrlich akzeptiert):** Das Scannen funktioniert nur, wenn der Laptop eingeschaltet, aktiv und mit dem richtigen WLAN (Hauptnetzwerk, nicht Gastnetzwerk) verbunden ist. Das ist ein echter Schwachpunkt für die Scan-Funktion — aber nicht für die gesamte Plattform (siehe `AUSFALLSICHERUNG.md`). Ein eigenes, dauerhaft eingeschaltetes Gerät (Raspberry Pi, ca. 20–40 € gebraucht) würde diese Einschränkung aufheben. Wir haben es bewusst nicht gekauft, um das Ziel von 0 € Kosten einzuhalten.

**Firewall-Ausnahme:** UDP 51820 wurde in der Security List der VM für `0.0.0.0/0` geöffnet. Das ist notwendig, weil die Heim-IP des Laptops dynamisch ist und nicht wie SSH auf eine Erlaubnisliste gesetzt werden kann. Das Protokoll-Design von WireGuard macht dies risikoarm: Es verwirft jedes Paket, das nicht kryptografisch gültig ist, und zeigt einem Portscanner nichts an.

---

## 4. DNS-Resolver-Überschreibung nur für `fastapi`

**Entscheidung:** Der Docker-Dienst von `fastapi` nutzt `dns: [192.168.179.1]` (die Fritz!Box zu Hause), während der Rest des Systems `1.1.1.1`/`8.8.8.8` nutzt.

**Grund:** DNS-Fehler von Docker beim Erstellen (`Temporary failure resolving 'deb.debian.org'`) wurden behoben, indem öffentliche DNS-Server im gesamten System in `/etc/docker/daemon.json` eingetragen wurden. Das ist richtig für `apt-get` beim Erstellen, hat aber die Rückwärts-DNS-Suche für gescannte Heimgeräte im Betrieb gestört, weil öffentliche Resolver die lokalen Hostnamen nicht kennen. Wenn man die Korrektur nur auf `fastapi` beschränkt, bleiben beide Funktionen erhalten.

**Bekannte Einschränkung:** Wenn Hostnamen von Heimgeräten über mDNS/NetBIOS (Broadcast, Layer-2) statt über echtes DNS gesucht würden, würde diese Korrektur nicht helfen — das ist dieselbe Einschränkung wie beim ARP-Scanning (#2). In der Praxis hat es nach dieser Änderung funktioniert, also war wahrscheinlich echtes Unicast-DNS im Einsatz.

---

## 5. Ingress: DuckDNS + Let's Encrypt, kein Cloudflare Tunnel

**Entscheidung:** Der öffentliche Zugang läuft über `christian-it-automation.duckdns.org` mit Let's Encrypt TLS direkt in nginx. Die Ports 80/443 sind in der Security List der VM geöffnet. Es gibt keinen Cloudflare Tunnel und keinen cloudflared-Container.

**Grund:** Der dauerhafte Token von Cloudflare Tunnel erfordert eine Domain, die als Zone in Cloudflare hinzugefügt wurde. Echt kostenlose Domain-Optionen gibt es nicht mehr zuverlässig. Andere "kostenlose" Anbieter haben einen schlechten Ruf für ein Portfolio-Projekt. Auch nur 1–3 € pro Jahr auszugeben, wurde abgelehnt, um die harte Vorgabe von 0 € einzuhalten. DuckDNS wurde wegen seiner stärkeren Community und ohne erforderliche regelmäßige Reaktivierung gewählt, obwohl DuckDNS im August 2025 einen ungeklärten Ausfall hatte (beholt; Überwachung zeigt aktuelle Stabilität).

**Bewusst akzeptierte Kosten:**
- Direkte Offenlegung von Port 80/443 auf der VM, anstatt dass der Proxy von Cloudflare die Origin-IP verbirgt und DDoS-/Scan-Datenverkehr abfängt.
- Die Zuverlässigkeit des DNS hängt jetzt von einem kostenlosen Community-Dienst mit Ausfallhistorie ab, statt von einer Firma mit Garantie (SLA).
- Die Erneuerung des Zertifikats erfordert ein kurzes Stoppen von nginx (siehe Skript unten) — ein kleines, automatisches Wartungsfenster alle ca. 60 Tage.

**Lösung:** Skripte in `/etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh` und `.../post/start-nginx.sh` stoppen und starten den nginx-Container um `certbot renew` herum, weil der `--standalone`-Modus von Certbot den Port 80 frei braucht.

---

## 6. n8n: Nur intern, keine öffentliche Benutzeroberfläche, keine integrierte Authentifizierung

**Entscheidung:** n8n ist auf der VM nur unter `127.0.0.1:5678` erreichbar — ausschließlich über einen SSH-Tunnel (`ssh -L 5678:localhost:5678 ...`). Es gibt keine Cloudflare-Access-Richtlinie, keinen öffentlichen DNS-Eintrag und keine konfigurierten `N8N_BASIC_AUTH_*`-Variablen.

**Grund:** Die Benutzeroberfläche von n8n ist ein Workflow-Editor — eine viel größere Angriffsfläche als eine JSON-API (beliebige HTTP-Anfragen, Code-Knoten, Speicherung von Zugangsdaten). Wenn man ihn komplett vom öffentlichen Internet fernhält, entfernt man ein großes Risiko für eine Funktion, die selten genutzt wird.

**Akzeptierte Lücke:** n8n hat derzeit selbst keine Authentifizierung. Die Sicherheit basiert komplett auf dem Zugang über den SSH-Tunnel. Wenn diese Einzelsicherung umgangen wird (z. B. wenn jemand den Port später direkt veröffentlicht oder die Regel der Security List falsch konfiguriert wird), gibt es dahinter keinen Schutz. Für ein Portfolio-Projekt ist das akzeptabel; für eine echte Nutzung in der Produktion wäre mindestens `N8N_BASIC_AUTH_ACTIVE=true` erforderlich.

---

## 7. Echter LDAP-Server bleibt (nicht simuliert), Graph API aus V1 entfernt

**Entscheidung:** `IDENTITY_PROVIDER=ldap` in der Produktion. Es laufen dieselben `openldap`- und `lam`-Container wie in der lokalen Entwicklung, aber nur mit Testdaten. Die Integration der Microsoft Graph API (`entra_id`) ist in V1 nicht enthalten — sie ist noch nicht gebaut und wurde korrekterweise weggelassen.

**Grund:** Es passt zu dem, was tatsächlich gebaut wurde, und vermeidet neue, unfertige Technologie unter Zeitdruck.

**DSGVO-Hinweis:** Das LDAP-Verzeichnis darf nur synthetische/falsche Identitäten enthalten und niemals echte Personendaten, obwohl es ein "echter" LDAP-Server ist.

---

## 8. Feste persönliche E-Mail-Adresse in `main.py` (angemerkt, Lösung genannt)

**Befund:** `WEEKLY_RECIPIENTS = "martineaubadou9@gmail.com"` war direkt im Quellcode geschrieben. Es ist in der Git-Historie sichtbar, auch nach dem Wechsel zu `ADMIN_ALERT_EMAIL` (außer die Historie wird mit BFG Repo-Cleaner oder `git filter-repo` neu geschrieben). Das Risiko ist gering (hauptsächlich Spam-Gefahr). Es wurde bewusst akzeptiert, anstatt die Git-Historie neu zu schreiben. Das Repository bleibt vorerst **privat**, bis die Historie eventuell bereinigt wird.

---

## 9. Bekannte Fehler im Anwendungscode bei der Bereitstellung gefunden und behoben

Derselbe Fehler trat zweimal auf: `backend/db/engine.py` und `backend/db/migrations/env.py` lasen beide `settings.DEV_DATABASE_URL` statt `settings.DATABASE_URL`. Das war ein Rest aus der lokalen Entwicklung, der dazu führte, dass die App in der Produktion eine Datenbankverbindung aus einem leeren Text erzeugen wollte (`ArgumentError: Could not parse SQLAlchemy URL from string ''`). Beide Stellen wurden in einer Zeile korrigiert und mit `grep -rn "DEV_DATABASE_URL" backend/` geprüft.

Ebenfalls behoben: `_set_refresh_cookie()` in `routers/auth.py` nutzte `samesite="strict"`. Das wurde unter der Annahme geschrieben, dass Frontend und Backend hinter demselben Proxy liegen. Die echte Bereitstellung ist jedoch domainübergreifend (Cloudflare Pages Frontend, DuckDNS Backend) — `SameSite=Strict` blockiert das Senden des Refresh-Cookies im Browser. Es wurde auf `samesite="none"` geändert (gültig, da `secure=True` bereits gesetzt war).

---

## 10. nginx SSE-Unterstützung brauchte manuelle Anpassung

**Befund:** `/scan/{job_id}/stream` und `/onboard/jobs/{job_id}/stream` nutzen Server-Sent Events (SSE). nginx puffert Antworten standardmäßig — das hätte Live-Updates verzögert, bis der gesamte Stream fertig war. Gelöst durch Hinzufügen von `proxy_buffering off; proxy_cache off; chunked_transfer_encoding off;` zum `/api/`-Block.

---

## 11. Fernscan-Daten sind wegen der Tunnel-Topologie unvollständig — MAC, OS, CPU/RAM

Beobachtung: Geräte, die über den WireGuard-Tunnel gescannt wurden (#3), zeigen weniger Daten als dieselben Geräte beim lokalen Testen im selben Netz — besonders fehlende MAC-Adressen, ungenauere Betriebssystem-Erkennung und keine CPU/RAM-Werte.

**MAC-Adresse — dauerhaft, nicht korrigierbar.** Bestätigt in der Dokumentation von `scanner.py`: Die MAC-Adresse kommt vom Ping-Sweep (`-sn`) von nmap, der im lokalen Netz Hostname + MAC liefert. Sobald der Datenverkehr den WireGuard-Tunnel (Layer-3) überquert und durch das Laptop-Gateway geleitet wird, gibt es kein ARP mehr für diese Geräte. Daher bleibt `mac_address` bei jedem entfernten Gerät `None`. Gleiche Einschränkung wie bei #2. Nicht korrigierbar ohne Änderung der Architektur (z. B. ein Agent auf jedem Gerät).

**OS-Erkennung — eingeschränkt, aber nicht defekt; nutzt IP, nicht ARP.**
Nutzt `nmap --privileged -O -F`, was das Betriebssystem über das Verhalten des TCP/IP-Stacks erkennt (TTL, Fenstergröße, Timing). Das arbeitet auf IP-Ebene und kann prinzipiell über den Tunnel funktionieren. Es ist jedoch ungenauer als im lokalen Netz (wegen NAT und höherer Latenz). Der Code zeigt die Genauigkeit in Prozent an (`"{name} ({accuracy}% confidence)"`), damit unsichere Schätzungen sichtbar sind.

**CPU/RAM — dauerhaft nicht verfügbar für entfernte Geräte in dieser Architektur.**
`_enrich_local_host_sync()` in `scanner.py` läuft nur, wenn eine gescannte IP mit den *eigenen* Netzwerk-Schnittstellen des Scan-Prozesses übereinstimmt (`_get_local_ip_addresses()`, via `psutil`). Das ist eine gewollte lokale Datenanreicherung, kein Fehler. In der lokalen Entwicklung funktionierte das für den Linux-Laptop, weil der Laptop der Scanner *war* und seine IP im gescannten Netz lag. **In der Produktion kann dieser Pfad für Heimgeräte nie starten**: Die Schnittstellen der VM (Docker-Bridge, `wg0`-Endpunkt `10.10.0.1`) liegen nie im Netz `192.168.179.0/24`. Die richtige Lösung wäre ein Agent-System (ein kleiner Prozess auf jedem Zielgerät, der seine Werte an die API meldet).

**Eine Sache, die deswegen richtig funktioniert:** `_compute_health_score()` behandelt fehlende Werte für `cpu_percent`/`memory_percent` als `None` → ergibt volle 100 Punkte ("Fehlen von Daten ist kein Beweis für ein Problem"). Das Fehlen dieser Daten führt also nicht zu falschen Warnungen.