# backend/tests/unit_test/settings/test_settings.py
import pytest
from pydantic import ValidationError
from pydantic_settings import SettingsConfigDict
from settings import Settings, get_settings


@pytest.fixture(autouse=True)
def disable_env_file(monkeypatch):
    """Disable .env file loading for all tests by patching model_config."""
    # Patch the model_config directly on the Settings class
    original_config = Settings.model_config
    Settings.model_config = SettingsConfigDict(
        env_file=None,
        env_file_encoding=None,
        # Preserve other config options from original
        extra=original_config.get("extra", "ignore"),
        arbitrary_types_allowed=original_config.get("arbitrary_types_allowed", True),
    )
    yield
    # Restore original config after test
    Settings.model_config = original_config


@pytest.fixture(autouse=True)
def clear_settings_cache():
    """Clear the lru_cache before each test to prevent cross-test pollution."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class TestSettings:
    def test_requires_database_url(self, monkeypatch):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        # Ensure required secrets are present for a minimal valid instance
        monkeypatch.setenv("JWT_SECRET_KEY", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_ID", "id")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_SECRET", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_REFRESH_TOKEN", "refresh")
        monkeypatch.setenv("GMAIL_SENDER_ADDRESS", "sender@example.com")
        monkeypatch.setenv("IDENTITY_PROVIDER", "local")
        with pytest.raises(ValidationError):
            Settings()

    def test_requires_jwt_secret(self, monkeypatch):
        monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_ID", "id")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_SECRET", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_REFRESH_TOKEN", "refresh")
        monkeypatch.setenv("GMAIL_SENDER_ADDRESS", "sender@example.com")
        monkeypatch.setenv("IDENTITY_PROVIDER", "local")
        with pytest.raises(ValidationError):
            Settings()

    def test_default_jwt_algorithm(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        monkeypatch.setenv("JWT_SECRET_KEY", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_ID", "id")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_SECRET", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_REFRESH_TOKEN", "refresh")
        monkeypatch.setenv("GMAIL_SENDER_ADDRESS", "sender@example.com")
        monkeypatch.setenv("IDENTITY_PROVIDER", "local")
        settings = Settings()
        assert settings.JWT_ALGORITHM == "HS256"

    def test_default_access_token_expiry(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        monkeypatch.setenv("JWT_SECRET_KEY", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_ID", "id")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_SECRET", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_REFRESH_TOKEN", "refresh")
        monkeypatch.setenv("GMAIL_SENDER_ADDRESS", "sender@example.com")
        monkeypatch.setenv("IDENTITY_PROVIDER", "local")
        settings = Settings()
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 15

    def test_default_refresh_token_expiry(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        monkeypatch.setenv("JWT_SECRET_KEY", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_ID", "id")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_SECRET", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_REFRESH_TOKEN", "refresh")
        monkeypatch.setenv("GMAIL_SENDER_ADDRESS", "sender@example.com")
        monkeypatch.setenv("IDENTITY_PROVIDER", "local")
        settings = Settings()
        assert settings.REFRESH_TOKEN_EXPIRE_DAYS == 7

    def test_identity_provider_ldap_requires_password(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        monkeypatch.setenv("JWT_SECRET_KEY", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_ID", "id")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_SECRET", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_REFRESH_TOKEN", "refresh")
        monkeypatch.setenv("GMAIL_SENDER_ADDRESS", "sender@example.com")
        monkeypatch.setenv("IDENTITY_PROVIDER", "ldap")
        monkeypatch.delenv("LDAP_BIND_PASSWORD", raising=False)
        with pytest.raises(ValueError, match="LDAP_BIND_PASSWORD"):
            Settings()

    def test_identity_provider_local_no_ldap_password_needed(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        monkeypatch.setenv("JWT_SECRET_KEY", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_ID", "id")
        monkeypatch.setenv("GMAIL_OAUTH_CLIENT_SECRET", "secret")
        monkeypatch.setenv("GMAIL_OAUTH_REFRESH_TOKEN", "refresh")
        monkeypatch.setenv("GMAIL_SENDER_ADDRESS", "sender@example.com")
        monkeypatch.setenv("IDENTITY_PROVIDER", "local")
        settings = Settings()
        assert settings.IDENTITY_PROVIDER == "local"

    def test_gmail_required(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")
        monkeypatch.setenv("JWT_SECRET_KEY", "secret")
        monkeypatch.setenv("IDENTITY_PROVIDER", "local")
        # Missing all Gmail OAuth vars
        monkeypatch.delenv("GMAIL_OAUTH_CLIENT_ID", raising=False)
        monkeypatch.delenv("GMAIL_OAUTH_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("GMAIL_OAUTH_REFRESH_TOKEN", raising=False)
        monkeypatch.delenv("GMAIL_SENDER_ADDRESS", raising=False)
        with pytest.raises(ValidationError):
            Settings()
