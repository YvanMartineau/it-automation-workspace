"""
Unit tests for JWT creation/decoding and auth dependencies.

This file imports `backend/security/jwt_handler.py`, which in turn imports
`backend/db/engine.py` and `backend/models/user.py`. Those files are not yet
provided. Therefore this test file will raise ImportError until they are
added to the project.

Once available, run as usual:

    pytest backend/tests/unit_test/auth/test_jwt_handler.py
"""

import uuid
from datetime import UTC, datetime, timedelta
from enum import Enum

import pytest
from fastapi import HTTPException
from jose import jwt
from security.jwt_handler import (
    TokenExpiredError,
    TokenInvalidError,
    TokenPayload,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_admin_user,
    get_current_user,
)
from settings import get_settings


# -------------------------------
# Fixtures / helpers
# -------------------------------
class Role(Enum):
    ADMIN = "admin"
    VIEWER = "viewer"


class FakeUser:
    def __init__(self, id, role, email, is_active=True):
        self.id = id
        self.role = role
        self.email = email
        self.is_active = is_active


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def user():
    return FakeUser(
        id=uuid.uuid4(),
        role=Role.ADMIN,
        email="admin@example.com",
        is_active=True,
    )


@pytest.fixture
def access_token(user):
    return create_access_token(user)


@pytest.fixture
def refresh_token(user):
    return create_refresh_token(user.id)


# -------------------------------
# Token creation
# -------------------------------
class TestCreateTokens:
    def test_create_access_token_has_expected_claims(self, user):
        token = create_access_token(user)
        payload = jwt.decode(token, get_settings().JWT_SECRET_KEY, algorithms=["HS256"])
        assert payload["sub"] == str(user.id)
        assert payload["type"] == "access"
        assert payload["role"] == "admin"
        assert payload["email"] == user.email
        assert "exp" in payload

    def test_create_refresh_token_has_no_role_or_email(self, user):
        token = create_refresh_token(user.id)
        payload = jwt.decode(token, get_settings().JWT_SECRET_KEY, algorithms=["HS256"])
        assert payload["sub"] == str(user.id)
        assert payload["type"] == "refresh"
        assert "role" not in payload
        assert "email" not in payload


# -------------------------------
# Token decoding
# -------------------------------
class TestDecodeToken:
    def test_decode_access_token(self, access_token):
        payload = decode_token(access_token, expected_type="access")
        assert isinstance(payload, TokenPayload)
        assert payload.token_type == "access"

    def test_decode_refresh_token(self, refresh_token):
        payload = decode_token(refresh_token, expected_type="refresh")
        assert payload.token_type == "refresh"

    def test_wrong_token_type_raises_invalid(self, access_token):
        with pytest.raises(TokenInvalidError):
            decode_token(access_token, expected_type="refresh")

    def test_expired_token_raises_expired(self, user):
        expired_token = create_access_token(user)
        # Manually craft an expired token using jose for control
        now = datetime.now(UTC)
        payload = {
            "sub": str(user.id),
            "type": "access",
            "iat": now - timedelta(days=1),
            "exp": now - timedelta(minutes=1),
            "role": "admin",
            "email": user.email,
        }
        token = jwt.encode(payload, get_settings().JWT_SECRET_KEY, algorithm="HS256")
        with pytest.raises(TokenExpiredError):
            decode_token(token, expected_type="access")

    def test_malformed_token_raises_invalid(self):
        with pytest.raises(TokenInvalidError):
            decode_token("garbage.token.string", expected_type="access")

    def test_missing_sub_raises_invalid(self):
        payload = {
            "type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        }
        token = jwt.encode(payload, get_settings().JWT_SECRET_KEY, algorithm="HS256")
        with pytest.raises(TokenInvalidError):
            decode_token(token, expected_type="access")

    def test_missing_type_raises_invalid(self):
        payload = {
            "sub": "some-uuid",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        }
        token = jwt.encode(payload, get_settings().JWT_SECRET_KEY, algorithm="HS256")
        with pytest.raises(TokenInvalidError):
            decode_token(token, expected_type="access")


# -------------------------------
# get_current_user dependency
# -------------------------------
class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, user):
        from unittest.mock import AsyncMock

        fake_db = AsyncMock()
        with pytest.raises(HTTPException) as exc:
            await get_current_user(token=None, db=fake_db)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self, user):
        from unittest.mock import AsyncMock

        fake_db = AsyncMock()
        # Create expired token using pure jwt
        now = datetime.now(UTC)
        payload = {
            "sub": str(user.id),
            "type": "access",
            "iat": now - timedelta(days=1),
            "exp": now - timedelta(minutes=1),
        }
        token = jwt.encode(payload, get_settings().JWT_SECRET_KEY, algorithm="HS256")
        with pytest.raises(HTTPException) as exc:
            await get_current_user(token=token, db=fake_db)
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self):
        from unittest.mock import AsyncMock

        fake_db = AsyncMock()
        with pytest.raises(HTTPException) as exc:
            await get_current_user(token="invalid", db=fake_db)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_sub_returns_401(self):
        from unittest.mock import AsyncMock

        fake_db = AsyncMock()
        payload = {
            "sub": "not-a-uuid",
            "type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        }
        token = jwt.encode(payload, get_settings().JWT_SECRET_KEY, algorithm="HS256")
        with pytest.raises(HTTPException) as exc:
            await get_current_user(token=token, db=fake_db)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_user_not_found_returns_401(self, user):
        from unittest.mock import AsyncMock

        fake_db = AsyncMock()
        # Simulate db.execute returning result with scalar_one_or_none -> None
        result_mock = AsyncMock()
        result_mock.scalar_one_or_none.return_value = None
        fake_db.execute.return_value = result_mock

        token = create_access_token(user)
        with pytest.raises(HTTPException) as exc:
            await get_current_user(token=token, db=fake_db)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_inactive_user_returns_401(self, user):
        from unittest.mock import AsyncMock

        inactive_user = FakeUser(id=user.id, role=Role.ADMIN, email=user.email, is_active=False)
        fake_db = AsyncMock()
        result_mock = AsyncMock()
        result_mock.scalar_one_or_none.return_value = inactive_user
        fake_db.execute.return_value = result_mock

        token = create_access_token(user)
        with pytest.raises(HTTPException) as exc:
            await get_current_user(token=token, db=fake_db)
        assert exc.value.status_code == 401
        assert "inactive" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_success_returns_user(self, user):
        from unittest.mock import AsyncMock

        fake_db = AsyncMock()
        result_mock = AsyncMock()
        result_mock.scalar_one_or_none.return_value = user
        fake_db.execute.return_value = result_mock

        token = create_access_token(user)
        returned_user = await get_current_user(token=token, db=fake_db)
        assert returned_user.id == user.id
        assert returned_user.email == user.email


# -------------------------------
# get_admin_user dependency
# -------------------------------
class TestGetAdminUser:
    def test_non_admin_returns_403(self):
        viewer = FakeUser(id=uuid.uuid4(), role=Role.VIEWER, email="viewer@example.com")
        with pytest.raises(HTTPException) as exc:
            get_admin_user(current_user=viewer)
        assert exc.value.status_code == 403

    def test_admin_returns_user(self):
        admin = FakeUser(id=uuid.uuid4(), role=Role.ADMIN, email="admin@example.com")
        returned = get_admin_user(current_user=admin)
        assert returned.id == admin.id

    def test_enum_role_admin(self):
        admin = FakeUser(id=uuid.uuid4(), role=Role.ADMIN, email="admin@example.com")
        returned = get_admin_user(current_user=admin)
        assert returned == admin
