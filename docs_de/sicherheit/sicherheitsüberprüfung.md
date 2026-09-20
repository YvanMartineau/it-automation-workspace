# Wichtige positive Aspekte – Sicherheitsüberprüfung der IT-Automatisierungsplattform

---

## 1. Authentifizierung & Token-Verwaltung (`jwt_handler.py`, `frontend/src/lib/api.ts`)
- **Speicher-Isolation:** Zugriffstoken werden streng im clientseitigen Speicher (`useAuthStore`) gehalten, nicht im `localStorage` oder `sessionStorage`. Das verringert das Risiko, dass Token durch XSS-Angriffe gestohlen werden.
- **Trennung der Token-Lebensdauer:** Zugriffstoken laufen nach 15 Minuten mit minimalen Rechten ab. Aktualisierungs-Token (Refresh Tokens) werden in 7-Tage-Cookies mit den Einstellungen `HttpOnly`, `Secure` und `SameSite=Strict` gespeichert.
- **Schutz bei gleichzeitigen Zugriffen:** Der Axios-Antwort-Interceptor verwendet ein gemeinsames `refreshPromise`-Muster. Das verhindert Probleme, wenn viele Anfragen gleichzeitig einen abgelaufenen Token (401) aktualisieren wollen.

## 2. Datenbank-Engine & Konfiguration (`engine.py`, `settings.py`)
- **Strenge Typenprüfung:** `pydantic-settings` löst sofort einen Fehler beim Start aus, wenn wichtige Geheimnisse (wie `JWT_SECRET_KEY` oder Datenbank-Zugangsdaten) fehlen. So wird verhindert, dass das System unsicher auf Standardwerte zurückfällt (APP.1.1).
- **Verbindungs-Stabilität:** SQLAlchemy ist mit `pool_pre_ping=True` konfiguriert. Das verhindert Probleme durch abgebrochene oder alte Datenbankverbindungen.

## 3. Audit-Protokollierung & Stabilität (`audit_middleware.py`)
- **Nicht-blockierende Stabilität:** Fehler beim Schreiben von Audit-Logs werden abgefangen und strukturiert als Fehler (`logger.error`) protokolliert. So unterbrechen vorübergehende Protokollierungsfehler niemals die wichtigsten Geschäftsprozesse.
- **Saubere Transaktionen:** Das explizite `await db.rollback()` setzt den Sitzungsstatus nach einem Audit-Fehler zurück. Das verhindert Laufzeitfehler wie "invalid transaction" bei asyncpg.

## 4. Authentifizierungs-Router (`backend/routers/auth.py`)
- **Schutz vor Brute-Force-Angriffen:** Slowapi-Ratenbegrenzung (30/Min. für Login und Aktualisierung, 60/Min. für Logout) begrenzt Angriffe durch Ausprobieren von Passwörtern und DoS-Angriffe (BSI APP.1.1).
- **Cookie-Absicherung:** `_set_refresh_cookie` erzwingt `httponly=True`, `secure=True`, `samesite="strict"`. Das Weglassen einer expliziten Pfad-Einschränkung löst Routing-Probleme bei Reverse-Proxys, während die Sicherheit durch die Herkunftsisolierung erhalten bleibt.
- **Trennung der Ebenen:** Kryptografische Prüfungen, Zugangsdaten-Checks und Audit-Protokollierung werden an `services/auth_service.py` delegiert. Fehler im Service werden in kontrollierte HTTP-401-Fehler umgewandelt, ohne dass interne Fehlerdetails (Stack-Traces) angezeigt werden.

## 5. Datenbank-Identitätsmodell (`backend/models/user.py`)
- **Speicherung von Zugangsdaten:** `hashed_password` erlaubt 255 Zeichen. Das reicht völlig für Argon2id oder sichere bcrypt-Hashes.
- **Integritätsregeln:** `unique=True` und `index=True` bei der E-Mail sowie `nullable=False` bei Rollen und Status verhindern Wettlaufsituationen (Race Conditions) und das Erstellen doppelter Konten.
- **Minimale Rechte:** Die `UserRole`-Aufzählung (Enum) trennt `admin` klar vom schreibgeschützten `viewer`. Das sorgt für sichere Standardeinstellungen.

## 6. Compliance & Bedrohungs-Abdeckung
- **DSGVO Art. 32:** Sichere Cookie-Eigenschaften und die zustandslose JWT-Verarbeitung schützen personenbezogene Daten während der Übertragung und Verarbeitung. Es werden keine Sitzungs-Token im clientseitigen Speicher abgelegt.
- **BSI IT-Grundschutz (APP.1.1 & OPS.1.1.3):** Strenge Prüfung der Eingabegrenzen, zentrale Ratenbegrenzung und delegierte Audit-Hooks (`record_logout`) erfüllen die Anforderungen an die Anwendungsabsicherung und strukturierte Protokollierung.

## 7. Absicherung des Authentifizierungs-Services (`auth_service.py`)
- **Schutz vor Timing-Angriffen:** `authenticate_user` führt immer eine Hash-Prüfung über `run_in_threadpool` mit einem statischen `DUMMY_HASH` durch, auch bei nicht existierenden E-Mails. Das verhindert, dass Angreifer über die Antwortzeit erkennen, ob eine E-Mail existiert (BSI APP.1.1).
- **Telemetrie-Optimierung:** `rotate_access_token` sendet normale Aktualisierungen (`auth.refresh`) in strukturierte JSON-Logs. Nur sicherheitsrelevante Ereignisse (`auth.refresh.failed`) werden in spezielle Datenbanktabellen geschrieben. Das schützt die Schreib-Leistung von PostgreSQL, ohne die Nachverfolgbarkeit zu verlieren.
- **Stabile Sitzungsbeendigung:** `record_logout` verwendet ein fehlertolerantes Muster. Bei Fehlern wird auf `"unknown"` zurückgefallen, sodass fehlerhafte Token oder vorübergehende Datenbankprobleme eine Logout-Anfrage nicht scheitern lassen.

## 8. Geräte-Router-Zugriff & Kontrollen
- **Strenge Rechte-Grenze:** Lesezugriffe (`GET /`, `GET /stats`) benötigen eine Basis-Authentifizierung (`get_current_user`). Änderungen (POST, PATCH, DELETE) erfordern `get_admin_user`.
- **Schutz vor Ressourcen-Erschöpfung:** Die Paginierung ist begrenzt (`le=500` bei `page_size`). Das verhindert unendliche Abfragen und DoS-Angriffe.
- **Umwandlung von Domänen-Ausnahmen:** `DeviceConflictError`, `DeviceNotFoundError` und `NoUpdateFieldsError` werden sauber in HTTP 409, 404 und 400 umgewandelt. So werden keine internen Fehlerdetails oder Datenbank-Treiberinformationen preisgegeben.

## 9. Geräte-Schema & Eingabevalidierung (`backend/schemas/device.py`)
- **Strenge Zeichenketten-Grenzen:** Strenge Längenlimits (`max_length=45` für IPv6-kompatible IPs, `max_length=17` für MAC-Adressen) neutralisieren Pufferüberlauf-Angriffe und übermäßige Datenmengen an der Pydantic-Grenze.

## 10. Geräte-Service & Geschäftslogik (`backend/services/device_service.py`)
- **Verhinderung von SQL-Injection:** Filterung nutzt die parametrisierte Ausdrucks-API von SQLAlchemy mit `.ilike(pattern)`. Suchbegriffe werden als Parameter gebunden, statt rohen SQL-Code einzufügen.
- **Abstraktion von Datenbankfehlern:** `create_device` fängt `IntegrityError` ab, führt ein explizites `db.rollback()` durch und löst einen domänenspezifischen `DeviceConflictError` aus. So werden keine internen Datenbankstrukturen preisgegeben.
- **Forensische Audit-Integrität:** `delete_device` erfasst `ip_address` und `hostname` und schreibt einen unveränderlichen Audit-Eintrag *vor* dem Löschen. So bleibt der forensische Kontext erhalten.
- **Konsistenz bei Metriken:** `get_health_alert_counts` verwendet Fensterfunktionen (`row_number().over(partition_by=...)`), um den neuesten Gesundheitsstatus jedes Geräts zu isolieren. Das löst Unterschiede bei den Metriken zwischen Dashboard- und Inventar-Ansichten.

## 11. Automatisiertes Netzwerk-Scanning (`scan.py`, `scanner.py`)
- **Steuerung der Subnetz-Parallelität:** `MAX_CONCURRENT_SCANS = 50` mit einem `asyncio.Semaphore` begrenzt gleichzeitige Unterprozesse. Das verhindert, dass nmap-Threads erschöpft werden und schützt die Speichergrenzen des Containers.
- **Stabiles SSE-Streaming:** Der Stream-Generator sendet alle 15 Sekunden `:keep-alive`-Kommentare (`_SSE_HEARTBEAT_SECONDS`). Das verhindert, dass Nginx und Cloudflare Tunnels die Verbindung während langer Scans trennen.
- **Defensives Asset-Upsert:** `_upsert_device` verwendet `pg_insert` mit Konfliktlösung nur für erreichbare Hosts (`up`). Nicht erreichbare Hosts (`down`) werden nur explizit aktualisiert, sodass "Geister-Geräte" das Inventar nicht verschmutzen.

## 12. Identitätsbereitstellung, Onboarding & n8n-Integration (`onboard.py`, `n8n_client.py`)
- **Authentifizierung mit gemeinsamem Geheimnis:** `report_job_status` prüft in konstanter Zeit das `X-Callback-Secret` gegen `settings.N8N_CALLBACK_SECRET`. Das blockiert nicht authentifizierte Manipulationen von Workflow-Rückrufen.
- **Idempotentes Offboarding:** Das Offboarding ist eine sichere Statusänderung zum "Soft-Delete". Wiederholte Aufrufe bei bereits deaktivierten Konten verursachen keine Fehler.
- **Nicht-blockierende Webhooks:** `_trigger_webhook` fängt `httpx.TimeoutException` und allgemeine `HTTPError` ab und protokolliert Fehler, ohne dass Hintergrund-Transaktionen abbrechen.

## 13. E-Mail-Versand & OAuth2 (`email_service.py`)
- **Nicht-blockierende Token-Aktualisierung:** Die synchrone Google OAuth2-Aktualisierung (`creds.refresh()`) läuft im Standard-Thread-Pool über `loop.run_in_executor()`. So bleibt der asynchrone Event-Loop frei.
- **Sichere XOAUTH2-Integration:** Verwendet `aiosmtplib` mit explizitem TLS (`start_tls=True`), einem strengen Socket-Timeout von 15 Sekunden und XOAUTH2-Authentifizierung für Gmail SMTP.
- **Garantierte Verbindungs-Bereinigung:** Ein `finally`-Block führt `await smtp_client.quit()` aus. Das verhindert Verbindungslecks, wenn die Übertragung fehlschlägt.

## 14. PDF-Rendering & Vektor-Diagramme (`pdf_service.py`)
- **Isoliertes Headless-Matplotlib:** `matplotlib.use("Agg")` wird auf Modulebene eingestellt. Das ermöglicht sicheres Rendering in Containern ohne GUI-Abhängigkeiten.
- **Schutz des Event-Loops:** Die CPU-intensive SVG-Erstellung mit Matplotlib und die PDF-Kompilierung mit WeasyPrint laufen beide über `loop.run_in_executor()`. Das verhindert, dass Threads blockiert werden.

## 15. Container-Sicherheit (`backend/Dockerfile`)
- **Ausführung ohne Root-Rechte mit speziellen Fähigkeiten:** `libcap2-bin` wird installiert und `setcap cap_net_raw,cap_net_admin+eip` auf die nmap-Binärdatei angewendet. Die Ausführung wechselt dann zum Nicht-Root-Benutzer `appuser` (UID 1001). Das ermöglicht ARP/ICMP-Subnetz-Erkennung, ohne dass FastAPI als Root laufen muss.
- **Headless-Rendering-Binärdateien:** Pango, Cairo, GDK-PixBuf und `fonts-dejavu-core` werden auf `python:3.12-slim` vorinstalliert. Das liefert genau die Systemabhängigkeiten, die WeasyPrint und Matplotlib benötigen.

## 16. Service-Orchestrierung (`infra/docker-compose.yml`)
- **Datenbank- & Speicher-Grenzen:** Container-Speicherlimits (`mem_limit`: 512m FastAPI, 256m Postgres, 2g n8n) verhindern Speicherkonflikte und OOM-Kaskaden. `postgres_local` hat einen `pg_isready`-Healthcheck mit einer `service_healthy`-Startbedingung für abhängige Dienste.
- **Bedarfsweise Tool-Profiling:** Admin-Tools (`pgadmin`, `lam`) sind hinter Compose `profiles: ["tools"]` versteckt. Sie bleiben inaktiv, bis sie explizit mit `docker compose --profile tools up` gestartet werden.