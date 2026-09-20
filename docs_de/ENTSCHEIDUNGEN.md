# Architektur-Entscheidungsprotokolle — Projekt 1: IT-Automatisierungsplattform

> Format: Kontext → Geprüfte Optionen → Entscheidung → Begründung → Folgen
> Füge einen neuen Eintrag für jede bedeutende Architektur-Entscheidung während des Builds hinzu.

---

## ADR-001 — Monorepo: ein einzelnes Repository für Frontend, Backend und Infra

**Datum:** Projektstart
**Status:** Akzeptiert

**Kontext:** Beide Projekte (React-Frontend, FastAPI-Backend) gehören einem Entwickler, werden zusammen deployed und teilen keinen Code mit anderen Projekten.

**Geprüfte Optionen:**
- Zwei getrennte Repos (nur Frontend, nur Backend)
- Ein Monorepo mit `/frontend`, `/backend`, `/infra`-Verzeichnissen

**Entscheidung:** Einzelnes Monorepo.

**Begründung:** Atomare Commits, die beide Ebenen betreffen (z. B. „/onboard-Endpunkt + Formular-UI hinzufügen"), bleiben in einem PR. Eine CI-Pipeline deckt den gesamten Stack ab. Ein README, ein ENTSCHEIDUNGEN.md, eine BETRIEBSANLEITUNG. Für ein Solo-Junior-Portfolio reduziert das Monorepo den Betriebsaufwand ohne Nachteile.

**Folgen:** Sowohl Frontend als auch Backend sind für jeden Recruiter sichtbar, der das Repo öffnet. Das ist Absicht — der gesamte Stack ist das Portfolio.

---

## ADR-002 — Backend: FastAPI statt Django oder Flask

**Datum:** Projektstart
**Status:** Akzeptiert

**Kontext:** Das Backend muss asynchrones gleichzeitiges Netzwerk-Scannen verarbeiten, n8n-Webhooks empfangen, OpenAPI-Dokumente automatisch für die React-Typ-Generierung erzeugen.

**Geprüfte Optionen:** Flask, Django + DRF, FastAPI

**Entscheidung:** FastAPI (Python 3.12).

**Begründung:** Async-first von Grund auf — kein Nachrüsten nötig. Pydantic v2 liefert Request-Validierung, Response-Serialisierung und OpenAPI-Generierung ohne Boilerplate. Django ist ein Webanwendungs-Framework, keine Automatisierungs-Engine — ORM, Admin-Gerüst und URL-Routing bringen Overhead für eine fokussierte API-Schicht. Flask erfordert manuelles Verdrahten der Async-Unterstützung und hat keine eingebaute Validierung.

**Folgen:** Kein eingebautes Admin-Panel (durch React-Dashboard abgefedert). Audit-Log muss von Hand gebaut werden (das ist ein Portfolio-Vorteil — der Kandidat kann jede Zeile erklären).

---

## ADR-003 — Frontend: React + TypeScript + Vite (nicht Next.js)

**Datum:** Projektstart
**Status:** Akzeptiert

**Kontext:** Dieses Projekt ist ein auth-geschütztes internes IT-Dashboard. Keine öffentlichen Seiten, keine SEO-Fläche.

**Geprüfte Optionen:** Next.js 14, React + Vite, Angular, Streamlit

**Entscheidung:** React 18 + TypeScript + Vite.

**Begründung:** SSR bringt null Wert für ein internes Dashboard — alle Daten werden nach der Authentifizierung clientseitig geholt. Der Vite-Static-SPA-Build benötigt keine Node-Laufzeit auf der Oracle-VM. openapi-typescript generiert TypeScript-Schnittstellen aus FastAPIs OpenAPI-Spec — der Pydantic-zu-TS-Vertrag ist eine demonstrierbare Engineering-Fähigkeit. Streamlit gestrichen: kein RBAC, keine WebSocket/SSE-Unterstützung, signalisiert Datenwissenschafts-Prototyp statt Enterprise-Tooling.

**Folgen:** Kein SSR. CORS muss korrekt konfiguriert werden (Vite-Proxy in der Entwicklung, explizite Ursprünge in der Produktion).
---

## ADR-004 — Datenbank: Selbst-gehosteter Postgres-Container, nicht Aiven (für V1)

**Datum:** Projektstart
**Status:** Akzeptiert

**Kontext:** Projekt 1 verarbeitet personenbezogene Daten (Namen neuer Mitarbeiter, E-Mail-Adressen) — GDPR-relevant. Muss kostenlos bleiben.

**Geprüfte Optionen:** Supabase Free, Neon Free, Aiven Free, selbst-gehostetes PostgreSQL auf der Oracle-VM

**Entscheidung:** postgres:16-alpine als Container auf der VM betreiben, statt Aivens verwaltetes Free-Tier-Postgres zu nutzen.

**Warum:** Die Aiven-Integration ist auf V2 verschoben. V1 auf einer VM selbst-enthalten zu halten, reduziert bewegliche Teile während des ersten Deployments.

**Begründung:** Aiven hat seinen Hauptsitz in Finnland (EU-Gesellschaft, keine CLOUD-Act-Exposition auf der Aiven-Ebene). Positioniert das Projekt als GDPR-bewusste Infrastruktur — ein direktes Signal an deutsche IT-Personalchefs. SQLite abgelehnt: dateibasiert, kein Cross-Deployment-Sharing, Schreibkonflikte unter Demo-Last.

**Folgen:** Backups sind jetzt vollständig unsere Verantwortung (siehe `BACKUP-WIEDERHERSTELLUNG.md`) — kein Sicherheitsnetz eines Managed-Providers. In V2 erneut prüfen.
Für V2: Subprozessor ist DigitalOcean (Hauptsitz USA). Dokumentiert in PRIVACY.md. sslmode=require verpflichtend — Verbindungszeichenfolge nutzt ssl=require mit asyncpg-Treiber. Free-Instanz stoppt nach Inaktivität — GitHub-Actions-Keep-Alive-Cron erforderlich.

---

## ADR-005 — Passwort-Generierung: secrets-Modul (nicht random)

**Datum:** Projektstart
**Status:** Akzeptiert

**Kontext:** Das Backend generiert temporäre Passwörter für neue Mitarbeiter während des Onboardings.

**Entscheidung:** Ausschließlich Pythons `secrets`-Modul.

**Begründung:** `secrets` nutzt den OS-Entropie-Pool (CSPRNG). `random` ist ein PRNG mit deterministischem Seed — unter bestimmten Bedingungen vorhersagbar. Das ist die erste Zeile, die ein sicherheitsbewusster Interviewer prüft. Passwörter werden niemals in der Datenbank oder in Logs gespeichert. Gesetzt über Microsoft Graph PATCH /users/{id} und einmalig in der API-Antwort zurückgegeben.

**Folgen:** Keine — das secrets-Modul ist Stdlib, null Abhängigkeiten.

---

## ADR-006 — Audit-Log: von Hand gebaut (nicht django-auditlog)

**Datum:** Projektstart
**Status:** Akzeptiert

**Kontext:** GDPR-Compliance erfordert einen unveränderlichen Datensatz, wer was mit wessen Daten gemacht hat.

**Entscheidung:** Eigenes AuditLog-SQLAlchemy-Modell mit einem PostgreSQL-Trigger, der bei UPDATE oder DELETE eine Ausnahme auslöst.

**Begründung:** Eine Bibliothek, die der Kandidat nicht vollständig erklären kann, ist in einem technischen Gespräch eine Belastung. Das handgebaute Audit-Log ist 40 Zeilen Code. Der Kandidat kann jede Zeile erklären: die JSONB-Nutzlast, den Append-Only-Trigger, das Akteur/Aktion/Ziel-Schema, die Rechtsgrundlage unter Artikel 5 Abs. 2 GDPR (Rechenschaftspflicht).

**Folgen:** Keine automatische Verdrahtung — jede mutierende Route muss explizit die audit_logger-Abhängigkeit injizieren. Das ist ein Feature: Der explizite Aufruf macht den Audit-Pfad im Code-Review sichtbar.

---

## ADR-007 — n8n im nicht-kritischen Pfad (Fire-and-Continue)

**Datum:** Projektstart
**Status:** Akzeptiert

**Kontext:** n8n übernimmt Willkommens-E-Mail und Jira-Ticket-Erstellung nach dem Onboarding.

**Entscheidung:** FastAPI feuert den n8n-Webhook als BackgroundTask (nicht-blockierend). Wenn n8n fehlschlägt, ist das Onboarding teilweise erfolgreich und der Teilfehler wird geloggt.

**Begründung:** n8n ist Benachrichtigungs-Infrastruktur, keine Onboarding-Kernlogik. Der Benutzer existiert in OpenLDAP, unabhängig davon, ob die Willkommens-E-Mail gesendet wurde. Das Onboarding von n8n-Verfügbarkeit abhängig zu machen, erzeugt einen fragilen kritischen Pfad für einen Free-Tier-Self-Hosted-Dienst.

**Folgen:** Willkommens-E-Mail-Zustellung ist letztlich konsistent, nicht synchron. httpx-Timeout von 5 Sekunden verhindert hängende Requests.

---

## ADR-008 — UI-Komponentenbibliothek: shadcn/ui
**Datum:** Projektstart
**Status:** Akzeptiert
**Kontext:** Das Frontend braucht einen professionellen, zugänglichen und wartbaren Komponentensatz, der sauber mit Next.js 15 App Router, TypeScript und Tailwind CSS unter Null-Kosten-Beschränkungen funktioniert.
**Entscheidung:** shadcn/ui nutzen (Radix-Primitives + Tailwind). Komponenten werden in das Repository kopiert und gehören dem Projekt vollständig.
**Begründung:**
- Volle Quell-Eigentümerschaft und Auditierbarkeit
- Exzellente Barrierefreiheit über Radix
- Null Runtime-CSS-in-JS-Overhead
- Minimale Bundle-Größe
- Perfekte Passung zum gewählten Stack
- Demonstriert höhere Engineering-Reife als schwere Design-Systeme
**Folgen:**
- Komponenten leben im Repo und müssen bewusst gepflegt werden
- Erst-Setup ist etwas höher als bei MUI/Chakra
- Langfristige Flexibilität und Kontrolle sind deutlich besser

---

## ADR-009 — Plattform-Benutzer-Bootstrapping & Bereitstellung (auf V3 verschoben)
**Datum:** ...
**Status:** Akzeptiert

**Kontext:** Das System braucht mindestens einen authentifizierten Operator, um das Dashboard zu demonstrieren und Onboarding auszulösen. Folgende Operatoren sollten über denselben geregelten Onboarding-Prozess erstellt werden, nicht über eine separate Admin-Oberfläche.

**Entscheidung:**
1. Der erste Plattform-Administrator wird ausschließlich über Datenbank-Seed erstellt (einmalig beim ersten Deployment / lokalen Setup). Dieser Seed-Benutzer hat die höchste privilegierte Rolle (`admin`).
2. Wenn das Onboarding-Formular mit einer Rolle aus dem Operator-Set abgeschickt wird (`IT Support`, `HR`, `System Administrator`), macht die FastAPI-Kontrollebene:
   - Erstellt die simulierte Organisations-Identität (Samba-Gruppen, temporäres Passwort usw.) wie gewohnt.
   - **Zusätzlich** erstellt sie ein entsprechendes Plattform-Benutzerkonto mit einer eingeschränkten Rolle (`operator` oder `viewer` gemäß Richtlinie).
   - Gewährt niemals `platform_admin` über den automatisierten Pfad.
3. Die Plattform-Benutzererstellung ist ein expliziter, auditierter Schritt innerhalb der FastAPI-Transaktion / Saga, kein versteckter Nebeneffekt in n8n.
4. Das temporäre Passwort für das Plattform-Konto wird über denselben sicheren Kanal wie das Organisations-Konto geliefert (oder einen separaten Einmal-Link). Das Passwort wird nach der ersten Setzung niemals im Klartext gespeichert.

**Begründung:**
- Löst das Bootstrap-Problem sauber.
- Hält den Onboarding-Flow als einzige Wahrheitsquelle für Identität.
- Demonstriert Least Privilege: Nur der Seed-Benutzer ist `platform_admin`; alle folgenden Operatoren werden mit reduzierten Rechten erstellt.
- Bewahrt volle Auditierbarkeit und Korrelations-IDs über beide Identitäts-Domänen hinweg.

**Folgen:**
- Die Rolle-zu-Plattform-Berechtigung-Zuordnung muss in der Konfiguration definiert werden (nicht hardcodiert).
- Ein optionales Freigabe-Gate kann später vor der Plattform-Benutzererstellung eingefügt werden, ohne den Flow neu zu gestalten.
- Das Seed-Skript muss als einmalige, destruktive Operation dokumentiert werden, die nach dem ersten Setup niemals in einer geteilten Demo-Umgebung läuft.

---

*Füge Einträge hinzu, während du baust. Jede bedeutende Entscheidung — auch solche, die du zurücknimmst — gehört hierher.*
