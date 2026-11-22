from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin, utc_now


class LessonProgress(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("child_id", "lesson_id", name="uq_child_lesson_progress"),)

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    lesson_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lessons.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="in_progress", nullable=False)
    completion_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stars_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class ActivityAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "activity_attempts"

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    activity_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("activities.id", ondelete="SET NULL"), index=True, nullable=True
    )
    game_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="SET NULL"), index=True, nullable=True
    )
    score_pct: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    stars_earned: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    attempts_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class QuizResult(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quiz_results"

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    score_pct: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    stars_earned: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    answers_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class SkillProgress(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "skill_progress"
    __table_args__ = (
        UniqueConstraint("child_id", "subject_id", "skill_name", name="uq_child_skill"),
    )

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    subject_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("subjects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    skill_name: Mapped[str] = mapped_column(String(120), nullable=False)
    mastery_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    practice_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ChildReward(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "child_rewards"

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    badge_key: Mapped[str] = mapped_column(String(60), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    stars_value: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )


class ChildArtwork(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "child_artworks"

    child_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    palette_used_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    approved_by_parent: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Assignment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "assignments"

    teacher_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    class_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("classes.id", ondelete="SET NULL"), index=True, nullable=True
    )
    child_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("children.id", ondelete="SET NULL"), index=True, nullable=True
    )
    lesson_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True
    )
    game_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
