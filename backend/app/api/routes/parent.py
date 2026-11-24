from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_roles, verify_child_access
from app.core.database import get_db
from app.models.content import Activity, Game, Lesson, Quiz, Subject, Theme
from app.models.learner import (
    Child,
    ClassEnrollment,
    TeacherClassAssignment,
)
from app.models.parent import (
    HomeActivity,
    HomeActivityProgress,
    LearningGoal,
    ParentReflection,
)
from app.models.progress import (
    ActivityAttempt,
    Assignment,
    ChildReward,
    LessonProgress,
    QuizResult,
    SkillProgress,
)
from app.models.system import Notification
from app.models.teacher import Announcement, TeacherFeedback, TeacherObservation
from app.models.user import ParentProfile, User
from app.repositories.learner_repo import get_children_for_parent, parent_owns_child
from app.schemas.content import (
    HomeActivityOut,
    LearningObjectiveOut,
    LessonOut,
    ParentGuideOut,
    ThemeDetailOut,
    ThemeOut,
)
from app.schemas.learner import ChildOut, RewardOut, SkillProgressOut
from app.schemas.portal import (
    ActivityHistoryItem,
    AnnouncementOut,
    AssignedActivityOut,
    HomeActivityProgressIn,
    HomeActivityProgressOut,
    LearningGoalIn,
    LearningGoalOut,
    LearningGoalUpdate,
    NotificationListOut,
    NotificationOut,
    ParentChildDashboardItem,
    ParentChildDigestOut,
    ParentDashboardOut,
    ParentHomeLearningThemeOut,
    ParentPinVerifyIn,
    ParentPinVerifyOut,
    ParentReflectionIn,
    ParentReflectionOut,
    ParentSettingsOut,
    ParentSettingsUpdate,
    RecommendedHomeActivityOut,
    TeacherFeedbackOut,
    TeacherObservationOut,
    WeeklyActivityPoint,
    WeeklyReportOut,
    WorksheetOut,
)
from app.core.security import hash_password, verify_password
from app.services.audit_service import record_audit
from app.services.progress_service import finalize_learning_event, local_today, to_local_date

router = APIRouter(prefix="/parent", tags=["Parent Portal"])


def _ensure_utc(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _ensure_parent_owns_child(db: Session, current_user: User, child_id: str) -> Child:
    roles = set(current_user.role_names)
    if "admin" not in roles and not parent_owns_child(db, current_user.id, child_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage this learner profile.",
        )
    child = db.get(Child, child_id)
    if not child or not child.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")
    return child


def _resolve_target_child(
    db: Session, current_user: User, child_id: Optional[str]
) -> Optional[Child]:
    if child_id:
        return verify_child_access(db, current_user, child_id)
    roles = set(current_user.role_names)
    if "admin" in roles and "parent" not in roles:
        return db.scalar(
            select(Child).where(Child.is_active.is_(True)).order_by(Child.display_name.asc()).limit(1)
        )
    children = get_children_for_parent(db, current_user.id)
    return children[0] if children else None


def _notify_child_teachers(
    db: Session, child_id: str, title: str, message: str, category: str
) -> None:
    teacher_ids = list(
        db.scalars(
            select(TeacherClassAssignment.teacher_user_id)
            .join(ClassEnrollment, ClassEnrollment.class_id == TeacherClassAssignment.class_id)
            .where(
                ClassEnrollment.child_id == child_id,
                ClassEnrollment.status == "active",
            )
            .distinct()
        ).all()
    )
    for teacher_id in teacher_ids:
        db.add(
            Notification(
                user_id=teacher_id,
                title=title,
                message=message,
                category=category,
                is_read=False,
            )
        )


def _build_weekly_activity_from_rows(
    progress_rows: list[LessonProgress],
    attempt_rows: list[ActivityAttempt],
) -> list[WeeklyActivityPoint]:
    now = datetime.now(timezone.utc)
    days_order = [(now - timedelta(days=offset)).strftime("%a") for offset in range(6, -1, -1)]
    minutes_by_day: dict[str, int] = defaultdict(int)
    lessons_by_day: dict[str, int] = defaultdict(int)

    cutoff = now - timedelta(days=7)
    for row in progress_rows:
        ts = _ensure_utc(row.completed_at or row.updated_at or row.created_at)
        if ts >= cutoff:
            day_key = ts.strftime("%a")
            minutes_by_day[day_key] += max(1, round(row.time_spent_seconds / 60))
            if row.status == "completed":
                lessons_by_day[day_key] += 1

    for row in attempt_rows:
        ts = _ensure_utc(row.created_at)
        if ts >= cutoff:
            day_key = ts.strftime("%a")
            minutes_by_day[day_key] += max(1, round(row.duration_seconds / 60))

    return [
        WeeklyActivityPoint(
            day=day_label,
            minutes=minutes_by_day.get(day_label, 0),
            lessons=lessons_by_day.get(day_label, 0),
        )
        for day_label in days_order
    ]


def _build_weekly_activity(db: Session, child_id: str) -> list[WeeklyActivityPoint]:
    progress_rows = list(
        db.scalars(select(LessonProgress).where(LessonProgress.child_id == child_id)).all()
    )
    attempt_rows = list(
        db.scalars(select(ActivityAttempt).where(ActivityAttempt.child_id == child_id)).all()
    )
    return _build_weekly_activity_from_rows(progress_rows, attempt_rows)


def _build_child_digest(
    child: Child,
    skills_rows: list[tuple[SkillProgress, str]],
    weekly_pts: list[WeeklyActivityPoint],
) -> tuple[int, ParentChildDigestOut]:
    """Generate a deterministic 5-second bilingual English/Filipino weekly parent insight."""
    days_active = sum(1 for pt in weekly_pts if pt.minutes > 0 or pt.lessons > 0)
    sorted_skills = sorted(skills_rows, key=lambda pair: pair[0].mastery_pct, reverse=True)

    if sorted_skills:
        top_skill = sorted_skills[0][0]
        strength_en = f"{child.display_name} is thriving in {top_skill.skill_name} ({top_skill.mastery_pct}% confidence) and learned on {days_active} day(s) this week."
        strength_fil = f"Masaya at magaling si {child.display_name} sa {top_skill.skill_name} ({top_skill.mastery_pct}%) at nag-aral ng {days_active} araw ngayong linggo!"
    else:
        strength_en = f"{child.display_name} has {child.total_stars} stars and is ready for gentle discovery."
        strength_fil = f"May {child.total_stars} bituin si {child.display_name} at handa nang matuto ngayong linggo!"

    weakest = sorted(skills_rows, key=lambda pair: pair[0].mastery_pct)
    if weakest and weakest[0][0].mastery_pct < 75:
        next_skill = weakest[0][0].skill_name
        next_step_en = f"Gentle next step: spend 5 playful minutes practicing {next_skill} or enjoy tonight's zero-cost home game together."
        next_step_fil = f"Susunod na hakbang: maglaro ng 5 minuto sa {next_skill} o subukan ang libreng gawaing-bahay mamayang gabi."
    else:
        next_step_en = "Tonight's idea: try the weekly zero-cost Home Learning activity together after dinner!"
        next_step_fil = "Ideya ngayong gabi: gawin kasama ang pamilya ang libreng Home Activity pagkatapos kumain!"

    return days_active, ParentChildDigestOut(
        strength_en=strength_en,
        strength_fil=strength_fil,
        next_step_en=next_step_en,
        next_step_fil=next_step_fil,
        days_active_this_week=days_active,
    )


@router.get("/dashboard", response_model=ParentDashboardOut)
def get_parent_dashboard(
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Aggregate real child progress, current theme, announcements, and notifications for parents."""
    roles = set(current_user.role_names)
    if "admin" in roles and "parent" not in roles:
        children = list(
            db.scalars(
                select(Child).where(Child.is_active.is_(True)).order_by(Child.display_name.asc())
            ).all()
        )
    else:
        children = get_children_for_parent(db, current_user.id)

    total_published_lessons = (
        db.scalar(select(func.count(Lesson.id)).where(Lesson.status == "published")) or 0
    )

    child_ids = [c.id for c in children]
    lp_by_child: dict[str, list[LessonProgress]] = defaultdict(list)
    att_by_child: dict[str, list[ActivityAttempt]] = defaultdict(list)
    rewards_by_child: dict[str, list[ChildReward]] = defaultdict(list)
    skills_by_child: dict[str, list[tuple[SkillProgress, str]]] = defaultdict(list)
    enrollments_by_child: dict[str, set[str]] = defaultdict(set)
    all_assignments: list[Assignment] = []

    if child_ids:
        for lp in db.scalars(
            select(LessonProgress).where(LessonProgress.child_id.in_(child_ids))
        ).all():
            lp_by_child[lp.child_id].append(lp)

        for att in db.scalars(
            select(ActivityAttempt).where(ActivityAttempt.child_id.in_(child_ids))
        ).all():
            att_by_child[att.child_id].append(att)

        for reward in db.scalars(
            select(ChildReward)
            .where(ChildReward.child_id.in_(child_ids))
            .order_by(ChildReward.awarded_at.desc())
        ).all():
            if len(rewards_by_child[reward.child_id]) < 5:
                rewards_by_child[reward.child_id].append(reward)

        for sp, subj_name in db.execute(
            select(SkillProgress, Subject.name)
            .join(Subject, Subject.id == SkillProgress.subject_id)
            .where(SkillProgress.child_id.in_(child_ids))
        ).all():
            skills_by_child[sp.child_id].append((sp, subj_name))

        all_enrolled_class_ids: set[str] = set()
        for cid_row, cls_id_row in db.execute(
            select(ClassEnrollment.child_id, ClassEnrollment.class_id).where(
                ClassEnrollment.child_id.in_(child_ids),
                ClassEnrollment.status == "active",
            )
        ).all():
            enrollments_by_child[cid_row].add(cls_id_row)
            all_enrolled_class_ids.add(cls_id_row)

        assignment_conds = [Assignment.child_id.in_(child_ids)]
        if all_enrolled_class_ids:
            assignment_conds.append(Assignment.class_id.in_(all_enrolled_class_ids))
        all_assignments = list(
            db.scalars(
                select(Assignment)
                .where(or_(*assignment_conds))
                .order_by(Assignment.created_at.desc())
            ).all()
        )

    child_items: list[ParentChildDashboardItem] = []
    for child in children:
        c_lps = lp_by_child.get(child.id, [])
        c_atts = att_by_child.get(child.id, [])
        lessons_done = sum(1 for lp in c_lps if lp.status == "completed")
        lesson_secs = sum(lp.time_spent_seconds or 0 for lp in c_lps)
        game_secs = sum(att.duration_seconds or 0 for att in c_atts)
        rewards = rewards_by_child.get(child.id, [])
        skills_rows = skills_by_child.get(child.id, [])
        completed_lesson_ids = {lp.lesson_id for lp in c_lps if lp.status == "completed"}
        completed_game_ids = {att.game_id for att in c_atts if att.completed and att.game_id}
        c_class_ids = enrollments_by_child.get(child.id, set())
        c_assigned = [
            AssignedActivityOut(
                id=a.id,
                title=a.title,
                lesson_id=a.lesson_id,
                game_id=a.game_id,
                due_date=a.due_date,
                completed=(
                    (a.lesson_id in completed_lesson_ids if a.lesson_id else False)
                    or (a.game_id in completed_game_ids if a.game_id else False)
                ),
            )
            for a in all_assignments
            if a.child_id == child.id or (a.class_id and a.class_id in c_class_ids)
        ]

        weekly_pts = _build_weekly_activity_from_rows(c_lps, c_atts)
        days_active, digest = _build_child_digest(child, skills_rows, weekly_pts)

        child_items.append(
            ParentChildDashboardItem(
                child=ChildOut.model_validate(child),
                lessons_completed=lessons_done,
                total_lessons=total_published_lessons,
                total_time_minutes=round((lesson_secs + game_secs) / 60),
                days_active_this_week=days_active,
                digest=digest,
                recent_rewards=[RewardOut.model_validate(r) for r in rewards],
                skills=[
                    SkillProgressOut(
                        id=sp.id,
                        subject_id=sp.subject_id,
                        subject_name=subj_name,
                        skill_name=sp.skill_name,
                        mastery_pct=sp.mastery_pct,
                        practice_count=sp.practice_count,
                    )
                    for sp, subj_name in skills_rows
                ],
                weekly_activity=weekly_pts,
                assigned_activities=c_assigned,
            )
        )

    current_theme_obj = db.scalar(
        select(Theme)
        .options(
            selectinload(Theme.objectives),
            selectinload(Theme.parent_guide),
            selectinload(Theme.lessons),
        )
        .where(Theme.status == "published")
        .order_by(Theme.week_number.asc())
        .limit(1)
    )
    current_theme_detail = None
    if current_theme_obj:
        home_acts = list(
            db.scalars(
                select(HomeActivity)
                .where(HomeActivity.theme_id == current_theme_obj.id)
                .order_by(HomeActivity.sort_order.asc())
            ).all()
        )
        completed_ids: set[str] = set()
        if children:
            completed_ids = set(
                db.scalars(
                    select(HomeActivityProgress.home_activity_id).where(
                        HomeActivityProgress.child_id == children[0].id,
                        HomeActivityProgress.completed.is_(True),
                    )
                ).all()
            )
        current_theme_detail = ThemeDetailOut(
            id=current_theme_obj.id,
            week_number=current_theme_obj.week_number,
            slug=current_theme_obj.slug,
            title=current_theme_obj.title,
            summary=current_theme_obj.summary,
            color_hex=current_theme_obj.color_hex,
            status=current_theme_obj.status,
            published_at=current_theme_obj.published_at,
            objectives=[
                LearningObjectiveOut.model_validate(o)
                for o in sorted(current_theme_obj.objectives, key=lambda x: x.sort_order)
            ],
            parent_guide=(
                ParentGuideOut.model_validate(current_theme_obj.parent_guide)
                if current_theme_obj.parent_guide
                else None
            ),
            home_activities=[
                HomeActivityOut(
                    id=ha.id,
                    title=ha.title,
                    instructions_json=ha.instructions_json,
                    materials_json=ha.materials_json,
                    estimated_minutes=ha.estimated_minutes,
                    sort_order=ha.sort_order,
                    completed=ha.id in completed_ids,
                )
                for ha in home_acts
            ],
            lessons=[
                LessonOut.model_validate(l)
                for l in current_theme_obj.lessons
                if l.status == "published"
            ],
        )

    announcements = list(
        db.scalars(select(Announcement).order_by(Announcement.published_at.desc()).limit(5)).all()
    )
    notifications = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(8)
        ).all()
    )
    unread_notification_count = (
        db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        )
        or 0
    )

    return ParentDashboardOut(
        children=child_items,
        current_theme=current_theme_detail,
        announcements=[AnnouncementOut.model_validate(a) for a in announcements],
        notifications=[NotificationOut.model_validate(n) for n in notifications],
        unread_notification_count=unread_notification_count,
    )


def _build_home_learning_item(
    db: Session,
    theme: Theme,
    completed_ids: set[str],
    reflections_by_theme: dict[str, list[ParentReflection]],
    activities: Optional[list[HomeActivity]] = None,
) -> ParentHomeLearningThemeOut:
    acts = (
        activities
        if activities is not None
        else list(
            db.scalars(
                select(HomeActivity)
                .where(HomeActivity.theme_id == theme.id)
                .order_by(HomeActivity.sort_order.asc())
            ).all()
        )
    )
    return ParentHomeLearningThemeOut(
        theme=ThemeOut.model_validate(theme),
        parent_guide=(
            ParentGuideOut.model_validate(theme.parent_guide)
            if theme.parent_guide
            else None
        ),
        home_activities=[
            HomeActivityOut(
                id=a.id,
                title=a.title,
                instructions_json=a.instructions_json,
                materials_json=a.materials_json,
                estimated_minutes=a.estimated_minutes,
                sort_order=a.sort_order,
                completed=a.id in completed_ids,
            )
            for a in acts
        ],
        objectives=[
            LearningObjectiveOut.model_validate(o)
            for o in sorted(theme.objectives, key=lambda x: x.sort_order)
        ],
        worksheets=[WorksheetOut.model_validate(w) for w in theme.worksheets],
        reflections=[
            ParentReflectionOut(
                id=r.id,
                child_id=r.child_id,
                theme_id=r.theme_id,
                theme_title=theme.title,
                week_number=theme.week_number,
                enjoyed=r.enjoyed,
                easy_concepts=r.easy_concepts,
                challenging_concepts=r.challenging_concepts,
                discovery_notes=r.discovery_notes,
                created_at=r.created_at,
            )
            for r in reflections_by_theme.get(theme.id, [])
        ],
    )


@router.get("/home-learning", response_model=list[ParentHomeLearningThemeOut])
def list_home_learning(
    child_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Return weekly themes paired with Parent Guides, Home Activities, worksheets, and reflections."""
    target_child = _resolve_target_child(db, current_user, child_id)

    completed_ids: set[str] = set()
    reflections_by_theme: dict[str, list[ParentReflection]] = defaultdict(list)
    if target_child:
        completed_ids = set(
            db.scalars(
                select(HomeActivityProgress.home_activity_id).where(
                    HomeActivityProgress.child_id == target_child.id,
                    HomeActivityProgress.completed.is_(True),
                )
            ).all()
        )
        refl_rows = list(
            db.scalars(
                select(ParentReflection)
                .where(ParentReflection.child_id == target_child.id)
                .order_by(ParentReflection.created_at.desc())
            ).all()
        )
        for r in refl_rows:
            reflections_by_theme[r.theme_id].append(r)

    themes = list(
        db.scalars(
            select(Theme)
            .options(
                selectinload(Theme.parent_guide),
                selectinload(Theme.objectives),
                selectinload(Theme.worksheets),
            )
            .where(Theme.status == "published")
            .order_by(Theme.week_number.asc())
        ).all()
    )
    theme_ids = [t.id for t in themes]
    acts_by_theme: dict[str, list[HomeActivity]] = defaultdict(list)
    if theme_ids:
        for ha in db.scalars(
            select(HomeActivity)
            .where(HomeActivity.theme_id.in_(theme_ids))
            .order_by(HomeActivity.sort_order.asc())
        ).all():
            acts_by_theme[ha.theme_id].append(ha)

    return [
        _build_home_learning_item(
            db,
            theme,
            completed_ids,
            reflections_by_theme,
            activities=acts_by_theme.get(theme.id, []),
        )
        for theme in themes
    ]


@router.get("/home-learning/{theme_id}", response_model=ParentHomeLearningThemeOut)
def get_home_learning_theme(
    theme_id: str,
    child_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Return a single weekly theme's Parent Guide, Home Activities, worksheets, and reflections."""
    target_child = _resolve_target_child(db, current_user, child_id)
    theme = db.scalar(
        select(Theme)
        .options(
            selectinload(Theme.parent_guide),
            selectinload(Theme.objectives),
            selectinload(Theme.worksheets),
        )
        .where(Theme.id == theme_id)
    )
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found.")

    completed_ids: set[str] = set()
    reflections_by_theme: dict[str, list[ParentReflection]] = defaultdict(list)
    if target_child:
        completed_ids = set(
            db.scalars(
                select(HomeActivityProgress.home_activity_id).where(
                    HomeActivityProgress.child_id == target_child.id,
                    HomeActivityProgress.completed.is_(True),
                )
            ).all()
        )
        reflections_by_theme[theme.id] = list(
            db.scalars(
                select(ParentReflection)
                .where(
                    ParentReflection.child_id == target_child.id,
                    ParentReflection.theme_id == theme.id,
                )
                .order_by(ParentReflection.created_at.desc())
            ).all()
        )

    return _build_home_learning_item(db, theme, completed_ids, reflections_by_theme)


@router.post("/home-activities/{home_activity_id}/progress", response_model=HomeActivityProgressOut)
def toggle_home_activity_progress(
    home_activity_id: str,
    payload: HomeActivityProgressIn,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Mark a Home Learning activity complete or incomplete for an owned child."""
    child = _ensure_parent_owns_child(db, current_user, payload.child_id)
    ha = db.get(HomeActivity, home_activity_id)
    if not ha:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home activity not found.")

    existing = db.scalar(
        select(HomeActivityProgress).where(
            HomeActivityProgress.child_id == child.id,
            HomeActivityProgress.home_activity_id == ha.id,
        )
    )
    now = datetime.now(timezone.utc)
    was_completed_before = existing is not None and existing.completed_at is not None

    if not existing:
        existing = HomeActivityProgress(
            child_id=child.id,
            home_activity_id=ha.id,
            parent_user_id=current_user.id,
            completed=payload.completed,
            completed_at=now if payload.completed else None,
        )
        db.add(existing)
    else:
        existing.completed = payload.completed
        if payload.completed and existing.completed_at is None:
            existing.completed_at = now

    stars_awarded = 0
    if payload.completed and not was_completed_before:
        stars_awarded = 2
        ha_theme = db.get(Theme, ha.theme_id) if ha.theme_id else None
        _notify_child_teachers(
            db,
            child.id,
            title=f"{child.display_name} completed a Home Learning activity",
            message=f"Completed '{ha.title}' at home with family!",
            category="home_activity",
        )
        finalize_learning_event(
            db,
            child,
            stars_awarded,
            raindrops=1,
            sticker_slug=ha_theme.slug if ha_theme else None,
        )
    else:
        db.commit()

    db.refresh(existing)
    db.refresh(child)
    return HomeActivityProgressOut(
        home_activity_id=ha.id,
        child_id=child.id,
        completed=existing.completed,
        completed_at=existing.completed_at,
        stars_awarded=stars_awarded,
        total_stars=child.total_stars,
    )


@router.get("/reflections", response_model=list[ParentReflectionOut])
def list_reflections(
    child_id: Optional[str] = Query(default=None),
    theme_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """List saved parent reflections scoped to authorized children."""
    if child_id:
        child = verify_child_access(db, current_user, child_id)
        child_ids = [child.id]
    else:
        roles = set(current_user.role_names)
        if "admin" in roles and "parent" not in roles:
            child_ids = list(db.scalars(select(Child.id).where(Child.is_active.is_(True))).all())
        else:
            child_ids = [c.id for c in get_children_for_parent(db, current_user.id)]

    if not child_ids:
        return []

    stmt = (
        select(ParentReflection, Theme.title, Theme.week_number)
        .join(Theme, Theme.id == ParentReflection.theme_id)
        .where(ParentReflection.child_id.in_(child_ids))
    )
    if theme_id:
        stmt = stmt.where(ParentReflection.theme_id == theme_id)

    rows = list(db.execute(stmt.order_by(ParentReflection.created_at.desc())).all())
    return [
        ParentReflectionOut(
            id=r.id,
            child_id=r.child_id,
            theme_id=r.theme_id,
            theme_title=theme_title,
            week_number=week_number,
            enjoyed=r.enjoyed,
            easy_concepts=r.easy_concepts,
            challenging_concepts=r.challenging_concepts,
            discovery_notes=r.discovery_notes,
            created_at=r.created_at,
        )
        for r, theme_title, week_number in rows
    ]


@router.post("/reflections", response_model=ParentReflectionOut, status_code=status.HTTP_201_CREATED)
def create_reflection(
    payload: ParentReflectionIn,
    request: Request,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Save a parent's reflection on a weekly home learning theme."""
    child = _ensure_parent_owns_child(db, current_user, payload.child_id)
    theme = db.get(Theme, payload.theme_id)
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found.")

    reflection = ParentReflection(
        parent_user_id=current_user.id,
        child_id=child.id,
        theme_id=theme.id,
        enjoyed=payload.enjoyed,
        easy_concepts=payload.easy_concepts.strip() if payload.easy_concepts else None,
        challenging_concepts=(
            payload.challenging_concepts.strip() if payload.challenging_concepts else None
        ),
        discovery_notes=payload.discovery_notes.strip() if payload.discovery_notes else None,
    )
    db.add(reflection)
    db.flush()

    _notify_child_teachers(
        db,
        child.id,
        title=f"New parent reflection for {child.display_name}",
        message=f"Family shared notes on Week {theme.week_number}: {theme.title}.",
        category="reflection",
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="parent.reflection_created",
        resource_type="parent_reflection",
        resource_id=reflection.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(reflection)

    return ParentReflectionOut(
        id=reflection.id,
        child_id=reflection.child_id,
        theme_id=reflection.theme_id,
        theme_title=theme.title,
        week_number=theme.week_number,
        enjoyed=reflection.enjoyed,
        easy_concepts=reflection.easy_concepts,
        challenging_concepts=reflection.challenging_concepts,
        discovery_notes=reflection.discovery_notes,
        created_at=reflection.created_at,
    )


@router.get("/goals", response_model=list[LearningGoalOut])
def list_learning_goals(
    child_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """List learning goals for authorized children."""
    if child_id:
        child = verify_child_access(db, current_user, child_id)
        child_ids = [child.id]
    else:
        roles = set(current_user.role_names)
        if "admin" in roles and "parent" not in roles:
            child_ids = list(db.scalars(select(Child.id).where(Child.is_active.is_(True))).all())
        else:
            child_ids = [c.id for c in get_children_for_parent(db, current_user.id)]

    if not child_ids:
        return []

    goals = list(
        db.scalars(
            select(LearningGoal)
            .where(LearningGoal.child_id.in_(child_ids))
            .order_by(LearningGoal.created_at.desc())
        ).all()
    )
    return [LearningGoalOut.model_validate(g) for g in goals]


@router.post("/goals", response_model=LearningGoalOut, status_code=status.HTTP_201_CREATED)
def create_learning_goal(
    payload: LearningGoalIn,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Create a learning goal for a child and sync their daily goal minutes if active."""
    child = _ensure_parent_owns_child(db, current_user, payload.child_id)
    goal = LearningGoal(
        child_id=child.id,
        parent_user_id=current_user.id,
        title=payload.title.strip(),
        target_minutes_per_day=payload.target_minutes_per_day,
        target_lessons_per_week=payload.target_lessons_per_week,
        is_active=payload.is_active,
    )
    db.add(goal)
    if payload.is_active:
        child.daily_goal_minutes = payload.target_minutes_per_day
    db.commit()
    db.refresh(goal)
    return LearningGoalOut.model_validate(goal)


@router.patch("/goals/{goal_id}", response_model=LearningGoalOut)
def update_learning_goal(
    goal_id: str,
    payload: LearningGoalUpdate,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Update a child's learning goal."""
    goal = db.get(LearningGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learning goal not found.")

    child = _ensure_parent_owns_child(db, current_user, goal.child_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(goal, field, val.strip() if isinstance(val, str) else val)

    if goal.is_active:
        child.daily_goal_minutes = goal.target_minutes_per_day

    db.commit()
    db.refresh(goal)
    return LearningGoalOut.model_validate(goal)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_learning_goal(
    goal_id: str,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Delete a child's learning goal."""
    goal = db.get(LearningGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learning goal not found.")
    _ensure_parent_owns_child(db, current_user, goal.child_id)
    db.delete(goal)
    db.commit()
    return None


@router.get("/settings", response_model=ParentSettingsOut)
def get_parent_settings(
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Retrieve guardian screen-time, language, and notification settings."""
    profile = db.scalar(select(ParentProfile).where(ParentProfile.user_id == current_user.id))
    if not profile:
        profile = ParentProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return ParentSettingsOut(
        preferred_language=profile.preferred_language,
        daily_screen_limit_mins=profile.daily_screen_limit_mins,
        notifications_enabled=profile.notifications_enabled,
        has_parent_pin=bool(profile.parent_pin_hash),
    )


@router.patch("/settings", response_model=ParentSettingsOut)
def update_parent_settings(
    payload: ParentSettingsUpdate,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Update guardian screen-time, language, PIN, and notification settings."""
    profile = db.scalar(select(ParentProfile).where(ParentProfile.user_id == current_user.id))
    if not profile:
        profile = ParentProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()

    updates = payload.model_dump(exclude_unset=True)
    new_pin = updates.pop("parent_pin", None)
    clear_pin = updates.pop("clear_parent_pin", None)
    for field, val in updates.items():
        setattr(profile, field, val)
    if clear_pin:
        profile.parent_pin_hash = None
    elif new_pin:
        profile.parent_pin_hash = hash_password(new_pin)

    db.commit()
    db.refresh(profile)
    return ParentSettingsOut(
        preferred_language=profile.preferred_language,
        daily_screen_limit_mins=profile.daily_screen_limit_mins,
        notifications_enabled=profile.notifications_enabled,
        has_parent_pin=bool(profile.parent_pin_hash),
    )


@router.post("/verify-pin", response_model=ParentPinVerifyOut)
def verify_parent_pin(
    payload: ParentPinVerifyIn,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Verify the guardian's optional 4-digit PIN to exit Kids Mode or extend screen time."""
    profile = db.scalar(select(ParentProfile).where(ParentProfile.user_id == current_user.id))
    if not profile or not profile.parent_pin_hash:
        return ParentPinVerifyOut(valid=False)
    return ParentPinVerifyOut(valid=verify_password(payload.pin, profile.parent_pin_hash))


@router.get("/notifications", response_model=NotificationListOut)
def list_notifications(
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Return all notifications owned by the authenticated guardian."""
    items = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(30)
        ).all()
    )
    unread_count = sum(1 for item in items if not item.is_read)
    return NotificationListOut(
        unread_count=unread_count,
        items=[NotificationOut.model_validate(n) for n in items],
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Mark one notification as read (strictly scoped to current user)."""
    notif = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    if not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)
    return NotificationOut.model_validate(notif)


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications as read for the authenticated guardian."""
    unread = list(
        db.scalars(
            select(Notification).where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        ).all()
    )
    now = datetime.now(timezone.utc)
    for item in unread:
        item.is_read = True
        item.read_at = now
    db.commit()
    return {"updated": len(unread)}


@router.get("/reports", response_model=WeeklyReportOut)
def get_weekly_report(
    child_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Generate an encouraging, printable weekly learning report for one child."""
    child = _resolve_target_child(db, current_user, child_id)
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No learner profile found for weekly report.",
        )

    today = local_today()
    week_start = today - timedelta(days=6)
    prev_start = today - timedelta(days=13)
    prev_end = today - timedelta(days=7)

    lesson_rows = list(
        db.execute(
            select(LessonProgress, Lesson.title)
            .join(Lesson, Lesson.id == LessonProgress.lesson_id)
            .where(LessonProgress.child_id == child.id)
        ).all()
    )
    attempt_rows = list(
        db.execute(
            select(ActivityAttempt, Game.title, Activity.title)
            .outerjoin(Game, Game.id == ActivityAttempt.game_id)
            .outerjoin(Activity, Activity.id == ActivityAttempt.activity_id)
            .where(ActivityAttempt.child_id == child.id)
        ).all()
    )
    quiz_rows = list(
        db.execute(
            select(QuizResult, Quiz.title)
            .join(Quiz, Quiz.id == QuizResult.quiz_id)
            .where(QuizResult.child_id == child.id)
        ).all()
    )
    home_prog_rows = list(
        db.execute(
            select(HomeActivityProgress, HomeActivity.title)
            .join(HomeActivity, HomeActivity.id == HomeActivityProgress.home_activity_id)
            .where(
                HomeActivityProgress.child_id == child.id,
                HomeActivityProgress.completed.is_(True),
            )
        ).all()
    )

    this_week_secs = 0
    prev_week_secs = 0
    this_week_lessons = 0
    prev_week_lessons = 0
    games_this_week = 0
    home_this_week = 0
    completed_lesson_ids: set[str] = set()
    completed_game_ids: set[str] = set()
    history: list[ActivityHistoryItem] = []

    for lp, lesson_title in lesson_rows:
        ts = _ensure_utc(lp.completed_at or lp.updated_at or lp.created_at)
        d = to_local_date(ts)
        if lp.status == "completed":
            completed_lesson_ids.add(lp.lesson_id)
        if week_start <= d <= today:
            this_week_secs += lp.time_spent_seconds
            if lp.status == "completed":
                this_week_lessons += 1
        elif prev_start <= d <= prev_end:
            prev_week_secs += lp.time_spent_seconds
            if lp.status == "completed":
                prev_week_lessons += 1

        history.append(
            ActivityHistoryItem(
                activity_type="lesson",
                title=lesson_title,
                occurred_at=ts,
                stars_earned=lp.stars_earned,
                minutes=max(1, round(lp.time_spent_seconds / 60)) if lp.time_spent_seconds else 0,
            )
        )

    for att, game_title, act_title in attempt_rows:
        ts = _ensure_utc(att.created_at)
        d = to_local_date(ts)
        if att.completed and att.game_id:
            completed_game_ids.add(att.game_id)
        if week_start <= d <= today:
            this_week_secs += att.duration_seconds
            if att.completed and att.game_id:
                games_this_week += 1
        elif prev_start <= d <= prev_end:
            prev_week_secs += att.duration_seconds

        history.append(
            ActivityHistoryItem(
                activity_type="game",
                title=game_title or act_title or "Learning Activity",
                occurred_at=ts,
                stars_earned=att.stars_earned,
                minutes=max(1, round(att.duration_seconds / 60)) if att.duration_seconds else 0,
            )
        )

    for qr, quiz_title in quiz_rows:
        ts = _ensure_utc(qr.created_at)
        history.append(
            ActivityHistoryItem(
                activity_type="quiz",
                title=quiz_title,
                occurred_at=ts,
                stars_earned=qr.stars_earned,
                minutes=3,
            )
        )

    completed_home_ids: set[str] = set()
    for hp, ha_title in home_prog_rows:
        completed_home_ids.add(hp.home_activity_id)
        ts = _ensure_utc(hp.completed_at or hp.created_at)
        d = to_local_date(ts)
        if week_start <= d <= today:
            home_this_week += 1
        history.append(
            ActivityHistoryItem(
                activity_type="home_activity",
                title=ha_title,
                occurred_at=ts,
                stars_earned=2,
                minutes=10,
            )
        )

    history.sort(key=lambda item: item.occurred_at, reverse=True)
    history = history[:15]

    skills_rows = list(
        db.execute(
            select(SkillProgress, Subject.name)
            .join(Subject, Subject.id == SkillProgress.subject_id)
            .where(SkillProgress.child_id == child.id)
            .order_by(SkillProgress.mastery_pct.desc())
        ).all()
    )
    all_skills = [
        SkillProgressOut(
            id=sp.id,
            subject_id=sp.subject_id,
            subject_name=subj_name,
            skill_name=sp.skill_name,
            mastery_pct=sp.mastery_pct,
            practice_count=sp.practice_count,
        )
        for sp, subj_name in skills_rows
    ]
    strengths = [s for s in all_skills if s.mastery_pct >= 75]
    areas_to_practice = [s for s in all_skills if s.mastery_pct < 75]

    rewards = list(
        db.scalars(
            select(ChildReward)
            .where(ChildReward.child_id == child.id)
            .order_by(ChildReward.awarded_at.desc())
        ).all()
    )

    rec_stmt = (
        select(HomeActivity, Theme.week_number, Theme.title)
        .join(Theme, Theme.id == HomeActivity.theme_id)
        .where(Theme.status == "published")
    )
    if completed_home_ids:
        rec_stmt = rec_stmt.where(HomeActivity.id.not_in(completed_home_ids))
    candidate_home_acts = list(
        db.execute(
            rec_stmt.order_by(Theme.week_number.asc(), HomeActivity.sort_order.asc()).limit(3)
        ).all()
    )
    recommended: list[RecommendedHomeActivityOut] = [
        RecommendedHomeActivityOut(
            home_activity_id=ha.id,
            theme_id=ha.theme_id,
            week_number=wk,
            theme_title=th_title,
            title=ha.title,
            materials=ha.materials_json,
            estimated_minutes=ha.estimated_minutes,
        )
        for ha, wk, th_title in candidate_home_acts
    ]

    obs_rows = list(
        db.execute(
            select(TeacherObservation, User.full_name)
            .join(User, User.id == TeacherObservation.teacher_user_id)
            .where(TeacherObservation.child_id == child.id)
            .order_by(TeacherObservation.observed_at.desc())
            .limit(5)
        ).all()
    )
    fb_rows = list(
        db.execute(
            select(TeacherFeedback, User.full_name)
            .join(User, User.id == TeacherFeedback.teacher_user_id)
            .where(TeacherFeedback.child_id == child.id)
            .order_by(TeacherFeedback.created_at.desc())
            .limit(5)
        ).all()
    )

    enrolled_class_ids = list(
        db.scalars(
            select(ClassEnrollment.class_id).where(
                ClassEnrollment.child_id == child.id,
                ClassEnrollment.status == "active",
            )
        ).all()
    )
    assignment_conds = [Assignment.child_id == child.id]
    if enrolled_class_ids:
        assignment_conds.append(Assignment.class_id.in_(enrolled_class_ids))
    assignments = list(
        db.scalars(
            select(Assignment)
            .where(or_(*assignment_conds))
            .order_by(Assignment.created_at.desc())
        ).all()
    )
    assigned_out = [
        AssignedActivityOut(
            id=a.id,
            title=a.title,
            lesson_id=a.lesson_id,
            game_id=a.game_id,
            due_date=a.due_date,
            completed=(
                (a.lesson_id in completed_lesson_ids if a.lesson_id else False)
                or (a.game_id in completed_game_ids if a.game_id else False)
            ),
        )
        for a in assignments
    ]

    refl_rows = list(
        db.execute(
            select(ParentReflection, Theme.title, Theme.week_number)
            .join(Theme, Theme.id == ParentReflection.theme_id)
            .where(ParentReflection.child_id == child.id)
            .order_by(ParentReflection.created_at.desc())
            .limit(5)
        ).all()
    )

    this_week_minutes = round(this_week_secs / 60)
    prev_week_minutes = round(prev_week_secs / 60)
    active_dates_this_week: set = set()
    for lp, _ in lesson_rows:
        d = to_local_date(_ensure_utc(lp.completed_at or lp.updated_at or lp.created_at))
        if week_start <= d <= today:
            active_dates_this_week.add(d)
    for att, _, _ in attempt_rows:
        d = to_local_date(_ensure_utc(att.created_at))
        if week_start <= d <= today:
            active_dates_this_week.add(d)
    days_active_this_week = len(active_dates_this_week)

    if strengths:
        top_skill = strengths[0].skill_name
        encouraging_summary = (
            f"What a joyful week for {child.display_name}! Over the last 7 days, "
            f"{child.display_name} spent {this_week_minutes} minutes exploring and completed "
            f"{this_week_lessons} lesson(s), showing growing confidence in {top_skill}."
        )
        encouraging_summary_fil = (
            f"Ang saya ng linggo ni {child.display_name}! Nag-aral siya ng {this_week_minutes} minuto "
            f"at nakatapos ng {this_week_lessons} aralin, lalo na sa {top_skill}."
        )
    else:
        encouraging_summary = (
            f"{child.display_name} is off to a gentle and curious start with "
            f"{this_week_minutes} minutes of playful learning this week. Every small step counts!"
        )
        encouraging_summary_fil = (
            f"Magandang simula para kay {child.display_name} na may {this_week_minutes} minutong "
            f"masayang pag-aaral ngayong linggo. Bawat maliit na hakbang ay mahalaga!"
        )

    return WeeklyReportOut(
        generated_at=datetime.now(timezone.utc),
        week_start=week_start,
        week_end=today,
        child=ChildOut.model_validate(child),
        this_week_minutes=this_week_minutes,
        previous_week_minutes=prev_week_minutes,
        this_week_lessons=this_week_lessons,
        previous_week_lessons=prev_week_lessons,
        games_played_this_week=games_this_week,
        home_activities_completed_this_week=home_this_week,
        days_active_this_week=days_active_this_week,
        encouraging_summary=encouraging_summary,
        encouraging_summary_fil=encouraging_summary_fil,
        strengths=strengths,
        areas_to_practice=areas_to_practice,
        activity_history=history,
        rewards=[RewardOut.model_validate(r) for r in rewards],
        recommended_home_activities=recommended,
        teacher_observations=[
            TeacherObservationOut(
                id=obs.id,
                teacher_name=t_name,
                category=obs.category,
                observation_text=obs.observation_text,
                observed_at=obs.observed_at,
            )
            for obs, t_name in obs_rows
        ],
        teacher_feedback=[
            TeacherFeedbackOut(
                id=fb.id,
                teacher_name=t_name,
                message=fb.message,
                is_read=fb.is_read,
                created_at=fb.created_at,
            )
            for fb, t_name in fb_rows
        ],
        assigned_activities=assigned_out,
        reflections=[
            ParentReflectionOut(
                id=r.id,
                child_id=r.child_id,
                theme_id=r.theme_id,
                theme_title=th_title,
                week_number=wk_num,
                enjoyed=r.enjoyed,
                easy_concepts=r.easy_concepts,
                challenging_concepts=r.challenging_concepts,
                discovery_notes=r.discovery_notes,
                created_at=r.created_at,
            )
            for r, th_title, wk_num in refl_rows
        ],
    )
