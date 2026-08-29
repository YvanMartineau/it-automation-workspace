# jwt_handler.py
"""
JWT creation, decoding, and auth dependencies.
Access tokens: short-lived (e.g. 15 min), sent via Authorization header, never persisted.
Refresh tokens: longer-lived (e.g. 7 days), sent via httpOnly cookie, never persisted server-side.
Stateless design — to "invalidate" a session, the client deletes the refresh cookie.

Layering note: decode_token() and _create_token() are pure token logic and
raise plain exceptions (TokenExpiredError / TokenInvalidError) — no FastAPI
or HTTPException in sight. That's what lets services/auth_service.py call
decode_token() directly and catch a specific, HTTP-agnostic exception type
instead of an HTTPException it then has to re-wrap or accidentally leak to
a caller. get_current_user() and get_admin_user() are FastAPI dependencies —
they legitimately live in the HTTP layer, so they're the only place in
this file that raises HTTPException.
"""

from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any
from uuid import UUID

from db.engine import get_db
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from models.user import User
from settings import get_settings
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()

# Points Swagger UI at /auth/login for the "Authorize" button.
# auto_error=False lets us return a controlled 401 instead of framework-generated errors.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


class TokenError(Exception):
    """Base class for JWT validation failures.

    Callers can catch this broadly or the specific subtypes below.
    """


class TokenExpiredError(TokenError):
    """Raised when a token's signature is valid but its exp claim has passed."""


class TokenInvalidError(TokenError):
    """Raised for malformed tokens, bad signatures, missing claims, or a token-type mismatch."""


class TokenPayload:
    """Decoded, validated claims — internal carrier, not a Pydantic model."""

    def __init__(self, sub: str, token_type: str, exp: int):
        self.sub = sub  # subject (user ID as str(UUID))
        self.token_type = token_type  # "access" or "refresh"
        self.exp = exp  # expiration as Unix timestamp (int)


def _create_token(
    subject: str,
    expires_delta: timedelta,
    token_type: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_access_token(user: User) -> str:
    """
    Access tokens carry role and email as extra claims, on top of the
    standard sub/type/iat/exp — the frontend (useAuth.ts / jwt.ts) decodes
    these client-side to populate its auth store without a second round
    trip. Both call sites (issue_token_pair on login, rotate_access_token
    on refresh) already have the full User loaded from the DB at the
    point they call this, so no extra query is introduced by requiring
    the full object here instead of just user.id.

    Role is read the same defensive way get_admin_user() already does
    (Enum-or-string), so a change to how models.user.User.role is typed
    doesn't require touching both places.
    """
    role_value = user.role.value if isinstance(user.role, Enum) else str(user.role)
    return _create_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
        extra_claims={"role": role_value, "email": user.email},
    )


def create_refresh_token(user_id: UUID) -> str:
    """
    Deliberately NOT given role/email claims. Refresh tokens are
    long-lived and only ever used to mint a new access token (see
    rotate_access_token) — they're never read for authorization
    decisions themselves, so there's no reason for them to carry data
    that can go stale (e.g. a role change) for up to
    REFRESH_TOKEN_EXPIRE_DAYS before it matters again.
    """
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh", # noqa: S106
    )


def decode_token(token: str, expected_type: str) -> TokenPayload:
    """
    Decode a JWT and enforce token type.

    Raises TokenExpiredError or TokenInvalidError on failure — never
    HTTPException. Any HTTP-facing caller (see get_current_user below) is
    responsible for catching these and mapping them to a status code;
    non-HTTP callers (e.g. auth_service.rotate_access_token) can catch
    them directly without importing FastAPI at all.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError as err:
        raise TokenExpiredError("Token has expired") from err
    except JWTError as err:
        raise TokenInvalidError("Could not validate credentials") from err

    sub: str | None = payload.get("sub")
    token_type: str | None = payload.get("type")
    exp: int | None = payload.get("exp")

    if not sub or token_type != expected_type:
        raise TokenInvalidError(f"Invalid token type. Expected '{expected_type}'")

    return TokenPayload(sub=sub, token_type=token_type, exp=exp or 0)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency to resolve the current authenticated user from an access token.
    Enforces active status and hides internal lookup details behind 401.
    This is the HTTP boundary: TokenError from decode_token() is caught
    here and turned into a controlled 401 response.
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token, expected_type="access")
    except TokenExpiredError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err
    except TokenInvalidError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err

    try:
        user_id = UUID(payload.sub)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        ) from err

    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
    except SQLAlchemyError as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable during user resolution",
        ) from err

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive",
        )

    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency enforcing admin-only access.
    Handles both Enum-based and string-based role representations.
    """
    role_value = (
        current_user.role.value
        if isinstance(current_user.role, Enum)
        else str(current_user.role)
    )

    if role_value.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user

