from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_size=5,        # connexions maintenues en permanence par worker
    max_overflow=10,    # connexions supplémentaires acceptées en pic
    pool_pre_ping=True, # vérifie la connexion avant réutilisation (évite les connexions mortes)
    pool_recycle=1800,  # recycle après 30 min (évite les timeouts réseau côté PostgreSQL)
)

SessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
