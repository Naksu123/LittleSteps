from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class SubjectOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    icon_key: str
    color_hex: str
    sort_order: int
    lesson_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class LearningObjectiveOut(BaseModel):
    id: str
    statement: str
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class ParentGuideOut(BaseModel):
    id: str
    what_child_learns: str
    why_it_matters: str
    materials_needed_json: list[str]
    conversation_prompts_json: list[str]
    learning_tip: str
    estimated_duration_mins: int
    teacher_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class HomeActivityOut(BaseModel):
    id: str
    title: str
    instructions_json: list[str]
    materials_json: list[str]
    estimated_minutes: int
    sort_order: int
    completed: bool = False

    model_config = ConfigDict(from_attributes=True)


class ThemeOut(BaseModel):
    id: str
    week_number: int
    slug: str
    title: str
    summary: str
    color_hex: str
    status: str
    published_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ActivityOut(BaseModel):
    id: str
    title: str
    activity_type: str
    instructions: str
    payload_json: dict[str, Any]
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class LessonOut(BaseModel):
    id: str
    subject_id: str
    theme_id: Optional[str] = None
    slug: str
    title: str
    summary: str
    content_json: dict[str, Any]
    age_group: str
    estimated_minutes: int
    audio_narration_text: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class LessonDetailOut(LessonOut):
    activities: list[ActivityOut] = []


class QuizQuestionOut(BaseModel):
    id: str
    prompt: str
    options_json: list[str]
    correct_option_index: int
    encouragement_text: str
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class QuizOut(BaseModel):
    id: str
    title: str
    instructions: str
    passing_stars: int
    questions: list[QuizQuestionOut] = []

    model_config = ConfigDict(from_attributes=True)


class ThemeDetailOut(ThemeOut):
    objectives: list[LearningObjectiveOut] = []
    parent_guide: Optional[ParentGuideOut] = None
    home_activities: list[HomeActivityOut] = []
    lessons: list[LessonOut] = []


class GameOut(BaseModel):
    id: str
    slug: str
    title: str
    game_type: str
    subject_id: str
    theme_id: Optional[str] = None
    instructions: str
    difficulty_level: str
    config_json: dict[str, Any]
    status: str

    model_config = ConfigDict(from_attributes=True)
