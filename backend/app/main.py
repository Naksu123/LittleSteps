import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401
from app.api.routes import admin, artworks, auth, children, content, health, parent, progress, teacher
from app.core.config import settings, validate_production_config
from app.core.database import Base, SessionLocal, engine
from app.core.logging_config import configure_logging
from app.db.seed import seed_database
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware


def _ensure_serverless_db_ready() -> None:
    """Auto-create tables and seed data on Vercel serverless cold start or when SEED_ON_START=true."""
    if settings.APP_ENV.lower() == "test":
        return
    if not (settings.SEED_ON_START or os.getenv("VERCEL")):
        return
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_database(session)


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
        description="Cloud-Based Kindergarten Learning Management System API (Ages 4–6)",
        version="0.1.0",
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=3600,
    )
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

