# core/logging_config.py
"""
Structured JSON logging setup.

Wires up the two application loggers used across the codebase:
  - "sysops.audit"    — core/exceptions.py (unhandled/DB errors) and
                         middleware/audit_middleware.py (audit-write
                         failures).
  - "sysops.security" — services/auth_service.py's high-frequency
                         session telemetry (auth.refresh success),
                         deliberately kept out of the audit_log DB
                         table — see rotate_access_token().

Without this, `extra={...}` kwargs passed to logger calls throughout the
codebase are silently dropped from output, and INFO-level calls don't
appear at all under Python logging's default WARNING root level.
"""

import logging
import sys

from pythonjsonlogger import jsonlogger

LOGGER_NAMES = ("sysops.audit", "sysops.security")


def setup_logging(level: int = logging.INFO) -> None:
    """
    Attach a JSON formatter + stdout handler to both application loggers.

    Idempotent: safe to call more than once (e.g. once from create_app()
    and once from a test fixture importing it separately) without
    duplicate handlers — repeated calls would otherwise double- or
    triple-log every event.

    Timestamps use whatever timezone the process runs in, NOT forced to
    UTC here. audit_log rows are stored as UTC (DateTime(timezone=True)
    + Postgres server default). If you ever need to correlate a
    security-log line (e.g. auth.refresh.failed context) against an
    audit_log row during an incident review, the container's TZ needs to
    be UTC too, or the timestamps won't line up — set TZ=UTC in the
    Docker Compose service rather than converting here, so every log
    source in the stack (uvicorn access logs included) agrees.
    """
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    for name in LOGGER_NAMES:
        logger = logging.getLogger(name)
        logger.setLevel(level)
        logger.propagate = False  # don't also bubble up to root's own handling
        if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
            logger.addHandler(handler)