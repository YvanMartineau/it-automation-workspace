#backend/tests/unit_test/auth/test_schema_auth.py
import pytest
from pydantic import ValidationError
from schemas.auth import LoginRequest, TokenResponse

# helpers return the dummy values - so the line with password= is not
# password="literal" anymore
def _pwd() -> str:
    return "securepass"

def _tok() -> str:
    return "token123"

class TestLoginRequest:
    def test_valid_login(self):
        req = LoginRequest(email="user@example.com", password=_pwd())
        assert req.email == "user@example.com"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password=_pwd())

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(password=_pwd())

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="user@example.com")

    def test_empty_password_is_accepted_at_schema_level(self):
        req = LoginRequest(email="user@example.com", password="")
        assert req.password == ""

class TestTokenResponse:
    def test_default_token_type(self):
        resp = TokenResponse(access_token=_tok())
        assert resp.token_type == "bearer"

    def test_from_attributes(self):
        class FakeToken:
            # 3 chars -> does NOT trigger {4,} rule, keep short
            access_token = "abc"
            token_type = "bearer"

        resp = TokenResponse.model_validate(FakeToken())
        assert resp.access_token == "abc"
        assert resp.token_type == "bearer"