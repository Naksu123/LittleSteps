from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.garden_service import normalize_garden_state

AGE_GROUP_PATTERN = r"^(Pre-School|3-4|4-5|5-6|4-6|[3-6])$"


def _validate_preschool_birth_year(v: int) -> int:
    current_year = date.today().year
    min_year = current_year - 8
    max_year = current_year - 2
    if v < min_year or v > max_year:
        raise ValueError(
            f"Birth year must be between {min_year} and {max_year} for Pre-School learners."
        )
    return v


def derive_age_group_from_birth_year(birth_year: int) -> str:
    age = date.today().year - birth_year
    if age <= 3:
        return "3-4"
    if age == 4:
        return "4-5"
    return "5-6"


class ChildCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    birth_year: int
    age_group: Optional[str] = Field(default=None, pattern=AGE_GROUP_PATTERN)
    avatar_key: str = Field(default="bunny", max_length=50)
    favorite_color: str = Field(default="#78C8F5", max_length=20)
    daily_goal_minutes: int = Field(default=20, ge=5, le=120)

    @field_validator("birth_year")
    @classmethod
    def check_birth_year(cls, v: int) -> int:
        return _validate_preschool_birth_year(v)

    @model_validator(mode="after")
    def populate_age_group(self) -> "ChildCreate":
        if not self.age_group:
            self.age_group = derive_age_group_from_birth_year(self.birth_year)
        return self


class ChildUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    birth_year: Optional[int] = None
    age_group: Optional[str] = Field(default=None, pattern=AGE_GROUP_PATTERN)
    avatar_key: Optional[str] = Field(default=None, max_length=50)
    favorite_color: Optional[str] = Field(default=None, max_length=20)
    daily_goal_minutes: Optional[int] = Field(default=None, ge=5, le=120)

    @field_validator("birth_year")
    @classmethod
    def check_birth_year(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        return _validate_preschool_birth_year(v)


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
    garden_state_json: dict[str, Any] = Field(default_factory=dict)

    @field_validator("garden_state_json", mode="before")
    @classmethod
    def ensure_garden_state(cls, v: Any) -> dict[str, Any]:
        return normalize_garden_state(v if isinstance(v, dict) else None)

    model_config = ConfigDict(from_attributes=True)


class GardenActionIn(BaseModel):
    crop_key: Literal[
        "kalabasa",
        "kamatis",
        "sitaw",
        "talong",
        "saging",
        "sampaguita",
    ]
    use_resource: Literal["sunbeam", "raindrop"] = "sunbeam"


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
