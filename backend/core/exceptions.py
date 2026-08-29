# exceptions.py
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("sysops.audit")


def setup_exception_handlers(app: FastAPI) -> None:
    """
    Register centralized exception handlers.
    Ensures consistent, non-leaky error responses and structured logging for operational visibility.
    """

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """
        Handle HTTPException from FastAPI/Starlette.
        Returns a structured error payload without exposing internal details.
        """
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.status_code,
                    "message": exc.detail,
                    "type": "HTTPException",
                }
            },
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """
        Handle Pydantic/FastAPI validation errors (422).
        Formats errors per field without leaking raw framework internals.
        """
        errors = []
        for error in exc.errors():
            loc = " -> ".join([str(x) for x in error.get("loc", []) if x != "body"])
            errors.append(
                {
                    "field": loc,
                    "issue": error.get("msg"),
                }
            )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "message": "Validation error on input payload",
                    "details": errors,
                }
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        """
        Catch-all for raw SQLAlchemy/asyncpg failures (connection drops, pool
        exhaustion, etc.) that services/routers did not explicitly handle.

        This replaces the per-route `try/except SQLAlchemyError: raise
        HTTPException(503, ...)` blocks that used to be duplicated in every
        router. Now that business logic — including DB access — lives in the
        service layer (auth_service.py, device_service.py), a single global
        handler here is the DRY equivalent: one place that guarantees no raw
        SQLAlchemy/asyncpg exception or stack trace ever reaches the client,
        satisfying elite standard #6.

        503 (not 500) because a DB outage is a distinct, typically transient
        condition worth signalling separately to callers/monitoring — same
        semantics the removed per-route handlers had, just centralized.
        """
        logger.error(
            "DATABASE ERROR",
            extra={"path": request.url.path, "method": request.method},
            exc_info=True,
        )

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": {
                    "code": status.HTTP_503_SERVICE_UNAVAILABLE,
                    "message": "Database service unavailable",
                    "type": "DatabaseError",
                }
            },
        )

    @app.exception_handler(Exception)
    async def global_500_handler(request: Request, exc: Exception):
        """
        Catch-all handler for unhandled exceptions.
        Logs full stack trace server-side, returns a generic error to the client.
        """
        logger.error(
            "UNHANDLED SYSTEM FAILURE",
            extra={
                "path": request.url.path,
                "method": request.method,
            },
            exc_info=True,
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "An unexpected internal server error occurred. System operators have been notified.",
                    "type": "InternalServerError",
                }
            },
        )


"""
Domain-level exceptions raised by service functions. Deliberately NOT
HTTPException subclasses — services shouldn't know about HTTP. Routers
catch these and translate to a status code. Same pattern as TokenError
in security/jwt_handler.py.
"""


class DomainError(Exception):
    """Base class for all domain-level errors."""


class ConflictError(DomainError):
    """A uniqueness constraint would be violated (e.g. duplicate email)."""


class NotFoundError(DomainError):
    """A requested resource does not exist."""


class ExternalServiceError(DomainError):
    """A call to an external system failed unrecoverably."""
