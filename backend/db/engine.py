"""Async SQLAlchemy engine and session factory."""

from collections.abc import AsyncGenerator

from settings import get_settings
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

settings = get_settings()


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    # we use local postgres for now.
    # settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=5, max_overflow=10,
    settings.DATABASE_URL,  # dev: settings.DEV_DATABASE_URL, #prod: settings.DATABASE_URL
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
