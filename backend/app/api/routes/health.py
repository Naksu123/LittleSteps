from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_database_engine_name, get_db, is_ephemeral_serverless_sqlite
from app.services.storage_service import storage_service

router = APIRouter(tags=["Health"])


def _probe_dependencies(db: Session) -> tuple[str, dict[str, str]]:
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    storage_health = storage_service.check_health()
    return db_status, storage_health


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict[str, object]:
    """Verify API availability, live database connectivity, and storage backend status."""
    db_status, storage_health = _probe_dependencies(db)

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "database_engine": get_database_engine_name(),
        "database_persistent": not is_ephemeral_serverless_sqlite(),
        "storage_backend": settings.STORAGE_BACKEND,
        "storage_status": storage_health["status"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready")
def readiness_check(db: Session = Depends(get_db)) -> JSONResponse:
    """Readiness probe for AWS App Runner / ALB / Vercel returning 503 when dependencies fail."""
    db_status, storage_health = _probe_dependencies(db)
    is_persistent = not is_ephemeral_serverless_sqlite()
    is_ready = (
        db_status == "connected"
        and is_persistent
        and storage_health["status"] in {"ready", "connected"}
    )

    payload = {
        "status": "ready" if is_ready else "not_ready",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "database_engine": get_database_engine_name(),
        "database_persistent": is_persistent,
        "storage_backend": settings.STORAGE_BACKEND,
        "storage_status": storage_health["status"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=200 if is_ready else 503, content=payload)
