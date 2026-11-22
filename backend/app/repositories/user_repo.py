from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.user import Role, User, UserRole


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    stmt = (
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.email == email.lower().strip())
    )
    return db.scalar(stmt)


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    stmt = (
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user_id)
    )
    return db.scalar(stmt)


def get_role_by_name(db: Session, name: str) -> Optional[Role]:
    return db.scalar(select(Role).where(Role.name == name))
