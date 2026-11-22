from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models.system import AuditLog


def record_audit(
    db: Session,
    actor_user_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Persist a non-PII administrative/security audit entry."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details_json=details or {},
        ip_address=ip_address,
    )
    db.add(entry)
    return entry
