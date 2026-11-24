from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class MeChildSummary(BaseModel):
    id: str
    display_name: str
    birth_year: Optional[int] = None
    age_group: str
    avatar_key: str
    favorite_color: str
    total_stars: int
    streak_days: int

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserSummary
    children: list[MeChildSummary] = []


class MeResponse(BaseModel):
    user: UserSummary
    children: list[MeChildSummary]
