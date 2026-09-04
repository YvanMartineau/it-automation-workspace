# auth.py
"""
Authentication endpoints:

POST /auth/login    — verify credentials, issue access token + refresh cookie
POST /auth/refresh  — exchange valid refresh cookie for new access token
POST /auth/logout   — clear refresh cookie (stateless: nothing to revoke server-side)

Per elite standard #4, this router does no credential verification, token
validation, audit-log writing, or security-log writing itself — that all
lives in services/auth_service.py. The router's job is strictly: parse
the HTTP request, call the service, translate the service's plain
exceptions into HTTPExceptions, manage the refresh cookie, and shape the
response.

DB errors (SQLAlchemyError) are not caught here — core/exceptions.py's
global handler converts any unhandled SQLAlchemyError to a 503. Catching
it again here would just duplicate that mapping in two places.
"""

from db.engine import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from schemas.auth import LoginRequest, TokenResponse
from security.rate_limiter import limiter
from services.auth_service import (
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    authenticate_user,
    issue_token_pair,
    record_logout,
    rotate_access_token,
)
from settings import get_settings
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()
router = APIRouter()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_refresh_cookie(response: Response, token: str) -> None:
    """
    Set the refresh token cookie with secure defaults.
    Cookie is HTTP-only, Secure, SameSite=Strict.

    NOT path-scoped to /auth (as it was before): the frontend calls this
    through a same-origin proxy (baseURL "/api", rewritten to the
    backend's root-mounted routes — see main.py, no /api prefix exists
    server-side). The browser decides whether to attach a cookie based on
    the REQUEST path it itself sent (/api/auth/refresh), never the
    backend's internal route after proxy rewriting. A cookie scoped to
    path="/auth" therefore never matches /api/auth/refresh and silently
    never gets sent back — this was causing every refresh to 401 with
    "Missing refresh token" regardless of anything client-side. Default
    path (root) sidesteps needing this file to know the proxy's exact
    rewrite rule at all. HttpOnly + Secure + SameSite=Strict already
    provide the real protection; path scoping here was a marginal
    optimization not worth the coupling.
    """
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",  # dev:samesite="strict" #prod:samesite="none"
        max_age=REFRESH_COOKIE_MAX_AGE,
    )


def _extract_bearer_token(request: Request) -> str | None:
    """
    Pull the raw token out of `Authorization: Bearer <token>`, if present.
    Pure header parsing — no decoding/validation, that's record_logout()'s
    job in the service layer.
    """
    auth_header = request.headers.get("authorization")
    if auth_header is None:
        return None
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


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

    Writes 'auth.login' on success and 'auth.login.failed' on failure —
    see authenticate_user() in auth_service.py for why the failure entry's
    actor is the attempted email rather than a resolved user.
    """
    try:
        user = await authenticate_user(db, body.email, body.password)
    except InvalidCredentialsError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from err

    access_token, refresh_token = issue_token_pair(user)
    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token)


@router.post(
    "/refresh", response_model=TokenResponse, summary="Exchange refresh cookie for new access token"
)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Exchange a valid refresh token cookie for a new access token.
    Stateless: refresh tokens are validated cryptographically, not stored server-side.

    Writes 'auth.refresh.failed' to the audit_log DB table on any
    rejection. A successful refresh is intentionally NOT written there —
    it goes to the structured JSON security log instead. See
    rotate_access_token()'s docstring in auth_service.py for the full
    reasoning (volume, no target resource, signal-to-noise on the
    compliance table).

    Note: a missing refresh cookie 401s here without calling the service
    at all, so it is not audited or security-logged either way — an
    absent cookie is the normal state for a logged-out client, not a
    security event.
    """
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    try:
        access_token = await rotate_access_token(db, refresh_token)
    except InvalidRefreshTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from err

    return TokenResponse(access_token=access_token)


@router.post(
    "/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Clear refresh token cookie"
)
@limiter.limit("60/minute")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    # in logout(): delete_cookie's path MUST match the path the cookie was
    # SET with, or the browser treats it as a different cookie and leaves
    # the original sitting there un-deleted. Keeping this in lockstep with
    # _set_refresh_cookie above rather than hardcoding independently.
    await record_logout(db, _extract_bearer_token(request))
    response.delete_cookie(key=REFRESH_COOKIE_NAME)
