"""
Centralised settings via pydantic-settings.
App will NOT start if any required env var is missing.
All secrets come from environment — never hardcoded.
"""
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE_PATH = Path(__file__).resolve().parent.parent / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE_PATH, extra="ignore")

    # Database
    DATABASE_URL: str
    DEV_DATABASE_URL: str = ""
    TEST_DATABASE_URL: str = ""

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Microsoft Graph
    #GRAPH_TENANT_ID: str
    #GRAPH_CLIENT_ID: str
    #GRAPH_CLIENT_SECRET: str
    #GRAPH_DEFAULT_GROUP_ID: str = ""

    # n8n
    #N8N_ONBOARDING_WEBHOOK_URL: str
    #N8N_WEBHOOK_TIMEOUT_SECONDS: int = 5

    # Gmail OAuth2
    #GMAIL_OAUTH_CLIENT_ID: str
    #GMAIL_OAUTH_CLIENT_SECRET: str
    #GMAIL_OAUTH_REFRESH_TOKEN: str
    #GMAIL_SENDER_ADDRESS: str
    #ADMIN_ALERT_EMAIL: str

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_SCAN_SUBNET: str = "192.168.1.0/24"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
