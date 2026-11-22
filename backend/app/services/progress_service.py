import random
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.learner import Child, ParentChildRelationship
from app.models.progress import (
    ActivityAttempt,
    ChildArtwork,
    ChildReward,
    LessonProgress,
    QuizResult,
    SkillProgress,
)
from app.models.system import Notification

ENCOURAGEMENTS = [
    "Great job!",
    "You did it!",
    "You're learning something new!",
    "Wonderful effort!",
    "Let's try another one!",
]

BADGES: dict[str, tuple[str, str, int]] = {
    "first_lesson": (
        "First Lesson Star",
        "Completed your very first LittleSteps lesson!",
        2,
    ),
    "lesson_explorer": (
        "Lesson Explorer",
        "Completed 3 playful learning adventures!",
        2,
    ),
    "game_starter": (
        "Playful Starter",
        "Finished your first educational game!",
        2,
    ),
    "game_champion": (
        "Game Champion",
        "Completed 5 different kindergarten games!",
        2,
    ),
    "quiz_whiz": (
        "Quiz Whiz",
        "Answered every mini check-in question with joyful focus!",
        2,
    ),
    "streak_3": (
        "3-Day Explorer",
        "Learned and played 3 days in a row!",
        2,
    ),
    "young_artist": (
        "Young Artist",
        "Created and saved your own artwork in the Art Studio!",
        2,
    ),
}


def pick_encouragement() -> str:
    """Return a gentle, encouraging feedback phrase."""
    return random.choice(ENCOURAGEMENTS)


def stars_for_score(score_pct: int) -> int:
    """Compute server-side stars from percentage score (always >= 1 for effort)."""
    if score_pct >= 80:
        return 3
    if score_pct >= 50:
        return 2
    return 1


def local_today() -> date:
    """Return current calendar date in configured application timezone."""
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def to_local_date(dt: datetime) -> date:
    """Convert a stored UTC or naive datetime to the app timezone date."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ZoneInfo(settings.APP_TIMEZONE)).date()


def update_streak(child: Child, today: date) -> None:
    """Update daily learning streak safely based on local calendar days."""
    if child.last_activity_date == today:
        return
    if child.last_activity_date == today - timedelta(days=1):
        child.streak_days += 1
    else:
        child.streak_days = 1
    child.last_activity_date = today


def upsert_skill(
    db: Session,
    child_id: str,
    subject_id: str,
    skill_name: str,
    score_pct: int,
) -> SkillProgress:
    """Increment practice count and mastery percentage for a skill."""
    skill = db.scalar(
        select(SkillProgress).where(
            SkillProgress.child_id == child_id,
            SkillProgress.subject_id == subject_id,
            SkillProgress.skill_name == skill_name,
        )
    )
    delta = max(5, score_pct // 10)
    if skill:
        skill.practice_count += 1
        skill.mastery_pct = min(100, skill.mastery_pct + delta)
    else:
        skill = SkillProgress(
            child_id=child_id,
            subject_id=subject_id,
            skill_name=skill_name,
            mastery_pct=min(100, delta),
            practice_count=1,
        )
        db.add(skill)
    return skill


def evaluate_badges(db: Session, child: Child) -> list[ChildReward]:
    """Check milestone criteria and award any new badges idempotently."""
    existing_keys = set(
        db.scalars(
            select(ChildReward.badge_key).where(ChildReward.child_id == child.id)
        ).all()
    )

    completed_lessons = (
        db.scalar(
            select(func.count(LessonProgress.id)).where(
                LessonProgress.child_id == child.id,
                LessonProgress.status == "completed",
            )
        )
        or 0
    )
    completed_games_count = (
        db.scalar(
            select(func.count(ActivityAttempt.id)).where(
                ActivityAttempt.child_id == child.id,
                ActivityAttempt.completed.is_(True),
                ActivityAttempt.game_id.is_not(None),
            )
        )
        or 0
    )
    distinct_games = (
        db.scalar(
            select(func.count(func.distinct(ActivityAttempt.game_id))).where(
                ActivityAttempt.child_id == child.id,
                ActivityAttempt.completed.is_(True),
                ActivityAttempt.game_id.is_not(None),
            )
        )
        or 0
    )
    perfect_quizzes = (
        db.scalar(
            select(func.count(QuizResult.id)).where(
                QuizResult.child_id == child.id,
                QuizResult.score_pct == 100,
            )
        )
        or 0
    )
    artworks_count = (
        db.scalar(
            select(func.count(ChildArtwork.id)).where(ChildArtwork.child_id == child.id)
        )
        or 0
    )

    earned_conditions = {
        "first_lesson": completed_lessons >= 1,
        "lesson_explorer": completed_lessons >= 3,
        "game_starter": completed_games_count >= 1,
        "game_champion": distinct_games >= 5,
        "quiz_whiz": perfect_quizzes >= 1,
        "streak_3": child.streak_days >= 3,
        "young_artist": artworks_count >= 1,
    }

    parent_ids = list(
        db.scalars(
            select(ParentChildRelationship.parent_user_id).where(
                ParentChildRelationship.child_id == child.id
            )
        ).all()
    )

    now = datetime.now(timezone.utc)
    new_rewards: list[ChildReward] = []

    for key, qualified in earned_conditions.items():
        if not qualified or key in existing_keys:
            continue
        title, desc, stars_value = BADGES[key]
        reward = ChildReward(
            child_id=child.id,
            badge_key=key,
            title=title,
            description=desc,
            stars_value=stars_value,
            awarded_at=now,
        )
        db.add(reward)
        new_rewards.append(reward)
        child.total_stars += stars_value

        for parent_id in parent_ids:
            db.add(
                Notification(
                    user_id=parent_id,
                    title=f"{child.display_name} earned the {title} badge!",
                    message=desc,
                    category="milestone",
                    is_read=False,
                )
            )

    return new_rewards


def finalize_learning_event(
    db: Session, child: Child, stars_awarded: int
) -> list[ChildReward]:
    """Update streak, credit stars, evaluate badges, and commit transaction."""
    update_streak(child, local_today())
    child.total_stars += stars_awarded
    db.flush()
    new_rewards = evaluate_badges(db, child)
    db.commit()
    db.refresh(child)
    for reward in new_rewards:
        db.refresh(reward)
    return new_rewards
