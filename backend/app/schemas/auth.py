from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.services.garden_service import normalize_garden_state


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    privacy_consent_accepted: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class StaffLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    access_code: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class UserSummary(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool
    roles: list[str]
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ParentPreferencesSummary(BaseModel):
    preferred_language: str = "en"
    daily_screen_limit_mins: int = 30
    notifications_enabled: bool = True
    has_parent_pin: bool = False


class MeChildSummary(BaseModel):
    id: str
    display_name: str
    birth_year: Optional[int] = None
    age_group: str
    avatar_key: str
    favorite_color: str
    total_stars: int
    streak_days: int
    garden_state_json: dict[str, Any] = Field(default_factory=dict)

    @field_validator("garden_state_json", mode="before")
    @classmethod
    def ensure_garden_state(cls, v: Any) -> dict[str, Any]:
        return normalize_garden_state(v if isinstance(v, dict) else None)

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserSummary
    children: list[MeChildSummary] = []
    parent_preferences: Optional[ParentPreferencesSummary] = None


class MeResponse(BaseModel):
    user: UserSummary
    children: list[MeChildSummary]
    parent_preferences: Optional[ParentPreferencesSummary] = None
