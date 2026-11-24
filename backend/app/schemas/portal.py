from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.schemas.content import (
    ActivityOut,
    HomeActivityOut,
    LearningObjectiveOut,
    LessonOut,
    ParentGuideOut,
    ThemeDetailOut,
    ThemeOut,
)
from app.schemas.learner import ChildOut, RewardOut, SkillProgressOut


class WeeklyActivityPoint(BaseModel):
    day: str
    minutes: int
    lessons: int


class AnnouncementOut(BaseModel):
    id: str
    title: str
    body: str
    published_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    category: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListOut(BaseModel):
    unread_count: int
    items: list[NotificationOut]


class WorksheetOut(BaseModel):
    id: str
    title: str
    description: str
    storage_key: str
    age_group: str

    model_config = ConfigDict(from_attributes=True)


class ParentReflectionIn(BaseModel):
    child_id: str
    theme_id: str
    enjoyed: bool
    easy_concepts: Optional[str] = Field(default=None, max_length=1000)
    challenging_concepts: Optional[str] = Field(default=None, max_length=1000)
    discovery_notes: Optional[str] = Field(default=None, max_length=1500)


class ParentReflectionOut(BaseModel):
    id: str
    child_id: str
    theme_id: str
    theme_title: str
    week_number: int
    enjoyed: bool
    easy_concepts: Optional[str] = None
    challenging_concepts: Optional[str] = None
    discovery_notes: Optional[str] = None
    created_at: datetime


class HomeActivityProgressIn(BaseModel):
    child_id: str
    completed: bool


class HomeActivityProgressOut(BaseModel):
    home_activity_id: str
    child_id: str
    completed: bool
    completed_at: Optional[datetime] = None
    stars_awarded: int
    total_stars: int


class LearningGoalIn(BaseModel):
    child_id: str
    title: str = Field(min_length=2, max_length=160)
    target_minutes_per_day: int = Field(default=20, ge=5, le=120)
    target_lessons_per_week: int = Field(default=3, ge=1, le=21)
    is_active: bool = True


class LearningGoalUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=160)
    target_minutes_per_day: Optional[int] = Field(default=None, ge=5, le=120)
    target_lessons_per_week: Optional[int] = Field(default=None, ge=1, le=21)
    is_active: Optional[bool] = None


class LearningGoalOut(BaseModel):
    id: str
    child_id: str
    title: str
    target_minutes_per_day: int
    target_lessons_per_week: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ParentSettingsOut(BaseModel):
    preferred_language: str
    daily_screen_limit_mins: int
    notifications_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class ParentSettingsUpdate(BaseModel):
    preferred_language: Optional[Literal["en", "fil"]] = None
    daily_screen_limit_mins: Optional[int] = Field(default=None, ge=10, le=120)
    notifications_enabled: Optional[bool] = None


class AssignedActivityOut(BaseModel):
    id: str
    title: str
    lesson_id: Optional[str] = None
    game_id: Optional[str] = None
    due_date: Optional[date] = None
    completed: bool


class ParentChildDashboardItem(BaseModel):
    child: ChildOut
    lessons_completed: int
    total_lessons: int
    total_time_minutes: int
    recent_rewards: list[RewardOut]
    skills: list[SkillProgressOut]
    weekly_activity: list[WeeklyActivityPoint]
    assigned_activities: list[AssignedActivityOut] = []


class ParentDashboardOut(BaseModel):
    children: list[ParentChildDashboardItem]
    current_theme: Optional[ThemeDetailOut] = None
    announcements: list[AnnouncementOut]
    notifications: list[NotificationOut]
    unread_notification_count: int = 0


class ParentHomeLearningThemeOut(BaseModel):
    theme: ThemeOut
    parent_guide: Optional[ParentGuideOut] = None
    home_activities: list[HomeActivityOut]
    objectives: list[LearningObjectiveOut] = []
    worksheets: list[WorksheetOut] = []
    reflections: list[ParentReflectionOut] = []


class ActivityHistoryItem(BaseModel):
    activity_type: Literal["lesson", "game", "quiz", "home_activity"]
    title: str
    occurred_at: datetime
    stars_earned: int = 0
    minutes: int = 0


class TeacherObservationOut(BaseModel):
    id: str
    teacher_name: str
    category: str
    observation_text: str
    observed_at: datetime


class TeacherFeedbackOut(BaseModel):
    id: str
    teacher_name: str
    message: str
    is_read: bool
    created_at: datetime


class RecommendedHomeActivityOut(BaseModel):
    home_activity_id: str
    theme_id: str
    week_number: int
    theme_title: str
    title: str
    materials: list[str]
    estimated_minutes: int


class WeeklyReportOut(BaseModel):
    generated_at: datetime
    week_start: date
    week_end: date
    child: ChildOut
    this_week_minutes: int
    previous_week_minutes: int
    this_week_lessons: int
    previous_week_lessons: int
    games_played_this_week: int
    home_activities_completed_this_week: int
    encouraging_summary: str
    strengths: list[SkillProgressOut]
    areas_to_practice: list[SkillProgressOut]
    activity_history: list[ActivityHistoryItem]
    rewards: list[RewardOut]
    recommended_home_activities: list[RecommendedHomeActivityOut]
    teacher_observations: list[TeacherObservationOut]
    teacher_feedback: list[TeacherFeedbackOut]
    assigned_activities: list[AssignedActivityOut]
    reflections: list[ParentReflectionOut]


class TeacherClassOut(BaseModel):
    id: str
    name: str
    age_group: str
    academic_year: str
    room_label: Optional[str] = None
    student_count: int


class TeacherStudentOut(BaseModel):
    id: str
    display_name: str
    age_group: str
    avatar_key: str
    class_name: str
    total_stars: int
    streak_days: int
    lessons_completed: int


class TeacherLessonSlideIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=600)
    emoji: str = Field(default="✨", max_length=16)
    narration: Optional[str] = Field(default=None, max_length=600)


class TeacherLessonCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    subject_id: str
    theme_id: Optional[str] = None
    summary: str = Field(min_length=2, max_length=1000)
    age_group: Literal["Pre-School", "3-4", "4-5", "5-6", "4-6"] = "Pre-School"
    estimated_minutes: int = Field(default=10, ge=3, le=60)
    audio_narration_text: Optional[str] = Field(default=None, max_length=1500)
    status: Literal["draft", "published", "archived"] = "published"
    skill: Optional[str] = Field(default=None, max_length=120)
    slides: list[TeacherLessonSlideIn] = []


class TeacherLessonUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=160)
    summary: Optional[str] = Field(default=None, min_length=2, max_length=1000)
    theme_id: Optional[str] = None
    age_group: Optional[Literal["Pre-School", "3-4", "4-5", "5-6", "4-6"]] = None
    estimated_minutes: Optional[int] = Field(default=None, ge=3, le=60)
    audio_narration_text: Optional[str] = Field(default=None, max_length=1500)
    status: Optional[Literal["draft", "published", "archived"]] = None
    slides: Optional[list[TeacherLessonSlideIn]] = None


class TeacherActivityCreate(BaseModel):
    lesson_id: str
    title: str = Field(min_length=2, max_length=160)
    instructions: str = Field(min_length=2, max_length=500)
    prompt: str = Field(min_length=2, max_length=255)
    choices: list[str] = Field(min_length=2, max_length=4)
    correct_index: int = Field(ge=0, le=3)


class LessonResourceOut(BaseModel):
    id: str
    lesson_id: str
    title: str
    resource_type: str
    mime_type: str
    file_size_bytes: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeacherThemeCreate(BaseModel):
    week_number: int = Field(ge=1, le=52)
    title: str = Field(min_length=2, max_length=150)
    summary: str = Field(min_length=2, max_length=1000)
    color_hex: str = Field(default="#78C8F5", max_length=20)
    status: Literal["draft", "published", "archived"] = "published"
    what_child_learns: Optional[str] = Field(default=None, max_length=1000)
    why_it_matters: Optional[str] = Field(default=None, max_length=1000)
    learning_tip: Optional[str] = Field(default=None, max_length=1000)


class TeacherThemeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=150)
    summary: Optional[str] = Field(default=None, min_length=2, max_length=1000)
    color_hex: Optional[str] = Field(default=None, max_length=20)
    status: Optional[Literal["draft", "published", "archived"]] = None
    what_child_learns: Optional[str] = Field(default=None, max_length=1000)
    why_it_matters: Optional[str] = Field(default=None, max_length=1000)
    learning_tip: Optional[str] = Field(default=None, max_length=1000)


class TeacherAssignmentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    class_id: Optional[str] = None
    child_id: Optional[str] = None
    lesson_id: Optional[str] = None
    game_id: Optional[str] = None
    due_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_targets_and_content(self) -> "TeacherAssignmentCreate":
        if not self.class_id and not self.child_id:
            raise ValueError("Select at least a class or an individual learner.")
        if not self.lesson_id and not self.game_id:
            raise ValueError("Select a lesson or educational game to assign.")
        return self


class TeacherAssignmentOut(BaseModel):
    id: str
    title: str
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    child_id: Optional[str] = None
    child_name: Optional[str] = None
    lesson_id: Optional[str] = None
    game_id: Optional[str] = None
    due_date: Optional[date] = None
    completed_count: int
    target_count: int
    created_at: datetime


class TeacherObservationCreate(BaseModel):
    child_id: str
    class_id: Optional[str] = None
    category: str = Field(default="encouragement", max_length=60)
    observation_text: str = Field(min_length=2, max_length=1500)


class TeacherFeedbackCreate(BaseModel):
    child_id: str
    message: str = Field(min_length=2, max_length=1500)


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2, max_length=2000)
    class_id: Optional[str] = None


class TeacherStudentDetailOut(BaseModel):
    child: ChildOut
    class_names: list[str]
    lessons_completed: int
    total_lessons: int
    games_played: int
    total_time_minutes: int
    skills: list[SkillProgressOut]
    rewards: list[RewardOut]
    observations: list[TeacherObservationOut]
    reflections: list[ParentReflectionOut]


class ClassPerformanceSummary(BaseModel):
    class_id: str
    class_name: str
    student_count: int
    avg_stars: float
    total_lessons_completed: int
    active_learners: int


class SubjectMasteryPoint(BaseModel):
    subject_name: str
    avg_mastery_pct: int
    color_hex: str


class StudentGuidanceItem(BaseModel):
    child_id: str
    display_name: str
    avatar_key: str
    class_name: str
    reason: str
    lessons_completed: int
    lowest_skill: Optional[str] = None


class WeeklyCompletionPoint(BaseModel):
    day: str
    lessons: int
    games: int


class TeacherAnalyticsOut(BaseModel):
    total_classes: int
    total_students: int
    active_learners_this_week: int
    average_lessons_completed: float
    completion_rate_pct: int
    class_summaries: list[ClassPerformanceSummary]
    subject_averages: list[SubjectMasteryPoint]
    students_needing_guidance: list[StudentGuidanceItem]
    weekly_completions: list[WeeklyCompletionPoint]


__all__ = [
    "ActivityOut",
    "LessonOut",
]


class AdminUserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool
    roles: list[str]
    last_login_at: Optional[datetime] = None
    created_at: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["admin", "teacher", "parent"]
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    roles: Optional[list[Literal["admin", "teacher", "parent"]]] = Field(
        default=None, min_length=1
    )


class AdminClassTeacherOut(BaseModel):
    teacher_user_id: str
    full_name: str
    email: EmailStr
    is_lead: bool


class AdminClassStudentOut(BaseModel):
    child_id: str
    display_name: str
    age_group: str
    avatar_key: str
    status: str


class AdminClassOut(BaseModel):
    id: str
    name: str
    age_group: str
    academic_year: str
    room_label: Optional[str] = None
    is_active: bool
    teachers: list[AdminClassTeacherOut]
    students: list[AdminClassStudentOut]
    created_at: datetime


class AdminClassCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    age_group: Literal["Pre-School", "3-4", "4-5", "5-6", "4-6"] = "Pre-School"
    academic_year: str = Field(default="2026-2027", min_length=4, max_length=30)
    room_label: Optional[str] = Field(default=None, max_length=50)
    is_active: bool = True


class AdminClassUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    age_group: Optional[Literal["Pre-School", "3-4", "4-5", "5-6", "4-6"]] = None
    academic_year: Optional[str] = Field(default=None, min_length=4, max_length=30)
    room_label: Optional[str] = Field(default=None, max_length=50)
    is_active: Optional[bool] = None


class AdminTeacherAssignIn(BaseModel):
    teacher_user_id: str
    is_lead: bool = True


class AdminEnrollmentIn(BaseModel):
    child_id: str


class AdminChildSummaryOut(BaseModel):
    id: str
    display_name: str
    age_group: str
    avatar_key: str
    is_active: bool
    parent_names: list[str]
    class_ids: list[str]
    class_names: list[str]
    total_stars: int
    streak_days: int


class AdminSubjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=2, max_length=1000)
    icon_key: str = Field(default="book-open", max_length=50)
    color_hex: str = Field(default="#78C8F5", max_length=20)
    sort_order: int = Field(default=10, ge=0, le=999)
    is_active: bool = True


class AdminSubjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, min_length=2, max_length=1000)
    icon_key: Optional[str] = Field(default=None, max_length=50)
    color_hex: Optional[str] = Field(default=None, max_length=20)
    sort_order: Optional[int] = Field(default=None, ge=0, le=999)
    is_active: Optional[bool] = None


class AdminSubjectOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    icon_key: str
    color_hex: str
    sort_order: int
    is_active: bool
    lesson_count: int
    game_count: int


class AdminContentStatusUpdate(BaseModel):
    status: Literal["draft", "published", "archived"]


class AdminContentSummaryOut(BaseModel):
    lessons: list[LessonOut]
    themes: list[ThemeOut]


class AdminStorageItemOut(BaseModel):
    id: str
    item_type: Literal["lesson_resource", "child_artwork"]
    title: str
    storage_key: str
    mime_type: str
    file_size_bytes: int
    parent_label: str
    created_at: datetime


class AdminStorageOverviewOut(BaseModel):
    storage_backend: str
    total_items: int
    total_bytes: int
    items: list[AdminStorageItemOut]


class AdminDailyActivityPoint(BaseModel):
    day: str
    lessons: int
    games: int
    home_activities: int


class AdminSubjectDistributionPoint(BaseModel):
    subject_name: str
    lessons: int
    games: int
    color_hex: str


class AdminAnalyticsOut(BaseModel):
    users_by_role: dict[str, int]
    active_users: int
    inactive_users: int
    total_children: int
    active_learners_7d: int
    total_lessons_completed: int
    total_game_attempts: int
    total_home_activities_completed: int
    total_storage_items: int
    total_storage_bytes: int
    daily_activity: list[AdminDailyActivityPoint]
    subject_distribution: list[AdminSubjectDistributionPoint]


class PlatformSettingOut(BaseModel):
    key: str
    value_json: dict[str, Any]
    description: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlatformSettingUpdate(BaseModel):
    value_json: dict[str, Any]
    description: Optional[str] = Field(default=None, max_length=255)


class SystemHealthOut(BaseModel):
    status: str
    database_status: str
    storage_backend: str
    environment: str
    counts: dict[str, int]


class AuditLogOut(BaseModel):
    id: str
    actor_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details_json: dict[str, Any]
    created_at: datetime
