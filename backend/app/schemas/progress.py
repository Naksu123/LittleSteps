from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.learner import ChildOut, RewardOut


class LessonProgressIn(BaseModel):
    child_id: str
    lesson_id: str
    status: Literal["in_progress", "completed"]
    completion_pct: int = Field(ge=0, le=100)
    time_spent_seconds: int = Field(default=0, ge=0, le=3600)


class ActivityProgressIn(BaseModel):
    child_id: str
    game_id: Optional[str] = None
    activity_id: Optional[str] = None
    score_pct: int = Field(ge=0, le=100)
    attempts_count: int = Field(default=1, ge=1, le=500)
    duration_seconds: int = Field(default=0, ge=0, le=3600)
    completed: bool = True

    @model_validator(mode="after")
    def validate_single_target(self) -> "ActivityProgressIn":
        has_game = bool(self.game_id)
        has_activity = bool(self.activity_id)
        if has_game == has_activity:
            raise ValueError("Provide exactly one of game_id or activity_id.")
        return self


class QuizProgressIn(BaseModel):
    child_id: str
    quiz_id: str
    answers: list[int] = Field(min_length=1, max_length=50)


class ProgressResult(BaseModel):
    stars_awarded: int
    total_stars: int
    streak_days: int
    new_rewards: list[RewardOut]
    encouragement: str
    score_pct: Optional[int] = None
    correct_count: Optional[int] = None
    total_questions: Optional[int] = None


class LessonStatusItem(BaseModel):
    lesson_id: str
    status: str
    completion_pct: int
    stars_earned: int


class ProgressSummaryOut(BaseModel):
    child: ChildOut
    lesson_statuses: list[LessonStatusItem]
    completed_game_ids: list[str]
    rewards: list[RewardOut]
    today_minutes: int


class ArtworkCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    image_data: str = Field(min_length=20)
    palette_used: list[str] = Field(default_factory=list, max_length=20)


class ArtworkOut(BaseModel):
    id: str
    title: str
    palette_used_json: list[str]
    approved_by_parent: bool
    created_at: datetime
    image_url: str

    model_config = ConfigDict(from_attributes=True)
