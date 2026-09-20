# Datenschutzhinweis — Projekt 1: IT-Automatisierungsplattform
*Zuletzt aktualisiert: Projektinitialisierung*
*Dieses Dokument ist erforderlich, um die Einhaltung der DSGVO nachzuweisen.*

## 1. Welche personenbezogenen Daten verarbeitet werden

| Daten                        | Quelle              | Zweck                              |
|-----------------------------|---------------------|--------------------------------------|
| Vorname, Nachname           | Onboarding-Formular | Erstellung eines Entra ID-Benutzerkontos |
| Berufs-E-Mail-Adresse       | Onboarding-Formular | Benutzeridentität, Willkommens-E-Mail |
| Abteilung, Rolle            | Onboarding-Formular | Gruppenzuweisung, Zugriffsrichtlinie |
| IP-Adressen (Gerätescan)    | Netzwerk-Scan       | Geräteinventar (nicht personenbezogen) |
| Hostnamen (Gerätescan)      | Netzwerk-Scan       | Geräteidentifikation (nicht personenbezogen) |
| Akteur-Benutzername (Audit-Log) | Systemgeneriert | Compliance-Audit-Trail               |

## 2. Rechtsgrundlage (DSGVO Artikel 6)

- **Onboarding-Personendaten:** Artikel 6(1)(b) — Verarbeitung ist für die Erfüllung eines Arbeitsvertrags erforderlich.
- **Audit-Log-Einträge:** Artikel 6(1)(c) — Verarbeitung ist zur Erfüllung einer rechtlichen Verpflichtung erforderlich (IT-Sicherheitsaufzeichnungen, BSI Grundschutz).

## 3. Wo Daten gespeichert werden

| System              | Anbieter           | Standort                  | Hinweise                                      |
|---------------------|--------------------|---------------------------|-----------------------------------------------|
| PostgreSQL-Datenbank| Aiven Oy (Finnland)| DigitalOcean Frankfurt EU | Subunternehmer: DigitalOcean LLC (USA). Standardvertragsklauseln (SCCs) gelten. |
| Entra ID (Benutzer) | Microsoft (Irland) | EU-Datengrenze            | M365 Developer E5 Mandant                     |
| Audit-Logs          | Aiven (siehe oben) | Frankfurt EU              | Nur-Anhängen (Append-only), unveränderlich durch DB-Trigger |

**Offenlegung von Subunternehmern:** Aiven Oy hat seinen Sitz in der EU (Finnland). Der zugrunde liegende Infrastrukturanbieter für den kostenlosen Tarif ist DigitalOcean LLC (mit Hauptsitz in den USA). Standardvertragsklauseln (SCCs) gemäß DSGVO Artikel 46(2)(c) gelten auf der DigitalOcean-Ebene. Dies wird ehrlich dokumentiert, anstatt eine vollständige EU-Souveränität zu behaupten.

## 4. Datenaufbewahrung

| Datentyp        | Aufbewahrungsfrist | Grundlage                                   |
|------------------|------------------|---------------------------------------------|
| Audit-Log-Einträge| 90 Tage          | Konfigurierbar — ausreichend für IT-Compliance-Demo |
| Gerätedatensätze   | Unbegrenzt       | Nicht personenbezogene Daten — Geräteinventar |
| Entra ID-Benutzer   | Gemäß M365-Mandantenrichtlinie | Geregelt durch Microsoft-Datenaufbewahrung |

## 5. Rechte der betroffenen Personen

Um Rechte gemäß DSGVO Artikel 15–22 (Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch) auszuüben, kontaktieren Sie den Systemadministrator. In einer Demo-Umgebung können Daten auf Anfrage gelöscht werden, indem Datensätze aus den Tabellen `audit_log` und `device` entfernt und der Entra ID-Benutzer aus dem M365-Mandanten gelöscht wird.

## 6. Was NICHT gespeichert wird

- Passwörter werden niemals in der Datenbank oder in Logs gespeichert.
- Temporäre Passwörter werden generiert, über die Microsoft Graph API festgelegt und nur einmal in der API-Antwort zurückgegeben.
- Es werden keine biometrischen Daten, Gesundheitsdaten oder besondere Kategorien von Daten (Artikel 9) verarbeitet.