from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learner import (
    Child,
    ClassEnrollment,
    ParentChildRelationship,
    TeacherClassAssignment,
)


def get_children_for_parent(db: Session, parent_user_id: str) -> list[Child]:
    stmt = (
        select(Child)
        .join(ParentChildRelationship, ParentChildRelationship.child_id == Child.id)
        .where(
            ParentChildRelationship.parent_user_id == parent_user_id,
            Child.is_active.is_(True),
        )
        .order_by(Child.display_name.asc())
    )
    return list(db.scalars(stmt).all())


def get_children_for_teacher(db: Session, teacher_user_id: str) -> list[Child]:
    stmt = (
        select(Child)
        .join(ClassEnrollment, ClassEnrollment.child_id == Child.id)
        .join(TeacherClassAssignment, TeacherClassAssignment.class_id == ClassEnrollment.class_id)
        .where(
            TeacherClassAssignment.teacher_user_id == teacher_user_id,
            ClassEnrollment.status == "active",
            Child.is_active.is_(True),
        )
        .distinct()
        .order_by(Child.display_name.asc())
    )
    return list(db.scalars(stmt).all())


def parent_owns_child(db: Session, parent_user_id: str, child_id: str) -> bool:
    rel = db.scalar(
        select(ParentChildRelationship).where(
            ParentChildRelationship.parent_user_id == parent_user_id,
            ParentChildRelationship.child_id == child_id,
        )
    )
    return rel is not None


def teacher_has_child(db: Session, teacher_user_id: str, child_id: str) -> bool:
    stmt = (
        select(ClassEnrollment.id)
        .join(TeacherClassAssignment, TeacherClassAssignment.class_id == ClassEnrollment.class_id)
        .where(
            TeacherClassAssignment.teacher_user_id == teacher_user_id,
            ClassEnrollment.child_id == child_id,
            ClassEnrollment.status == "active",
        )
    )
    return db.scalar(stmt) is not None
