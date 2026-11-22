import hmac
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.user import ParentProfile, RefreshToken, Role, User, UserRole
from app.repositories.user_repo import get_role_by_name, get_user_by_email, get_user_by_id
from app.services.audit_service import record_audit


def register_parent(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    privacy_consent_accepted: bool,
    ip_address: Optional[str] = None,
) -> tuple[User, str, str]:
    if not privacy_consent_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guardian privacy consent must be accepted to create an account.",
        )

    normalized_email = email.lower().strip()
    if get_user_by_email(db, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    clean_full_name = " ".join(full_name.strip().split())
    if db.scalar(select(User.id).where(func.lower(User.full_name) == clean_full_name.lower())):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this full name already exists.",
        )

    parent_role = get_role_by_name(db, "parent")
    if not parent_role:
        parent_role = Role(name="parent", description="Parent or guardian")
        db.add(parent_role)
        db.flush()

    now = datetime.now(timezone.utc)
    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        full_name=clean_full_name,
        is_active=True,
        privacy_consent_accepted_at=now,
        last_login_at=now,
    )
    db.add(user)
    db.flush()

    db.add(UserRole(user_id=user.id, role_id=parent_role.id))
    db.add(ParentProfile(user_id=user.id))
    record_audit(
        db,
        actor_user_id=user.id,
        action="auth.parent_registered",
        resource_type="user",
        resource_id=user.id,
        ip_address=ip_address,
    )
    db.flush()

    user = get_user_by_id(db, user.id)  # reload roles cleanly
    assert user is not None
    access_token, refresh_token = _issue_token_pair(db, user)
    db.commit()
    return user, access_token, refresh_token


def authenticate_user(
    db: Session, email: str, password: str, ip_address: Optional[str] = None
) -> tuple[User, str, str]:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    staff_roles = {"admin", "teacher"}
    if staff_roles.intersection(user.role_names):
        record_audit(
            db,
            actor_user_id=user.id,
            action="auth.staff_blocked_public_login",
            resource_type="user",
            resource_id=user.id,
            ip_address=ip_address,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is currently deactivated. Please contact your school administrator.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    access_token, refresh_token = _issue_token_pair(db, user)
    record_audit(
        db,
        actor_user_id=user.id,
        action="auth.login",
        resource_type="user",
        resource_id=user.id,
        ip_address=ip_address,
    )
    db.commit()
    return user, access_token, refresh_token


def authenticate_staff_user(
    db: Session,
    email: str,
    password: str,
    access_code: str,
    ip_address: Optional[str] = None,
) -> tuple[User, str, str]:
    code_valid = hmac.compare_digest(access_code.strip(), settings.STAFF_ACCESS_CODE)
    user = get_user_by_email(db, email)
    password_valid = bool(user and verify_password(password, user.password_hash))
    is_staff = bool(user and {"teacher", "admin"}.intersection(user.role_names))

    if not (code_valid and password_valid and is_staff):
        record_audit(
            db,
            actor_user_id=user.id if user else None,
            action="auth.staff_login_failed",
            resource_type="user",
            resource_id=user.id if user else None,
            details={"reason": "invalid_credentials_or_code"},
            ip_address=ip_address,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid staff credentials or access code.",
        )

    assert user is not None
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is currently deactivated. Please contact your school administrator.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    access_token, refresh_token = _issue_token_pair(db, user)
    record_audit(
        db,
        actor_user_id=user.id,
        action="auth.staff_login",
        resource_type="user",
        resource_id=user.id,
        ip_address=ip_address,
    )
    db.commit()
    return user, access_token, refresh_token


def rotate_refresh_token(db: Session, raw_refresh_token: str) -> tuple[User, str, str]:
    try:
        payload = decode_token(raw_refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token."
        ) from exc

    if payload.get("type") != "refresh" or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token type."
        )

    token_digest = hash_token(raw_refresh_token)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_digest))
    now = datetime.now(timezone.utc)
    expires_at = stored.expires_at if stored else None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if stored is not None:
        if stored.revoked_at is not None or (expires_at is not None and expires_at <= now):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked or expired.",
            )
        user = get_user_by_id(db, stored.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive or missing.",
            )
        stored.revoked_at = now
    elif os.getenv("VERCEL"):
        user = get_user_by_id(db, str(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive or missing.",
            )
        db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=token_digest,
                expires_at=datetime.fromtimestamp(int(payload.get("exp", now.timestamp())), tz=timezone.utc),
                revoked_at=now,
            )
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked or expired.",
        )

    access_token, new_refresh_token = _issue_token_pair(db, user)
    db.commit()
    return user, access_token, new_refresh_token


def revoke_refresh_token(
    db: Session, raw_refresh_token: Optional[str], actor_user_id: Optional[str]
) -> None:
    if raw_refresh_token:
        digest = hash_token(raw_refresh_token)
        stmt = select(RefreshToken).where(RefreshToken.token_hash == digest)
        if actor_user_id:
            stmt = stmt.where(RefreshToken.user_id == actor_user_id)
        stored = db.scalar(stmt)
        if stored and stored.revoked_at is None:
            stored.revoked_at = datetime.now(timezone.utc)
    if actor_user_id:
        record_audit(
            db,
            actor_user_id=actor_user_id,
            action="auth.logout",
            resource_type="user",
            resource_id=actor_user_id,
        )
    db.commit()


def _issue_token_pair(db: Session, user: User) -> tuple[str, str]:
    roles = user.role_names
    access_token = create_access_token(user.id, roles)
    refresh_token, expires_at = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
    )
    return access_token, refresh_token
