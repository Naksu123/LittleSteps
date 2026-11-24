from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class HomeActivity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "home_activities"

    theme_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    instructions_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    materials_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class HomeActivityProgress(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "home_activity_progress"
    __table_args__ = (
        UniqueConstraint("child_id", "home_activity_id", name="uq_child_home_activity"),
        Index("ix_home_activity_progress_child_completed", "child_id", "completed"),
    )

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    home_activity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("home_activities.id", ondelete="CASCADE"), index=True, nullable=False
    )
    parent_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class ParentReflection(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "parent_reflections"

    parent_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    theme_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    enjoyed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    easy_concepts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    challenging_concepts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discovery_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class LearningGoal(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "learning_goals"

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    parent_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    target_minutes_per_day: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    target_lessons_per_week: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
