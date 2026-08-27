"""Async SQLAlchemy engine and session factory."""
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from settings import get_settings

settings = get_settings()

class Base(DeclarativeBase):
    pass

engine = create_async_engine(
    #I Commented this out since Aiven is not ready yet, so we use local postgres for now. we move DATABASE_URL to DEV_DATABASE_URL.
    #settings.DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=5, max_overflow=10,
    settings.DEV_DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=5, max_overflow=10,
    connect_args={"options": "-c statement_timeout=10000"}  # 10 second hard cutoff
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
