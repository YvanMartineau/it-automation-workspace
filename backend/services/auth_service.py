# auth_service.py
"""
Authentication business logic.

Routers call into this module; it owns credential verification,
timing-attack mitigation, token issuance, and logging (split across two
sinks — see rotate_access_token() for why). Deliberately HTTP-agnostic —
this module raises plain exceptions, and routers translate them into the
appropriate HTTPException. That separation is what makes every function
here testable with a plain AsyncSession fixture, with no FastAPI
request/response objects involved.
"""

import logging
from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from middleware.audit_middleware import write_audit_log
from models.user import User
from security.jwt_handler import TokenError, create_access_token, create_refresh_token, decode_token
from security.password_hashing import verify_password

# Separate from "sysops.audit" (used by write_audit_log / audit_middleware)
# on purpose: this logger carries high-frequency session telemetry, not
# compliance-grade events. Keeping the logger names distinct means log
# aggregation/alerting rules can target one without the other by name,
# without having to parse the message body to tell them apart.
logger = logging.getLogger("sysops.security")

# Pre-computed bcrypt hash used to keep password verification timing constant
# whether or not the email exists. Prevents user-enumeration via response timing.
DUMMY_HASH = "$2b$12$eA3Vqb3j0zQ4yY1hZ.vQ7.bH9.3b3j0zQ4yY1hZ.vQ7.bH9.3b3j0"


class InvalidCredentialsError(Exception):
    """Raised when email/password do not match an active user."""


class InvalidRefreshTokenError(Exception):
    """Raised when a refresh token is missing, malformed, expired, or belongs to an inactive/unknown user."""


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    """
    Verify credentials and return the matching active user.

    Always performs a password hash comparison, even for unknown emails,
    so response timing doesn't leak whether an account exists.

    actor on the failure path is the *attempted* email from the request
    body, not a resolved User — at that point we don't know a matching
    account exists. Treat 'auth.login.failed' rows as an unverified claim
    ("someone claiming to be X tried and failed"), never as proof X did
    anything.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    target_hash = user.hashed_password if user is not None else DUMMY_HASH
    is_valid = await run_in_threadpool(verify_password, password, target_hash)

    if user is None or not is_valid or not user.is_active:
        await write_audit_log(db, actor=email, action="auth.login.failed")
        raise InvalidCredentialsError()

    await write_audit_log(db, actor=user.email, action="auth.login")
    return user


def issue_token_pair(user: User) -> tuple[str, str]:
    """Return (access_token, refresh_token) for an authenticated user."""
    return create_access_token(user.id), create_refresh_token(user.id)


async def rotate_access_token(db: AsyncSession, refresh_token: str) -> str:
    """
    Validate a refresh token and issue a fresh access token.

    Logging is deliberately split across two sinks — success and failure
    are not the same kind of event and don't belong in the same place:

      - Success ('auth.refresh'): happens ~every 15 min per active
        session by design (access token TTL), touches no resource
        (there's no target_type/target_id for it — it's pure session
        mechanics), and is routine. Goes to the structured JSON
        application log only, NOT the audit_log DB table, so it can't
        drown out the low-frequency, target-bearing compliance events
        when GET /audit-logs is queried — and it saves a DB write on
        the free-tier Aiven instance every 15 min per active session.
      - Failure ('auth.refresh.failed'): naturally low-frequency and
        security-significant. An expired token is the normal/boring
        case; a token that decodes fine but carries a malformed claim
        or an unknown user_id is a stronger signal (possible tampering
        or replay of an old/revoked token). Written to the append-only
        audit_log DB table, same tier as auth.login.failed.

    Actor resolution on each failure branch uses the most trustworthy
    label available at that point (see inline comments) — none of these
    are verified identities, same caveat as authenticate_user().
    """
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except TokenError as err:
        # No payload at all — could be an ordinary expiry (common) or a
        # malformed/forged token (rare). Can't distinguish without a
        # payload, so actor stays "unknown".
        await write_audit_log(db, actor="unknown", action="auth.refresh.failed")
        raise InvalidRefreshTokenError() from err

    try:
        user_id = UUID(payload.sub)
    except ValueError as err:
        # Signature verified, but the claim inside a validly-signed token
        # is malformed — a stronger signal than a bare expiry. Logged
        # with the raw, unresolved claim since it doesn't map to a real id.
        await write_audit_log(db, actor=payload.sub, action="auth.refresh.failed")
        raise InvalidRefreshTokenError() from err

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        await write_audit_log(db, actor=str(user_id), action="auth.refresh.failed")
        raise InvalidRefreshTokenError()

    if not user.is_active:
        await write_audit_log(db, actor=user.email, action="auth.refresh.failed")
        raise InvalidRefreshTokenError()

    # Success path: structured log only — deliberately not write_audit_log().
    logger.info(
        "AUTH REFRESH SUCCESS",
        extra={"actor": user.email, "action": "auth.refresh"},
    )
    return create_access_token(user.id)


async def record_logout(db: AsyncSession, access_token: str | None) -> None:
    """
    Best-effort audit entry for logout. Never raises.

    Logout must always succeed — clearing the cookie has no auth
    precondition, and the common real-world case is a client with an
    already-expired 15-minute access token clicking logout. Degrades to
    actor="unknown" on any failure (missing token, bad/expired token,
    even a DB hiccup during the email lookup) rather than propagate — a
    broad `except Exception` is used deliberately here, unlike the typed
    catches elsewhere in this module, because every failure mode here has
    the same handling: log "unknown" and move on. It's scoped tightly to
    resolving one optional label, never to the write itself or to control
    flow.

    Unlike refresh, logout is written to the audit_log DB table
    unconditionally — it's a clean, low-frequency, session-lifecycle
    bookend, not routine session mechanics.
    """
    actor = "unknown"
    try:
        if access_token is not None:
            payload = decode_token(access_token, expected_type="access")
            user_id = UUID(payload.sub)
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            actor = user.email if user is not None else str(user_id)
    except Exception:
        pass

    await write_audit_log(db, actor=actor, action="auth.logout")