# Privacy Notice — Project 1: IT Automation Platform
*Last updated: project initialisation*
*This document is required for GDPR compliance demonstration.*

## 1. What personal data is processed

| Data                        | Source              | Purpose                              |
|-----------------------------|---------------------|--------------------------------------|
| First name, last name       | Onboarding form     | Create Entra ID user account         |
| Work email address          | Onboarding form     | User identity, welcome email         |
| Department, role            | Onboarding form     | Group assignment, access policy      |
| IP addresses (device scan)  | Network scan        | Device inventory (non-personal)      |
| Hostnames (device scan)     | Network scan        | Device identification (non-personal) |
| Actor username (audit log)  | System generated    | Compliance audit trail               |

## 2. Legal basis (GDPR Article 6)

- **Onboarding personal data:** Article 6(1)(b) — processing necessary for the performance of an employment contract
- **Audit log records:** Article 6(1)(c) — processing necessary for compliance with a legal obligation (IT security records, BSI Grundschutz)

## 3. Where data is stored

| System              | Provider           | Location                  | Notes                                      |
|---------------------|--------------------|---------------------------|--------------------------------------------|
| PostgreSQL database | Aiven Oy (Finland) | DigitalOcean Frankfurt EU | Sub-processor: DigitalOcean LLC (USA). SCCs apply. |
| Entra ID (users)    | Microsoft (Ireland)| EU data boundary          | M365 Developer E5 tenant                   |
| Audit logs          | Aiven (see above)  | Frankfurt EU              | Append-only, immutable by DB trigger       |

**Sub-processor disclosure:** Aiven Oy is EU-incorporated (Finland). The underlying infrastructure provider for the free tier is DigitalOcean LLC (USA-headquartered). Standard Contractual Clauses (SCCs) per GDPR Article 46(2)(c) apply at the DigitalOcean layer. This is documented honestly rather than claiming full EU sovereignty.

## 4. Data retention

| Data type        | Retention period | Basis                                   |
|------------------|------------------|-----------------------------------------|
| Audit log entries| 90 days          | Configurable — sufficient for IT compliance demo |
| Device records   | Indefinite       | Non-personal data — device inventory    |
| Entra ID users   | Per M365 tenant policy | Governed by Microsoft data retention |

## 5. Data subject rights

To exercise rights under GDPR Articles 15–22 (access, rectification, erasure, restriction, portability, objection), contact the system administrator. For a demo environment, data can be deleted on request by removing records from the audit_log and device tables and deleting the Entra ID user from the M365 tenant.

## 6. What is NOT stored

- Passwords are never persisted in the database or logs
- Temporary passwords are generated, set via Microsoft Graph API, and returned once in the API response only
- No biometric data, health data, or special category data (Article 9) is processed
