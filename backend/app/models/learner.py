from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Child(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Child-safe learner profile containing minimal identifying information."""

    __tablename__ = "children"

    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    birth_year: Mapped[int] = mapped_column(Integer, nullable=False)
    age_group: Mapped[str] = mapped_column(String(20), default="4-5", nullable=False)
    avatar_key: Mapped[str] = mapped_column(String(50), default="bunny", nullable=False)
    favorite_color: Mapped[str] = mapped_column(String(20), default="#78C8F5", nullable=False)
    mascot_name: Mapped[str] = mapped_column(String(50), default="Pip", nullable=False)
    daily_goal_minutes: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    streak_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_stars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_activity_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    parent_links: Mapped[list["ParentChildRelationship"]] = relationship(
        back_populates="child", cascade="all, delete-orphan"
    )
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        back_populates="child", cascade="all, delete-orphan"
    )


class ParentChildRelationship(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "parent_child_relationships"
    __table_args__ = (
        UniqueConstraint("parent_user_id", "child_id", name="uq_parent_child_rel"),
    )

    parent_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(40), default="parent", nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    child: Mapped["Child"] = relationship(back_populates="parent_links")


class SchoolClass(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "classes"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    age_group: Mapped[str] = mapped_column(String(30), default="4-5", nullable=False)
    academic_year: Mapped[str] = mapped_column(String(30), default="2026-2027", nullable=False)
    room_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )
    teacher_assignments: Mapped[list["TeacherClassAssignment"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )


class ClassEnrollment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "class_enrollments"
    __table_args__ = (UniqueConstraint("class_id", "child_id", name="uq_class_enrollment"),)

    class_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("classes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False)

    school_class: Mapped["SchoolClass"] = relationship(back_populates="enrollments")
    child: Mapped["Child"] = relationship(back_populates="enrollments")


class TeacherClassAssignment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "teacher_class_assignments"
    __table_args__ = (
        UniqueConstraint("teacher_user_id", "class_id", name="uq_teacher_class_assignment"),
    )

    teacher_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    class_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("classes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    is_lead: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    school_class: Mapped["SchoolClass"] = relationship(back_populates="teacher_assignments")
