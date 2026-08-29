"""
Project 1 — IT Automation Platform
FastAPI application factory with lifespan, CORS, rate limiting,
and router registration. All business logic lives in routers/.
"""

import logging
from contextlib import asynccontextmanager

from core.exceptions import setup_exception_handlers
from core.logging_config import setup_logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import audit, auth, dashboard, devices, onboard, reports, scan
from security.rate_limiter import limiter
from services.scheduler import start_scheduler, stop_scheduler
from settings import get_settings
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

settings = get_settings()

logger = logging.getLogger(__name__)

# List of emails to receive the weekly report
WEEKLY_RECIPIENTS = "martineaubadou9@gmail.com"


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


def create_app() -> FastAPI:
    setup_logging()

    app = FastAPI(
        title="IT Automation Platform",
        description="Automated device management, onboarding, and reporting.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    setup_exception_handlers(app)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(devices.router, prefix="/devices", tags=["devices"])
    app.include_router(scan.router)
    app.include_router(onboard.router)
    app.include_router(reports.router)
    app.include_router(dashboard.router)
    app.include_router(audit.router, prefix="/audit-logs", tags=["audit"])

    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "ok", "env": settings.APP_ENV}

    return app


app = create_app()
