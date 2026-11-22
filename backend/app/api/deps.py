from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.learner import Child
from app.models.user import User
from app.repositories.learner_repo import parent_owns_child, teacher_has_child
from app.repositories.user_repo import get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate Bearer JWT token and return active User with loaded roles."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    try:
        payload = decode_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from exc

    if payload.get("type") != "access" or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
        )

    user = get_user_by_id(db, str(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists.",
        )
    return user


def require_roles(*allowed_roles: str):
    """Enforce that the authenticated user possesses at least one required role."""

    def _role_guard(current_user: User = Depends(get_current_user)) -> User:
        user_roles = set(current_user.role_names)
        if not user_roles.intersection(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    return _role_guard


def verify_child_access(db: Session, user: User, child_id: str) -> Child:
    """Ensure a user can only access child records they are authorized to manage/teach."""
    roles = set(user.role_names)

    if "admin" in roles:
        child = db.get(Child, child_id)
        if not child:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
        return child

    allowed = False
    if "parent" in roles and parent_owns_child(db, user.id, child_id):
        allowed = True
    elif "teacher" in roles and teacher_has_child(db, user.id, child_id):
        allowed = True

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this learner profile.",
        )

    child = db.get(Child, child_id)
    if not child or not child.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
    return child
