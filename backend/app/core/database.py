import os
from collections.abc import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""


def _resolve_database_url() -> str:
    """Resolve and normalize DATABASE_URL for local SQLite, Vercel /tmp, or Postgres (psycopg v3)."""
    url = (settings.DATABASE_URL or "").strip()
    postgres_env = (os.getenv("POSTGRES_URL") or "").strip()
    if (not url or url == "sqlite:///./littlesteps_dev.db") and postgres_env:
        url = postgres_env

    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    elif os.getenv("VERCEL") and url == "sqlite:///./littlesteps_dev.db":
        url = "sqlite:////tmp/littlesteps_dev.db"

    return url


def _build_engine() -> Engine:
    url = _resolve_database_url()
    connect_args: dict[str, object] = {}
    engine_kwargs: dict[str, object] = {"future": True}

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    else:
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
        engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
        engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE

    eng = create_engine(url, connect_args=connect_args, **engine_kwargs)

    if url.startswith("sqlite"):
        is_file_sqlite = ":memory:" not in url

        @event.listens_for(eng, "connect")
        def _enable_sqlite_fks(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            if is_file_sqlite:
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

    return eng


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session per request and ensure cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
