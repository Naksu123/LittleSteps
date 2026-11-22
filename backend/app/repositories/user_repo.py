from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.user import Role, User, UserRole


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    stmt = (
        select(User)
        .options(joinedload(User.user_roles).joinedload(UserRole.role))
        .where(func.lower(User.email) == email.lower().strip())
    )
    return db.scalars(stmt).unique().first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    stmt = (
        select(User)
        .options(joinedload(User.user_roles).joinedload(UserRole.role))
        .where(User.id == user_id)
    )
    return db.scalars(stmt).unique().first()


def get_role_by_name(db: Session, name: str) -> Optional[Role]:
    return db.scalar(select(Role).where(Role.name == name))
