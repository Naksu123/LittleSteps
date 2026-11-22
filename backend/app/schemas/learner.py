from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ChildCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    birth_year: int = Field(ge=2018, le=2024)
    age_group: str = Field(default="4-5", pattern="^(4-5|5-6|4-6)$")
    avatar_key: str = Field(default="bunny", max_length=50)
    favorite_color: str = Field(default="#78C8F5", max_length=20)
    daily_goal_minutes: int = Field(default=20, ge=5, le=120)


class ChildUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    age_group: Optional[str] = Field(default=None, pattern="^(4-5|5-6|4-6)$")
    avatar_key: Optional[str] = Field(default=None, max_length=50)
    favorite_color: Optional[str] = Field(default=None, max_length=20)
    daily_goal_minutes: Optional[int] = Field(default=None, ge=5, le=120)


class ChildOut(BaseModel):
    id: str
    display_name: str
    birth_year: int
    age_group: str
    avatar_key: str
    favorite_color: str
    mascot_name: str
    daily_goal_minutes: int
    streak_days: int
    total_stars: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class SkillProgressOut(BaseModel):
    id: str
    subject_id: str
    subject_name: str
    skill_name: str
    mastery_pct: int
    practice_count: int


class RewardOut(BaseModel):
    id: str
    badge_key: str
    title: str
    description: str
    stars_value: int
    awarded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubjectBreakdownItem(BaseModel):
    subject_id: str
    subject_name: str
    color_hex: str
    lessons_completed: int
    total_lessons: int


class ChildProgressOut(BaseModel):
    child: ChildOut
    lessons_completed: int
    total_lessons: int
    games_played: int
    home_activities_completed: int
    total_time_minutes: int
    rewards: list[RewardOut]
    skills: list[SkillProgressOut]
    subject_breakdown: list[SubjectBreakdownItem]
