# Project 1 backend performance tests

These are k6 scripts for TC-P1-P-001 through TC-P1-P-008.

## Environment

```bash
export BASE_URL=http://localhost:8000
export PERF_USER_EMAIL='admin@example.com'
export PERF_USER_PASSWORD='...'
```

The performance user must be an active admin.

### TC-P1-P-001

```bash
export SCAN_SUBNET='192.168.50.0/24'
k6 run backend/tests/performance_test/scan/test_asset_discovery.js
```

Use only a controlled RFC1918 test subnet. The application currently rate-limits `/scan` to 10/minute, so the 20-concurrent requirement will fail with 429 unless the performance environment has an explicitly documented rate-limit configuration.

The endpoint is asynchronous and returns `202 + job_id`; standard k6 measures the submission request here, not SSE job completion.

### TC-P1-P-002

```bash
k6 run backend/tests/performance_test/onboarding/test_onboarding.js
```

Optional:
```bash
export ONBOARDING_PAYLOAD='{"first_name":"Perf","last_name":"User","email":"test@example.invalid","department":"IT","job_title":"Performance Test User"}'
```

The endpoint is asynchronous. This measures request acceptance latency. Full workflow completion is exposed by SSE and is not measured by the standard k6 script.

Use dedicated LDAP/n8n/Gmail/JIRA test infrastructure; do not load-test production external services.

### TC-P1-P-003

```bash
k6 run backend/tests/performance_test/devices/test_dashboard.js
```

Target: 50 VUs, p95 < 500 ms, >=100 req/s, <1% errors.

### TC-P1-P-004

Seed at least 10,000 audit-log rows in the performance database, then:

```bash
k6 run backend/tests/performance_test/audit/test_audit_logs.js
```

### TC-P1-P-005

```bash
k6 run backend/tests/performance_test/database/test_connection_pool.js
```

The current SQLAlchemy configuration uses pool_size=5 and max_overflow=10, giving 15 maximum connections. Thirty VUs intentionally contend for that capacity.

### TC-P1-P-006

```bash
export SCAN_SUBNET='192.168.50.0/24'
k6 run backend/tests/performance_test/system/test_cpu_saturation.js
```

Monitor FastAPI and PostgreSQL CPU/memory during the test.

### TC-P1-P-007

```bash
k6 run backend/tests/performance_test/system/test_spike.js
```

### TC-P1-P-008

```bash
k6 run backend/tests/performance_test/system/test_endurance.js
```

For a short script validation, use `DURATION=2m`.

## Important

Run these against a dedicated performance environment. Do not scan arbitrary networks, onboard real employees, or load-test real third-party services.
