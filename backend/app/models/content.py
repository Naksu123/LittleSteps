from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Subject(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "subjects"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_key: Mapped[str] = mapped_column(String(50), default="book-open", nullable=False)
    color_hex: Mapped[str] = mapped_column(String(20), default="#78C8F5", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    lessons: Mapped[list["Lesson"]] = relationship(back_populates="subject")
    games: Mapped[list["Game"]] = relationship(back_populates="subject")


class Theme(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "themes"

    week_number: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    color_hex: Mapped[str] = mapped_column(String(20), default="#FFE58A", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="published", index=True, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    objectives: Mapped[list["LearningObjective"]] = relationship(
        back_populates="theme", cascade="all, delete-orphan"
    )
    parent_guide: Mapped[Optional["ParentGuide"]] = relationship(
        back_populates="theme", uselist=False, cascade="all, delete-orphan"
    )
    lessons: Mapped[list["Lesson"]] = relationship(back_populates="theme")
    games: Mapped[list["Game"]] = relationship(back_populates="theme")
    worksheets: Mapped[list["Worksheet"]] = relationship(
        back_populates="theme", cascade="all, delete-orphan"
    )


class LearningObjective(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "learning_objectives"

    theme_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    subject_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    statement: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    theme: Mapped["Theme"] = relationship(back_populates="objectives")


class Lesson(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "lessons"
    __table_args__ = (Index("ix_lessons_status_subject", "status", "subject_id"),)

    subject_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("subjects.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    theme_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="SET NULL"), index=True, nullable=True
    )
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    content_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    age_group: Mapped[str] = mapped_column(String(20), default="Pre-School", nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    audio_narration_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="published", index=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    subject: Mapped["Subject"] = relationship(back_populates="lessons")
    theme: Mapped[Optional["Theme"]] = relationship(back_populates="lessons")
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )
    resources: Mapped[list["LessonResource"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )


class Activity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "activities"

    lesson_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lessons.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(50), default="interactive", nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    lesson: Mapped["Lesson"] = relationship(back_populates="activities")


class Game(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "games"
    __table_args__ = (Index("ix_games_status_subject", "status", "subject_id"),)

    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    game_type: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    subject_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("subjects.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    theme_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="SET NULL"), index=True, nullable=True
    )
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty_level: Mapped[str] = mapped_column(String(20), default="easy", nullable=False)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="published", index=True, nullable=False)

    subject: Mapped["Subject"] = relationship(back_populates="games")
    theme: Mapped[Optional["Theme"]] = relationship(back_populates="games")


class Quiz(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quizzes"

    lesson_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("lessons.id", ondelete="SET NULL"), index=True, nullable=True
    )
    theme_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="SET NULL"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    passing_stars: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizQuestion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quiz_questions"

    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    prompt: Mapped[str] = mapped_column(String(255), nullable=False)
    options_json: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    correct_option_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    encouragement_text: Mapped[str] = mapped_column(
        String(255), default="Great effort! Let's look closely together!", nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    quiz: Mapped["Quiz"] = relationship(back_populates="questions")


class LessonResource(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "lesson_resources"

    lesson_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lessons.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(40), default="image", nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    lesson: Mapped["Lesson"] = relationship(back_populates="resources")


class Worksheet(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "worksheets"

    theme_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    age_group: Mapped[str] = mapped_column(String(20), default="Pre-School", nullable=False)

    theme: Mapped["Theme"] = relationship(back_populates="worksheets")


class ParentGuide(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "parent_guides"

    theme_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("themes.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    what_child_learns: Mapped[str] = mapped_column(Text, nullable=False)
    why_it_matters: Mapped[str] = mapped_column(Text, nullable=False)
    materials_needed_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    conversation_prompts_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    learning_tip: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_duration_mins: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    teacher_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    theme: Mapped["Theme"] = relationship(back_populates="parent_guide")
