"""auth router — implementation pending."""
"""
POST /auth/login    — verify credentials, issue access token + refresh cookie
POST /auth/refresh  — exchange valid refresh cookie for new access token
POST /auth/logout   — clear refresh cookie (stateless: nothing to revoke server-side)
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
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


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/auth",  # scope the cookie to auth endpoints only
    )


@router.post("/login", response_model=TokenResponse, summary="Log in with email and password")
@limiter.limit("60/minute")
async def login(
    request: Request,  # required by slowapi even though unused directly
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Deliberately identical error for "no such user" and "wrong password" —
    # distinguishing them lets an attacker enumerate valid emails.
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )

    if user is None or not verify_password(body.password, user.hashed_password):
        # TODO once AuditLog model exists: write_audit_log(actor=body.email, action="auth.login.failed")
        raise invalid_credentials

    if not user.is_active:
        raise invalid_credentials

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)

    # TODO once AuditLog model exists: write_audit_log(actor=user.email, action="auth.login")

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse, summary="Exchange refresh cookie for new access token")
@limiter.limit("60/minute")
async def refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    payload = decode_token(refresh_token, expected_type="refresh")

    from uuid import UUID
    user_id = UUID(payload.sub)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    access_token = create_access_token(user.id)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Clear refresh token cookie")
async def logout(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/auth")