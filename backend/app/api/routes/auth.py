from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_current_user
from app.core.database import get_db
from app.models.learner import Child
from app.models.user import ParentProfile, User
from app.repositories.learner_repo import get_children_for_parent, get_children_for_teacher
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    MeChildSummary,
    MeResponse,
    ParentPreferencesSummary,
    RefreshRequest,
    RegisterRequest,
    StaffLoginRequest,
    TokenResponse,
    UserSummary,
)
from app.services.auth_service import (
    authenticate_staff_user,
    authenticate_user,
    register_parent,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _to_user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        roles=user.role_names,
        last_login_at=user.last_login_at,
    )


def _get_parent_preferences(db: Session, user: User) -> Optional[ParentPreferencesSummary]:
    if "parent" not in set(user.role_names):
        return None
    profile = db.scalar(select(ParentProfile).where(ParentProfile.user_id == user.id))
    if not profile:
        return ParentPreferencesSummary()
    return ParentPreferencesSummary(
        preferred_language=profile.preferred_language,
        daily_screen_limit_mins=profile.daily_screen_limit_mins,
        notifications_enabled=profile.notifications_enabled,
        has_parent_pin=bool(profile.parent_pin_hash),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Register a new parent/guardian account with explicit child-privacy consent."""
    ip = request.client.host if request.client else None
    user, access_token, refresh_token = register_parent(
        db=db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        privacy_consent_accepted=payload.privacy_consent_accepted,
        ip_address=ip,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_to_user_summary(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate a parent or guardian account via the public login portal."""
    ip = request.client.host if request.client else None
    user, access_token, refresh_token = authenticate_user(
        db=db, email=payload.email, password=payload.password, ip_address=ip
    )
    children = (
        get_children_for_parent(db, user.id)
        if "parent" in set(user.role_names)
        else []
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_to_user_summary(user),
        children=[MeChildSummary.model_validate(c) for c in children],
        parent_preferences=_get_parent_preferences(db, user),
    )


@router.post("/staff-login", response_model=TokenResponse)
def staff_login(payload: StaffLoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate a teacher or school administrator via the private staff gate."""
    ip = request.client.host if request.client else None
    user, access_token, refresh_token = authenticate_staff_user(
        db=db,
        email=payload.email,
        password=payload.password,
        access_code=payload.access_code,
        ip_address=ip,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_to_user_summary(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Rotate a valid refresh token for a fresh access/refresh token pair."""
    user, access_token, new_refresh = rotate_refresh_token(db, payload.refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user=_to_user_summary(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Revoke the provided refresh token and record logout audit event without altering the user account."""
    revoke_refresh_token(db, payload.refresh_token, current_user.id if current_user else None)
    return None


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return authenticated user metadata and accessible learner summaries."""
    roles = set(current_user.role_names)
    if "admin" in roles:
        children = list(
            db.scalars(
                select(Child).where(Child.is_active.is_(True)).order_by(Child.display_name.asc())
            ).all()
        )
    elif "teacher" in roles:
        children = get_children_for_teacher(db, current_user.id)
    else:
        children = get_children_for_parent(db, current_user.id)

    return MeResponse(
        user=_to_user_summary(current_user),
        children=[MeChildSummary.model_validate(c) for c in children],
        parent_preferences=_get_parent_preferences(db, current_user),
    )
