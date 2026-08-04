"""JWT token creation, decoding, and get_current_user dependency."""
"""
JWT creation, decoding, and auth dependencies.
Access tokens: short-lived (15 min), sent via Authorization header, never persisted.
Refresh tokens: long-lived (7 days), sent via httpOnly cookie, never persisted server-side.
Stateless design — to "invalidate" a session, the client deletes the refresh cookie.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from enum import Enum

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.engine import get_db
from models.user import User
from settings import get_settings

settings = get_settings()

# Points Swagger UI at /auth/login for the "Authorize" button.
# We don't use OAuth2PasswordRequestForm — just reuse this for token extraction.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False) #auto_error=False means that if the token is not provided, it will return None instead of raising an error. This allows us to handle the case where the user is not authenticated and provide a custom error message.

#Describes the payload of the decoded JWT token.
class TokenPayload:
    """Decoded, validated claims — not a Pydantic model, just an internal carrier."""
    def __init__(self, sub: str, token_type: str, exp: int):
        self.sub = sub  #the subject of the token, usually the user ID (str(UUID))
        self.token_type = token_type    #"access" or "refresh" — prevents token-type confusion
        self.exp = exp  #the expiration time of the token, as a Unix timestamp (int)


def _create_token(subject: str, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,          # user id (str(UUID))
        "type": token_type,      # "access" | "refresh" — prevents token-type confusion
        "iat": now,              # issued at (datetime)
        "exp": now + expires_delta, # expiration time (datetime) what is timedelta? it is the difference between two datetime objects, representing a duration of time
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: UUID) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def decode_token(token: str, expected_type: str) -> TokenPayload:
    """Decodes token and raises granular 401 exceptions on failures."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub: str | None = payload.get("sub")
    token_type: str | None = payload.get("type")
    exp: int | None = payload.get("exp")

    if not sub or token_type != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type. Expected '{expected_type}'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenPayload(sub=sub, token_type=token_type, exp=exp or 0)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db=Depends(get_db),
) -> User:
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token, expected_type="access")

    try:
        user_id = UUID(payload.sub)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none() #scalar_one_or_none() returns the first result of the query, or None if no results were found. If more than one result is found, it raises an exception. This is useful for queries that are expected to return at most one result, such as looking up a user by their unique ID.

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")

    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Robust admin check handling both raw string values and Python/SQLAlchemy Enums."""
    role_value = current_user.role.value if isinstance(current_user.role, Enum) else str(current_user.role)
    
    if role_value.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user