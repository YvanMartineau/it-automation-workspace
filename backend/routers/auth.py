# auth.py
"""
Authentication endpoints:

POST /auth/login    — verify credentials, issue access token + refresh cookie
POST /auth/refresh  — exchange valid refresh cookie for new access token
POST /auth/logout   — clear refresh cookie (stateless: nothing to revoke server-side)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_db
from models.user import User
from schemas.auth import LoginRequest, TokenResponse
from security.jwt_handler import create_access_token, create_refresh_token, decode_token
from security.password_hashing import verify_password
from security.rate_limiter import limiter
from settings import get_settings

settings = get_settings()
router = APIRouter()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

# Dummy hash used to mitigate timing attacks when a user is not found in the DB.
# Pre-computed bcrypt hash for standard execution timing consistency.
DUMMY_HASH = "$2b$12$eA3Vqb3j0zQ4yY1hZ.vQ7.bH9.3b3j0zQ4yY1hZ.vQ7.bH9.3b3j0"


def _set_refresh_cookie(response: Response, token: str) -> None:
    """
    Set the refresh token cookie with secure defaults.
    Cookie is HTTP-only, Secure, SameSite=Strict, and scoped to /auth.
    """
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/auth",
    )


@router.post("/login", response_model=TokenResponse, summary="Log in with email and password")
@limiter.limit("30/minute")
async def login(
    request: Request,  # required by slowapi even though unused directly
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate a user using email + password.
    Returns a short-lived access token and sets a secure refresh cookie.
    """
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )

    try:
        result = await db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()
    except SQLAlchemyError as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable during authentication",
        ) from err

    # Constant-time computation: Always run password verification even if user doesn't exist.
    target_hash = user.hashed_password if user is not None else DUMMY_HASH
    is_password_valid = await run_in_threadpool(verify_password, body.password, target_hash)

    if user is None or not is_password_valid:
        # TODO: write_audit_log(actor=body.email, action="auth.login.failed")
        raise invalid_credentials

    if not user.is_active:
        raise invalid_credentials

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)

    # TODO: write_audit_log(actor=user.email, action="auth.login")
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse, summary="Exchange refresh cookie for new access token")
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Exchange a valid refresh token cookie for a new access token.
    Stateless: refresh tokens are validated cryptographically, not stored server-side.
    """
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = UUID(payload.sub)

    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
    except SQLAlchemyError as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable during token refresh",
        ) from err

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    access_token = create_access_token(user.id)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Clear refresh token cookie")
@limiter.limit("60/minute")
async def logout(request: Request, response: Response) -> None:
    """
    Log out by clearing the refresh token cookie.
    Stateless: access tokens simply expire; no server-side revocation list.
    """
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/auth")
