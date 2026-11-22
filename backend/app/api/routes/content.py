from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.content import Game, Lesson, Quiz, Subject, Theme
from app.models.parent import HomeActivity
from app.models.user import User
from app.schemas.content import (
    ActivityOut,
    GameOut,
    HomeActivityOut,
    LearningObjectiveOut,
    LessonDetailOut,
    LessonOut,
    ParentGuideOut,
    QuizOut,
    QuizQuestionOut,
    SubjectOut,
    ThemeDetailOut,
    ThemeOut,
)
from app.services.game_generator import build_weekly_game_config

router = APIRouter(tags=["Learning Content"])


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(
    _current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Return all active learning modules with published lesson counts."""
    subjects = list(
        db.scalars(
            select(Subject).where(Subject.is_active.is_(True)).order_by(Subject.sort_order.asc())
        ).all()
    )
    subject_ids = [s.id for s in subjects]
    counts_by_subject: dict[str, int] = {}
    if subject_ids:
        counts_by_subject = {
            sid: cnt
            for sid, cnt in db.execute(
                select(Lesson.subject_id, func.count(Lesson.id))
                .where(Lesson.subject_id.in_(subject_ids), Lesson.status == "published")
                .group_by(Lesson.subject_id)
            ).all()
        }
    results: list[SubjectOut] = []
    for subj in subjects:
        item = SubjectOut.model_validate(subj)
        item.lesson_count = counts_by_subject.get(subj.id, 0)
        results.append(item)
    return results


@router.get("/themes", response_model=list[ThemeOut])
def list_themes(
    _current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """List weekly learning themes ordered by week number."""
    themes = list(
        db.scalars(
            select(Theme).where(Theme.status == "published").order_by(Theme.week_number.asc())
        ).all()
    )
    return [ThemeOut.model_validate(t) for t in themes]


@router.get("/themes/{theme_id}", response_model=ThemeDetailOut)
def get_theme_detail(
    theme_id: str,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return full theme detail including objectives, parent guide, home activities, and lessons."""
    theme = db.scalar(
        select(Theme)
        .options(
            selectinload(Theme.objectives),
            selectinload(Theme.parent_guide),
            selectinload(Theme.lessons),
        )
        .where(Theme.id == theme_id)
    )
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found.")

    home_activities = list(
        db.scalars(
            select(HomeActivity)
            .where(HomeActivity.theme_id == theme.id)
            .order_by(HomeActivity.sort_order.asc())
        ).all()
    )

    return ThemeDetailOut(
        id=theme.id,
        week_number=theme.week_number,
        slug=theme.slug,
        title=theme.title,
        summary=theme.summary,
        color_hex=theme.color_hex,
        status=theme.status,
        published_at=theme.published_at,
        objectives=[
            LearningObjectiveOut.model_validate(o)
            for o in sorted(theme.objectives, key=lambda x: x.sort_order)
        ],
        parent_guide=ParentGuideOut.model_validate(theme.parent_guide) if theme.parent_guide else None,
        home_activities=[HomeActivityOut.model_validate(ha) for ha in home_activities],
        lessons=[LessonOut.model_validate(l) for l in theme.lessons if l.status == "published"],
    )


@router.get("/lessons", response_model=list[LessonOut])
def list_lessons(
    subject_id: Optional[str] = Query(default=None),
    theme_id: Optional[str] = Query(default=None),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List published lessons optionally filtered by subject or theme."""
    stmt = select(Lesson).where(Lesson.status == "published")
    if subject_id:
        stmt = stmt.where(Lesson.subject_id == subject_id)
    if theme_id:
        stmt = stmt.where(Lesson.theme_id == theme_id)
    lessons = list(db.scalars(stmt.order_by(Lesson.title.asc())).all())
    return [LessonOut.model_validate(l) for l in lessons]


@router.get("/lessons/{lesson_id}", response_model=LessonDetailOut)
def get_lesson(
    lesson_id: str,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single lesson with its sorted practice activities."""
    lesson = db.scalar(
        select(Lesson)
        .options(selectinload(Lesson.activities))
        .where(Lesson.id == lesson_id, Lesson.status == "published")
    )
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    sorted_activities = sorted(lesson.activities, key=lambda a: a.sort_order)
    return LessonDetailOut(
        id=lesson.id,
        subject_id=lesson.subject_id,
        theme_id=lesson.theme_id,
        slug=lesson.slug,
        title=lesson.title,
        summary=lesson.summary,
        content_json=lesson.content_json,
        age_group=lesson.age_group,
        estimated_minutes=lesson.estimated_minutes,
        audio_narration_text=lesson.audio_narration_text,
        status=lesson.status,
        activities=[ActivityOut.model_validate(a) for a in sorted_activities],
    )


@router.get("/lessons/{lesson_id}/quiz", response_model=Optional[QuizOut])
def get_lesson_quiz(
    lesson_id: str,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the mini check-in quiz associated with a lesson, or null if none."""
    lesson = db.scalar(
        select(Lesson).where(Lesson.id == lesson_id, Lesson.status == "published")
    )
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    quiz = db.scalar(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.lesson_id == lesson.id)
        .order_by(Quiz.created_at.asc())
        .limit(1)
    )
    if not quiz:
        return None

    sorted_questions = sorted(quiz.questions, key=lambda q: q.sort_order)
    return QuizOut(
        id=quiz.id,
        title=quiz.title,
        instructions=quiz.instructions,
        passing_stars=quiz.passing_stars,
        questions=[QuizQuestionOut.model_validate(q) for q in sorted_questions],
    )


@router.get("/games", response_model=list[GameOut])
def list_games(
    subject_id: Optional[str] = Query(default=None),
    theme_id: Optional[str] = Query(default=None),
    week: Optional[str] = Query(default=None),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List educational games with weekly rotating 12-question configurations."""
    stmt = select(Game).where(Game.status == "published")
    if subject_id:
        stmt = stmt.where(Game.subject_id == subject_id)
    if theme_id:
        stmt = stmt.where(Game.theme_id == theme_id)
    games = list(db.scalars(stmt.order_by(Game.title.asc())).all())
    return [
        GameOut(
            id=g.id,
            slug=g.slug,
            title=g.title,
            game_type=g.game_type,
            subject_id=g.subject_id,
            theme_id=g.theme_id,
            instructions=g.instructions,
            difficulty_level=g.difficulty_level,
            config_json=build_weekly_game_config(g.slug, g.config_json, week=week),
            status=g.status,
        )
        for g in games
    ]


@router.get("/games/{game_id}", response_model=GameOut)
def get_game(
    game_id: str,
    week: Optional[str] = Query(default=None),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single published educational game with the active week's question mix."""
    game = db.scalar(
        select(Game).where(Game.id == game_id, Game.status == "published")
    )
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    return GameOut(
        id=game.id,
        slug=game.slug,
        title=game.title,
        game_type=game.game_type,
        subject_id=game.subject_id,
        theme_id=game.theme_id,
        instructions=game.instructions,
        difficulty_level=game.difficulty_level,
        config_json=build_weekly_game_config(game.slug, game.config_json, week=week),
        status=game.status,
    )
