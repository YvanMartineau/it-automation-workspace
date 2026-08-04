# auth_service.py
"""
Authentication business logic.

Routers call into this module; it owns credential verification,
timing-attack mitigation, and token issuance. Deliberately HTTP-agnostic —
this module raises plain exceptions, and routers translate them into the
appropriate HTTPException. That separation is what makes authenticate_user()
and rotate_access_token() testable with a plain AsyncSession fixture, with
no FastAPI request/response objects involved.
"""

from uuid import UUID

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from middleware.audit_middleware import write_audit_log
from models.user import User
from security.jwt_handler import TokenError, create_access_token, create_refresh_token, decode_token
from security.password_hashing import verify_password

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
    Writes an audit entry for both the failure and success path.
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

    Stateless: the refresh token itself is not re-issued, checked against,
    or stored anywhere server-side. Any failure mode (missing sub, wrong
    token type, expired signature, unknown/inactive user) converges to a
    single InvalidRefreshTokenError so the router can return one clean 401.

    decode_token() raises TokenError (HTTP-agnostic — see jwt_handler.py)
    on any validation failure; this service catches that specific type
    rather than a bare Exception, so a genuine bug elsewhere in this
    function won't get silently mislabeled as "invalid refresh token".
    """
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except TokenError as err:
        raise InvalidRefreshTokenError() from err

    try:
        user_id = UUID(payload.sub)
    except ValueError as err:
        raise InvalidRefreshTokenError() from err

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise InvalidRefreshTokenError()

    return create_access_token(user.id)