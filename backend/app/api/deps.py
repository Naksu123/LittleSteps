from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.learner import (
    Child,
    ClassEnrollment,
    ParentChildRelationship,
    TeacherClassAssignment,
)
from app.models.user import User
from app.services.auth_service import get_authenticated_user_from_claims

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

    user = get_authenticated_user_from_claims(db, payload)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists.",
        )
    return user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return active User when a valid Bearer access token is supplied, or None otherwise."""
    if not credentials or credentials.scheme.lower() != "bearer":
        return None
    try:
        payload = decode_token(credentials.credentials)
    except Exception:
        return None
    if payload.get("type") != "access" or not payload.get("sub"):
        return None
    user = get_authenticated_user_from_claims(db, payload)
    if not user or not user.is_active:
        return None
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

    child: Child | None = None
    if "parent" in roles:
        child = db.scalar(
            select(Child)
            .join(ParentChildRelationship, ParentChildRelationship.child_id == Child.id)
            .where(
                ParentChildRelationship.parent_user_id == user.id,
                ParentChildRelationship.child_id == child_id,
            )
            .limit(1)
        )

    if child is None and "teacher" in roles:
        child = db.scalar(
            select(Child)
            .join(ClassEnrollment, ClassEnrollment.child_id == Child.id)
            .join(
                TeacherClassAssignment,
                TeacherClassAssignment.class_id == ClassEnrollment.class_id,
            )
            .where(
                TeacherClassAssignment.teacher_user_id == user.id,
                ClassEnrollment.child_id == child_id,
                ClassEnrollment.status == "active",
            )
            .limit(1)
        )

    if child is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this learner profile.",
        )

    if not child.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
    return child
