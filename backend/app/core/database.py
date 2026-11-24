import os
from collections.abc import Generator
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import find_postgres_url_from_env, settings

_DEFAULT_SQLITE_URL = "sqlite:///./littlesteps_dev.db"
_NON_LIBPQ_PARAMS = {"pgbouncer", "supa", "connection_limit", "pool_timeout", "schema"}


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""


def _normalize_postgres_url(raw_url: str) -> str:
    """Normalize PostgreSQL scheme to postgresql+psycopg and strip non-libpq pooler query flags."""
    url = raw_url.strip()
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]

    split = urlsplit(url)
    if split.query:
        filtered = [
            (k, v)
            for k, v in parse_qsl(split.query, keep_blank_values=True)
            if k.lower() not in _NON_LIBPQ_PARAMS
        ]
        url = urlunsplit(
            (split.scheme, split.netloc, split.path, urlencode(filtered, doseq=True), split.fragment)
        )
    return url


def _resolve_discrete_pg_url() -> tuple[str, bool]:
    """Build a PostgreSQL URL from discrete PG* environment variables (with optional AWS IAM OIDC auth)."""
    host = (os.getenv("PGHOST") or "").strip()
    user = (os.getenv("PGUSER") or "").strip()
    if not (host and user):
        return "", False

    port = (os.getenv("PGPORT") or "5432").strip()
    database = (os.getenv("PGDATABASE") or "postgres").strip()
    password = os.getenv("PGPASSWORD") or ""
    sslmode = (os.getenv("PGSSLMODE") or "require").strip()

    if password:
        url = (
            f"postgresql+psycopg://{quote_plus(user)}:{quote_plus(password)}"
            f"@{host}:{port}/{database}?sslmode={quote_plus(sslmode)}"
        )
        return url, False

    if (os.getenv("AWS_ROLE_ARN") or "").strip():
        url = f"postgresql+psycopg://{quote_plus(user)}@{host}:{port}/{database}?sslmode=require"
        return url, True

    return "", False


def resolve_database_url(for_migrations: bool = False) -> str:
    """Resolve and normalize DATABASE_URL for runtime or migrations across local, Vercel, and AWS."""
    configured = (settings.DATABASE_URL or "").strip()
    if configured and configured != _DEFAULT_SQLITE_URL:
        if not for_migrations and os.getenv("VERCEL"):
            pooled = (os.getenv("DATABASE_URL_POOLED") or "").strip()
            if pooled and pooled != _DEFAULT_SQLITE_URL:
                return _normalize_postgres_url(pooled) if pooled.startswith("postgres") else pooled
        return _normalize_postgres_url(configured) if configured.startswith("postgres") else configured

    env_pg = find_postgres_url_from_env(for_migrations=for_migrations)
    if env_pg:
        return _normalize_postgres_url(env_pg)

    discrete_url, _ = _resolve_discrete_pg_url()
    if discrete_url:
        return discrete_url

    if os.getenv("VERCEL"):
        return "sqlite:////tmp/littlesteps_dev.db"

    return _DEFAULT_SQLITE_URL


def _resolve_database_url() -> str:
    """Backwards-compatible alias for runtime database URL resolution."""
    return resolve_database_url(for_migrations=False)


def get_database_engine_name(url: str | None = None) -> str:
    """Return 'sqlite' or 'postgresql' for health diagnostics without exposing credentials."""
    resolved = url or resolve_database_url(for_migrations=False)
    return "sqlite" if resolved.startswith("sqlite") else "postgresql"


def is_ephemeral_serverless_sqlite(url: str | None = None) -> bool:
    """Return True when running on Vercel serverless without a persistent external database."""
    resolved = url or resolve_database_url(for_migrations=False)
    return bool(os.getenv("VERCEL")) and resolved.startswith("sqlite")


def _build_engine() -> Engine:
    url = resolve_database_url(for_migrations=False)
    discrete_url, uses_aws_iam_auth = _resolve_discrete_pg_url()
    connect_args: dict[str, object] = {}
    engine_kwargs: dict[str, object] = {"future": True}

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    else:
        connect_args["prepare_threshold"] = None
        if os.getenv("VERCEL"):
            engine_kwargs["pool_pre_ping"] = True
            engine_kwargs["pool_size"] = 3
            engine_kwargs["max_overflow"] = 5
            engine_kwargs["pool_recycle"] = 240
            engine_kwargs["pool_timeout"] = 15
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
                cursor.execute("PRAGMA cache_size=-16000")
                cursor.execute("PRAGMA temp_store=MEMORY")
                cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()
    elif uses_aws_iam_auth and url == discrete_url:

        @event.listens_for(eng, "do_connect")
        def _inject_rds_iam_token(_dialect, _conn_rec, _cargs, cparams) -> None:
            import boto3

            region = (os.getenv("AWS_REGION") or settings.AWS_REGION or "ap-southeast-1").strip()
            web_identity_token = (os.getenv("VERCEL_OIDC_TOKEN") or "").strip()
            role_arn = (os.getenv("AWS_ROLE_ARN") or "").strip()
            if web_identity_token and role_arn:
                sts_client = boto3.client("sts", region_name=region)
                creds = sts_client.assume_role_with_web_identity(
                    RoleArn=role_arn,
                    RoleSessionName="littlesteps-vercel",
                    WebIdentityToken=web_identity_token,
                )["Credentials"]
                rds_client = boto3.client(
                    "rds",
                    region_name=region,
                    aws_access_key_id=creds["AccessKeyId"],
                    aws_secret_access_key=creds["SecretAccessKey"],
                    aws_session_token=creds["SessionToken"],
                )
            else:
                rds_client = boto3.client("rds", region_name=region)

            token = rds_client.generate_db_auth_token(
                DBHostname=(os.getenv("PGHOST") or "").strip(),
                Port=int((os.getenv("PGPORT") or "5432").strip()),
                DBUsername=(os.getenv("PGUSER") or "").strip(),
                Region=region,
            )
            cparams["password"] = token

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
