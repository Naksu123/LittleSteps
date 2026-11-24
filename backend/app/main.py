import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

import app.models  # noqa: F401
from app.api.routes import admin, artworks, auth, children, content, health, parent, progress, teacher
from app.core.config import settings, validate_production_config
from app.core.database import Base, SessionLocal, engine
from app.core.logging_config import configure_logging
from app.db.seed import seed_database
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.models import Role, Subject

logger = logging.getLogger("littlesteps.startup")


def _ensure_serverless_db_ready() -> None:
    """Ensure tables exist and initial seed data is present without overwriting user accounts."""
    if settings.APP_ENV.lower() == "test":
        return
    if not (settings.SEED_ON_START or os.getenv("VERCEL")):
        return

    try:
        with SessionLocal() as session:
            ready = session.execute(
                text("SELECT EXISTS(SELECT 1 FROM roles) AND EXISTS(SELECT 1 FROM subjects)")
            ).scalar()
            if ready:
                return
    except (OperationalError, ProgrammingError):
        pass

    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
    except IntegrityError:
        logger.warning("Concurrent DDL race during table initialization; continuing.")

    with SessionLocal() as session:
        has_roles = session.scalar(select(Role.id).limit(1)) is not None
        has_subjects = session.scalar(select(Subject.id).limit(1)) is not None
        if has_roles and has_subjects:
            return
        try:
            seed_database(session, sync_existing_users=False)
        except IntegrityError:
            session.rollback()
            logger.warning("Concurrent seed race on startup; existing data preserved.")


def create_app() -> FastAPI:
    """Create and configure the LittleSteps FastAPI application."""
    configure_logging(settings.LOG_LEVEL, settings.LOG_FORMAT)

    prod_errors = validate_production_config(settings)
    if prod_errors:
        raise RuntimeError(
            "Production configuration validation failed: " + "; ".join(prod_errors)
        )

    _ensure_serverless_db_ready()

    is_production = settings.APP_ENV.lower() == "production"
    application = FastAPI(
        title=settings.APP_NAME,
        description="Cloud-Based Pre-School Learning Management System API",
        version="0.1.0",
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
    )

    cors_origins = settings.cors_origins_list
    only_local_origins = all(
        "localhost" in origin or "127.0.0.1" in origin for origin in cors_origins
    )
    cors_kwargs: dict[str, object] = {
        "allow_origins": cors_origins,
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": [
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
        ],
        "expose_headers": ["X-Request-ID"],
        "max_age": 3600,
    }
    if not is_production or only_local_origins:
        cors_kwargs["allow_origin_regex"] = r"https://.*\.vercel\.app"

    application.add_middleware(GZipMiddleware, minimum_size=500)
    application.add_middleware(CORSMiddleware, **cors_kwargs)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(
        RateLimitMiddleware,
        max_requests_per_minute=settings.RATE_LIMIT_PER_MINUTE,
        auth_max_requests_per_minute=settings.AUTH_RATE_LIMIT_PER_MINUTE,
    )
    application.add_middleware(RequestLoggingMiddleware)

    application.include_router(health.router, prefix="/api")
    application.include_router(auth.router, prefix="/api")
    application.include_router(children.router, prefix="/api")
    application.include_router(content.router, prefix="/api")
    application.include_router(parent.router, prefix="/api")
    application.include_router(teacher.router, prefix="/api")
    application.include_router(admin.router, prefix="/api")
    application.include_router(progress.router, prefix="/api")
    application.include_router(artworks.router, prefix="/api")

    return application


app = create_app()

