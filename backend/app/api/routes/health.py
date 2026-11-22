from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
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
def health_check(db: Session = Depends(get_db)) -> dict[str, str]:
    """Verify API availability, live database connectivity, and storage backend status."""
    db_status, storage_health = _probe_dependencies(db)

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "storage_backend": settings.STORAGE_BACKEND,
        "storage_status": storage_health["status"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready")
def readiness_check(db: Session = Depends(get_db)) -> JSONResponse:
    """Readiness probe for AWS App Runner / ALB returning 503 when dependencies fail."""
    db_status, storage_health = _probe_dependencies(db)
    is_ready = db_status == "connected" and storage_health["status"] in {"ready", "connected"}

    payload = {
        "status": "ready" if is_ready else "not_ready",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "storage_backend": settings.STORAGE_BACKEND,
        "storage_status": storage_health["status"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=200 if is_ready else 503, content=payload)
