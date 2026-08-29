import pytest
from pydantic import ValidationError
from schemas.auth import LoginRequest, TokenResponse


TEST_PASSWORD = "securepass" # noqa: S106 # nosec
TEST_ACCESS_TOKEN = "abc" # noqa: S106 # nosec
TEST_DEFAULT_TOKEN_TYPE = "bearer" # noqa: S106 # nosec
TEST_TOKEN = "token123" # noqa: S106 # nosec


class TestLoginRequest:
    def test_valid_login(self):
        req = LoginRequest(email="user@example.com", password=TEST_PASSWORD)
        assert req.email == "user@example.com"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password=TEST_PASSWORD)

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(password=TEST_PASSWORD)

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="user@example.com")

    def test_empty_password_is_accepted_at_schema_level(self):
        req = LoginRequest(email="user@example.com", password="")
        assert req.password == ""


class TestTokenResponse:
    def test_default_token_type(self):
        resp = TokenResponse(access_token=TEST_TOKEN)
        assert resp.token_type == TEST_DEFAULT_TOKEN_TYPE

    def test_from_attributes(self):
        class FakeToken:
            access_token = TEST_ACCESS_TOKEN
            token_type = TEST_DEFAULT_TOKEN_TYPE

        resp = TokenResponse.model_validate(FakeToken())
        assert resp.access_token == TEST_ACCESS_TOKEN
        assert resp.token_type == TEST_DEFAULT_TOKEN_TYPE
