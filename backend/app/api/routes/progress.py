from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, verify_child_access
from app.core.database import get_db
from app.models.content import Activity, Game, Lesson, Quiz, Subject
from app.models.progress import (
    ActivityAttempt,
    ChildReward,
    LessonProgress,
    QuizResult,
)
from app.models.user import User
from app.schemas.learner import ChildOut, RewardOut
from app.schemas.progress import (
    ActivityProgressIn,
    LessonProgressIn,
    LessonStatusItem,
    ProgressResult,
    ProgressSummaryOut,
    QuizProgressIn,
)
from app.services.progress_service import (
    finalize_learning_event,
    local_today,
    pick_encouragement,
    stars_for_score,
    to_local_date,
    upsert_skill,
)

router = APIRouter(prefix="/progress", tags=["Learning Progress"])


@router.post("/lesson", response_model=ProgressResult)
def record_lesson_progress(
    payload: LessonProgressIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record or complete a child's progress in a lesson and award stars server-side."""
    child = verify_child_access(db, current_user, payload.child_id)
    lesson = db.scalar(
        select(Lesson).where(Lesson.id == payload.lesson_id, Lesson.status == "published")
    )
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    existing = db.scalar(
        select(LessonProgress).where(
            LessonProgress.child_id == child.id,
            LessonProgress.lesson_id == lesson.id,
        )
    )
    if not existing:
        existing = LessonProgress(
            child_id=child.id,
            lesson_id=lesson.id,
            status=payload.status,
            completion_pct=payload.completion_pct,
            stars_earned=0,
            time_spent_seconds=payload.time_spent_seconds,
        )
        db.add(existing)
    else:
        existing.time_spent_seconds += payload.time_spent_seconds
        existing.completion_pct = max(existing.completion_pct, payload.completion_pct)

    stars_awarded = 0
    if payload.status == "completed":
        existing.status = "completed"
        existing.completion_pct = 100
        if existing.completed_at is None:
            existing.completed_at = datetime.now(timezone.utc)
        stars_awarded = max(0, 3 - existing.stars_earned)
        existing.stars_earned = max(existing.stars_earned, 3)

        subj = db.get(Subject, lesson.subject_id)
        skill_name = (lesson.content_json or {}).get("skill") or (
            subj.name if subj else lesson.title
        )
        upsert_skill(db, child.id, lesson.subject_id, str(skill_name), 100)
    elif existing.status != "completed":
        existing.status = "in_progress"

    new_rewards = finalize_learning_event(db, child, stars_awarded)
    return ProgressResult(
        stars_awarded=stars_awarded,
        total_stars=child.total_stars,
        streak_days=child.streak_days,
        new_rewards=[RewardOut.model_validate(r) for r in new_rewards],
        encouragement=pick_encouragement(),
    )


@router.post("/activity", response_model=ProgressResult)
def record_activity_progress(
    payload: ActivityProgressIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a completed game or lesson activity attempt (first per local day awards stars)."""
    child = verify_child_access(db, current_user, payload.child_id)

    game: Game | None = None
    activity: Activity | None = None
    lesson: Lesson | None = None

    if payload.game_id:
        game = db.scalar(
            select(Game).where(Game.id == payload.game_id, Game.status == "published")
        )
        if not game:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    else:
        activity = db.get(Activity, payload.activity_id)
        if not activity:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found.")
        lesson = db.get(Lesson, activity.lesson_id)
        if not lesson:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    earned = stars_for_score(payload.score_pct) if payload.completed else 0
    today = local_today()
    cutoff_utc = datetime.now(timezone.utc) - timedelta(days=2)

    if payload.game_id:
        prior_dates = list(
            db.scalars(
                select(ActivityAttempt.created_at).where(
                    ActivityAttempt.child_id == child.id,
                    ActivityAttempt.game_id == payload.game_id,
                    ActivityAttempt.completed.is_(True),
                    ActivityAttempt.created_at >= cutoff_utc,
                )
            ).all()
        )
    else:
        prior_dates = list(
            db.scalars(
                select(ActivityAttempt.created_at).where(
                    ActivityAttempt.child_id == child.id,
                    ActivityAttempt.activity_id == payload.activity_id,
                    ActivityAttempt.completed.is_(True),
                    ActivityAttempt.created_at >= cutoff_utc,
                )
            ).all()
        )

    already_today = any(
        dt is not None and to_local_date(dt) == today
        for dt in prior_dates
    )
    stars_awarded = earned if (payload.completed and not already_today) else 0

    attempt = ActivityAttempt(
        child_id=child.id,
        game_id=payload.game_id,
        activity_id=payload.activity_id,
        score_pct=payload.score_pct,
        stars_earned=earned,
        attempts_count=payload.attempts_count,
        duration_seconds=payload.duration_seconds,
        completed=payload.completed,
    )
    db.add(attempt)

    if game:
        skill_name = (game.config_json or {}).get("skill") or game.title
        upsert_skill(db, child.id, game.subject_id, str(skill_name), payload.score_pct)
    elif activity and lesson:
        upsert_skill(db, child.id, lesson.subject_id, activity.title, payload.score_pct)

    new_rewards = finalize_learning_event(db, child, stars_awarded)
    return ProgressResult(
        stars_awarded=stars_awarded,
        total_stars=child.total_stars,
        streak_days=child.streak_days,
        new_rewards=[RewardOut.model_validate(r) for r in new_rewards],
        encouragement=pick_encouragement(),
        score_pct=payload.score_pct,
    )


@router.post("/quiz", response_model=ProgressResult)
def record_quiz_progress(
    payload: QuizProgressIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Score a quiz server-side and award star improvement over previous attempts."""
    child = verify_child_access(db, current_user, payload.child_id)
    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == payload.quiz_id)
    )
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    questions = sorted(quiz.questions, key=lambda q: q.sort_order)
    if len(payload.answers) != len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Let's answer every question before submitting!",
        )

    correct_count = sum(
        1 for q, ans in zip(questions, payload.answers) if ans == q.correct_option_index
    )
    total_questions = len(questions)
    score_pct = round(100 * correct_count / total_questions) if total_questions else 100
    stars = stars_for_score(score_pct)

    best_prev = (
        db.scalar(
            select(func.coalesce(func.max(QuizResult.stars_earned), 0)).where(
                QuizResult.child_id == child.id,
                QuizResult.quiz_id == quiz.id,
            )
        )
        or 0
    )
    stars_awarded = max(0, stars - best_prev)

    db.add(
        QuizResult(
            child_id=child.id,
            quiz_id=quiz.id,
            score_pct=score_pct,
            stars_earned=stars,
            answers_json={"answers": payload.answers},
        )
    )

    new_rewards = finalize_learning_event(db, child, stars_awarded)
    return ProgressResult(
        stars_awarded=stars_awarded,
        total_stars=child.total_stars,
        streak_days=child.streak_days,
        new_rewards=[RewardOut.model_validate(r) for r in new_rewards],
        encouragement=pick_encouragement(),
        score_pct=score_pct,
        correct_count=correct_count,
        total_questions=total_questions,
    )


@router.get("/summary/{child_id}", response_model=ProgressSummaryOut)
def get_progress_summary(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return child lesson statuses, completed game IDs, earned rewards, and today's minutes."""
    child = verify_child_access(db, current_user, child_id)
    today = local_today()

    lesson_rows = list(
        db.scalars(select(LessonProgress).where(LessonProgress.child_id == child.id)).all()
    )
    attempt_rows = list(
        db.scalars(select(ActivityAttempt).where(ActivityAttempt.child_id == child.id)).all()
    )
    rewards = list(
        db.scalars(
            select(ChildReward)
            .where(ChildReward.child_id == child.id)
            .order_by(ChildReward.awarded_at.desc())
        ).all()
    )

    completed_game_ids = sorted(
        {
            row.game_id
            for row in attempt_rows
            if row.completed and row.game_id is not None
        }
    )

    today_secs = 0
    for lp in lesson_rows:
        ts = lp.completed_at or lp.updated_at or lp.created_at
        if ts and to_local_date(ts) == today:
            today_secs += lp.time_spent_seconds
    for att in attempt_rows:
        if att.created_at and to_local_date(att.created_at) == today:
            today_secs += att.duration_seconds

    return ProgressSummaryOut(
        child=ChildOut.model_validate(child),
        lesson_statuses=[
            LessonStatusItem(
                lesson_id=lp.lesson_id,
                status=lp.status,
                completion_pct=lp.completion_pct,
                stars_earned=lp.stars_earned,
            )
            for lp in lesson_rows
        ],
        completed_game_ids=completed_game_ids,
        rewards=[RewardOut.model_validate(r) for r in rewards],
        today_minutes=round(today_secs / 60),
    )
