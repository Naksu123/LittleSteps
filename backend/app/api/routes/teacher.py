from collections import defaultdict
from datetime import datetime, timedelta, timezone
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles, verify_child_access
from app.core.database import get_db
from app.models.content import (
    Activity,
    Game,
    Lesson,
    LessonResource,
    ParentGuide,
    Subject,
    Theme,
)
from app.models.learner import (
    Child,
    ClassEnrollment,
    ParentChildRelationship,
    SchoolClass,
    TeacherClassAssignment,
)
from app.models.parent import ParentReflection
from app.models.progress import (
    ActivityAttempt,
    Assignment,
    ChildReward,
    LessonProgress,
    SkillProgress,
)
from app.models.system import Notification
from app.models.teacher import Announcement, TeacherFeedback, TeacherObservation
from app.models.user import User
from app.repositories.learner_repo import get_children_for_teacher
from app.schemas.content import ActivityOut, LessonOut, ThemeOut
from app.schemas.learner import ChildOut, RewardOut, SkillProgressOut
from app.schemas.portal import (
    AnnouncementCreate,
    AnnouncementOut,
    ClassPerformanceSummary,
    LessonResourceOut,
    ParentReflectionOut,
    StudentGuidanceItem,
    SubjectMasteryPoint,
    TeacherActivityCreate,
    TeacherAnalyticsOut,
    TeacherAssignmentCreate,
    TeacherAssignmentOut,
    TeacherClassOut,
    TeacherFeedbackCreate,
    TeacherFeedbackOut,
    TeacherLessonCreate,
    TeacherLessonUpdate,
    TeacherObservationCreate,
    TeacherObservationOut,
    TeacherStudentDetailOut,
    TeacherStudentOut,
    TeacherThemeCreate,
    TeacherThemeUpdate,
    WeeklyCompletionPoint,
)
from app.services.audit_service import record_audit
from app.services.progress_service import local_today, to_local_date
from app.services.storage_service import StorageValidationError, storage_service

router = APIRouter(prefix="/teacher", tags=["Teacher Portal"])


def _slugify(text: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "item"
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _ensure_utc(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _get_teacher_class_ids(db: Session, current_user: User) -> list[str]:
    roles = set(current_user.role_names)
    if "admin" in roles and "teacher" not in roles:
        return list(
            db.scalars(select(SchoolClass.id).where(SchoolClass.is_active.is_(True))).all()
        )
    return list(
        db.scalars(
            select(TeacherClassAssignment.class_id).where(
                TeacherClassAssignment.teacher_user_id == current_user.id
            )
        ).all()
    )


def _ensure_teacher_owns_class(db: Session, current_user: User, class_id: str) -> SchoolClass:
    roles = set(current_user.role_names)
    cls = db.get(SchoolClass, class_id)
    if not cls or not cls.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    if "admin" not in roles:
        assigned = db.scalar(
            select(TeacherClassAssignment).where(
                TeacherClassAssignment.teacher_user_id == current_user.id,
                TeacherClassAssignment.class_id == class_id,
            )
        )
        if not assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this class.",
            )
    return cls


def _notify_child_parents(
    db: Session, child_id: str, title: str, message: str, category: str
) -> None:
    parent_ids = list(
        db.scalars(
            select(ParentChildRelationship.parent_user_id).where(
                ParentChildRelationship.child_id == child_id
            )
        ).all()
    )
    for pid in parent_ids:
        db.add(
            Notification(
                user_id=pid,
                title=title,
                message=message,
                category=category,
                is_read=False,
            )
        )


def _compute_assignment_counts(db: Session, a: Assignment) -> tuple[int, int]:
    target_child_ids: list[str] = []
    if a.child_id:
        target_child_ids = [a.child_id]
    elif a.class_id:
        target_child_ids = list(
            db.scalars(
                select(ClassEnrollment.child_id).where(
                    ClassEnrollment.class_id == a.class_id,
                    ClassEnrollment.status == "active",
                )
            ).all()
        )

    if not target_child_ids:
        return 0, 0

    completed = 0
    for cid in target_child_ids:
        done_lesson = bool(
            a.lesson_id
            and db.scalar(
                select(LessonProgress.id).where(
                    LessonProgress.child_id == cid,
                    LessonProgress.lesson_id == a.lesson_id,
                    LessonProgress.status == "completed",
                )
            )
        )
        done_game = bool(
            a.game_id
            and db.scalar(
                select(ActivityAttempt.id).where(
                    ActivityAttempt.child_id == cid,
                    ActivityAttempt.game_id == a.game_id,
                    ActivityAttempt.completed.is_(True),
                )
            )
        )
        if done_lesson or done_game:
            completed += 1

    return completed, len(target_child_ids)


@router.get("/classes", response_model=list[TeacherClassOut])
def list_teacher_classes(
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List classes assigned to the teacher (or all active classes for admin)."""
    roles = set(current_user.role_names)
    if "admin" in roles and "teacher" not in roles:
        classes = list(
            db.scalars(
                select(SchoolClass)
                .where(SchoolClass.is_active.is_(True))
                .order_by(SchoolClass.name.asc())
            ).all()
        )
    else:
        classes = list(
            db.scalars(
                select(SchoolClass)
                .join(TeacherClassAssignment, TeacherClassAssignment.class_id == SchoolClass.id)
                .where(
                    TeacherClassAssignment.teacher_user_id == current_user.id,
                    SchoolClass.is_active.is_(True),
                )
                .order_by(SchoolClass.name.asc())
            ).all()
        )

    class_ids = [cls.id for cls in classes]
    counts_by_class: dict[str, int] = {}
    if class_ids:
        counts_by_class = {
            cid: cnt
            for cid, cnt in db.execute(
                select(ClassEnrollment.class_id, func.count(ClassEnrollment.id))
                .where(
                    ClassEnrollment.class_id.in_(class_ids),
                    ClassEnrollment.status == "active",
                )
                .group_by(ClassEnrollment.class_id)
            ).all()
        }

    return [
        TeacherClassOut(
            id=cls.id,
            name=cls.name,
            age_group=cls.age_group,
            academic_year=cls.academic_year,
            room_label=cls.room_label,
            student_count=counts_by_class.get(cls.id, 0),
        )
        for cls in classes
    ]


@router.get("/students", response_model=list[TeacherStudentOut])
def list_teacher_students(
    class_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List enrolled students across classes assigned to the teacher."""
    roles = set(current_user.role_names)
    stmt = (
        select(Child, SchoolClass.name)
        .join(ClassEnrollment, ClassEnrollment.child_id == Child.id)
        .join(SchoolClass, SchoolClass.id == ClassEnrollment.class_id)
        .where(ClassEnrollment.status == "active", Child.is_active.is_(True))
    )
    if class_id:
        _ensure_teacher_owns_class(db, current_user, class_id)
        stmt = stmt.where(SchoolClass.id == class_id)
    elif "admin" not in roles or "teacher" in roles:
        stmt = stmt.join(
            TeacherClassAssignment, TeacherClassAssignment.class_id == SchoolClass.id
        ).where(TeacherClassAssignment.teacher_user_id == current_user.id)

    rows = list(db.execute(stmt.order_by(Child.display_name.asc())).all())
    child_ids = list({child.id for child, _ in rows})
    done_by_child: dict[str, int] = {}
    if child_ids:
        done_by_child = {
            cid: cnt
            for cid, cnt in db.execute(
                select(LessonProgress.child_id, func.count(LessonProgress.id))
                .where(
                    LessonProgress.child_id.in_(child_ids),
                    LessonProgress.status == "completed",
                )
                .group_by(LessonProgress.child_id)
            ).all()
        }

    return [
        TeacherStudentOut(
            id=child.id,
            display_name=child.display_name,
            age_group=child.age_group,
            avatar_key=child.avatar_key,
            class_name=class_name,
            total_stars=child.total_stars,
            streak_days=child.streak_days,
            lessons_completed=done_by_child.get(child.id, 0),
        )
        for child, class_name in rows
    ]


@router.get("/students/{child_id}/progress", response_model=TeacherStudentDetailOut)
def get_student_progress_detail(
    child_id: str,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Inspect detailed progress, skills, observations, and reflections for an enrolled student."""
    child = verify_child_access(db, current_user, child_id)

    class_names = list(
        db.scalars(
            select(SchoolClass.name)
            .join(ClassEnrollment, ClassEnrollment.class_id == SchoolClass.id)
            .where(ClassEnrollment.child_id == child.id, ClassEnrollment.status == "active")
        ).all()
    )
    total_lessons = (
        db.scalar(select(func.count(Lesson.id)).where(Lesson.status == "published")) or 0
    )
    lessons_completed = (
        db.scalar(
            select(func.count(LessonProgress.id)).where(
                LessonProgress.child_id == child.id, LessonProgress.status == "completed"
            )
        )
        or 0
    )
    games_played = (
        db.scalar(
            select(func.count(ActivityAttempt.id)).where(
                ActivityAttempt.child_id == child.id, ActivityAttempt.completed.is_(True)
            )
        )
        or 0
    )
    lesson_secs = (
        db.scalar(
            select(func.coalesce(func.sum(LessonProgress.time_spent_seconds), 0)).where(
                LessonProgress.child_id == child.id
            )
        )
        or 0
    )
    game_secs = (
        db.scalar(
            select(func.coalesce(func.sum(ActivityAttempt.duration_seconds), 0)).where(
                ActivityAttempt.child_id == child.id
            )
        )
        or 0
    )

    skills_rows = list(
        db.execute(
            select(SkillProgress, Subject.name)
            .join(Subject, Subject.id == SkillProgress.subject_id)
            .where(SkillProgress.child_id == child.id)
            .order_by(SkillProgress.mastery_pct.desc())
        ).all()
    )
    rewards = list(
        db.scalars(
            select(ChildReward)
            .where(ChildReward.child_id == child.id)
            .order_by(ChildReward.awarded_at.desc())
        ).all()
    )
    obs_rows = list(
        db.execute(
            select(TeacherObservation, User.full_name)
            .join(User, User.id == TeacherObservation.teacher_user_id)
            .where(TeacherObservation.child_id == child.id)
            .order_by(TeacherObservation.observed_at.desc())
            .limit(10)
        ).all()
    )
    refl_rows = list(
        db.execute(
            select(ParentReflection, Theme.title, Theme.week_number)
            .join(Theme, Theme.id == ParentReflection.theme_id)
            .where(ParentReflection.child_id == child.id)
            .order_by(ParentReflection.created_at.desc())
            .limit(10)
        ).all()
    )

    return TeacherStudentDetailOut(
        child=ChildOut.model_validate(child),
        class_names=class_names,
        lessons_completed=lessons_completed,
        total_lessons=total_lessons,
        games_played=games_played,
        total_time_minutes=round((lesson_secs + game_secs) / 60),
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
        rewards=[RewardOut.model_validate(r) for r in rewards],
        observations=[
            TeacherObservationOut(
                id=obs.id,
                teacher_name=t_name,
                category=obs.category,
                observation_text=obs.observation_text,
                observed_at=obs.observed_at,
            )
            for obs, t_name in obs_rows
        ],
        reflections=[
            ParentReflectionOut(
                id=r.id,
                child_id=r.child_id,
                theme_id=r.theme_id,
                theme_title=t_title,
                week_number=wk_num,
                enjoyed=r.enjoyed,
                easy_concepts=r.easy_concepts,
                challenging_concepts=r.challenging_concepts,
                discovery_notes=r.discovery_notes,
                created_at=r.created_at,
            )
            for r, t_title, wk_num in refl_rows
        ],
    )


@router.get("/analytics", response_model=TeacherAnalyticsOut)
def get_teacher_analytics(
    class_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Aggregate classroom participation, subject mastery, weekly completions, and guidance cues."""
    if class_id:
        _ensure_teacher_owns_class(db, current_user, class_id)
        class_ids = [class_id]
    else:
        class_ids = _get_teacher_class_ids(db, current_user)

    classes = (
        list(
            db.scalars(
                select(SchoolClass)
                .where(SchoolClass.id.in_(class_ids), SchoolClass.is_active.is_(True))
                .order_by(SchoolClass.name.asc())
            ).all()
        )
        if class_ids
        else []
    )

    today = local_today()
    week_start = today - timedelta(days=6)

    enrolled_pairs = (
        list(
            db.execute(
                select(Child, SchoolClass.id, SchoolClass.name)
                .join(ClassEnrollment, ClassEnrollment.child_id == Child.id)
                .join(SchoolClass, SchoolClass.id == ClassEnrollment.class_id)
                .where(
                    ClassEnrollment.class_id.in_(class_ids),
                    ClassEnrollment.status == "active",
                    Child.is_active.is_(True),
                )
            ).all()
        )
        if class_ids
        else []
    )

    unique_child_ids = list({child.id for child, _, _ in enrolled_pairs})
    total_published_lessons = (
        db.scalar(select(func.count(Lesson.id)).where(Lesson.status == "published")) or 0
    )

    lp_all = (
        list(
            db.scalars(
                select(LessonProgress).where(LessonProgress.child_id.in_(unique_child_ids))
            ).all()
        )
        if unique_child_ids
        else []
    )
    att_all = (
        list(
            db.scalars(
                select(ActivityAttempt).where(ActivityAttempt.child_id.in_(unique_child_ids))
            ).all()
        )
        if unique_child_ids
        else []
    )

    completed_lessons_by_child: dict[str, int] = {cid: 0 for cid in unique_child_ids}
    active_child_set: set[str] = set()
    days_list = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    lessons_per_day: dict = {d: 0 for d in days_list}
    games_per_day: dict = {d: 0 for d in days_list}

    for lp in lp_all:
        ts = _ensure_utc(lp.completed_at or lp.updated_at or lp.created_at)
        d = to_local_date(ts)
        if lp.status == "completed":
            completed_lessons_by_child[lp.child_id] = (
                completed_lessons_by_child.get(lp.child_id, 0) + 1
            )
            if d in lessons_per_day:
                lessons_per_day[d] += 1
        if week_start <= d <= today:
            active_child_set.add(lp.child_id)

    for att in att_all:
        ts = _ensure_utc(att.created_at)
        d = to_local_date(ts)
        if att.completed and att.game_id and d in games_per_day:
            games_per_day[d] += 1
        if week_start <= d <= today:
            active_child_set.add(att.child_id)

    class_summaries: list[ClassPerformanceSummary] = []
    for cls in classes:
        cls_children = [child for child, cid, _ in enrolled_pairs if cid == cls.id]
        count = len(cls_children)
        avg_stars = round(sum(c.total_stars for c in cls_children) / count, 1) if count else 0.0
        total_done = sum(completed_lessons_by_child.get(c.id, 0) for c in cls_children)
        active_cnt = sum(1 for c in cls_children if c.id in active_child_set)
        class_summaries.append(
            ClassPerformanceSummary(
                class_id=cls.id,
                class_name=cls.name,
                student_count=count,
                avg_stars=avg_stars,
                total_lessons_completed=total_done,
                active_learners=active_cnt,
            )
        )

    subjects = list(
        db.scalars(
            select(Subject).where(Subject.is_active.is_(True)).order_by(Subject.sort_order.asc())
        ).all()
    )
    skill_rows = (
        list(
            db.scalars(
                select(SkillProgress).where(SkillProgress.child_id.in_(unique_child_ids))
            ).all()
        )
        if unique_child_ids
        else []
    )
    mastery_by_subject: dict[str, list[int]] = defaultdict(list)
    lowest_by_child: dict[str, SkillProgress] = {}
    for sp in skill_rows:
        mastery_by_subject[sp.subject_id].append(sp.mastery_pct)
        if sp.mastery_pct < 75:
            prev_lowest = lowest_by_child.get(sp.child_id)
            if prev_lowest is None or sp.mastery_pct < prev_lowest.mastery_pct:
                lowest_by_child[sp.child_id] = sp

    subject_averages: list[SubjectMasteryPoint] = []
    for subj in subjects:
        vals = mastery_by_subject.get(subj.id, [])
        avg_val = (sum(vals) / len(vals)) if vals else None
        subject_averages.append(
            SubjectMasteryPoint(
                subject_name=subj.name,
                avg_mastery_pct=round(float(avg_val)) if avg_val is not None else 0,
                color_hex=subj.color_hex,
            )
        )

    guidance_items: list[StudentGuidanceItem] = []
    seen_guidance: set[str] = set()
    for child, _cid, cls_name in enrolled_pairs:
        if child.id in seen_guidance:
            continue
        done_cnt = completed_lessons_by_child.get(child.id, 0)
        lowest = lowest_by_child.get(child.id)
        if done_cnt == 0:
            seen_guidance.add(child.id)
            guidance_items.append(
                StudentGuidanceItem(
                    child_id=child.id,
                    display_name=child.display_name,
                    avatar_key=child.avatar_key,
                    class_name=cls_name,
                    reason="Ready for first guided lesson check-in",
                    lessons_completed=0,
                    lowest_skill=lowest.skill_name if lowest else None,
                )
            )
        elif lowest:
            seen_guidance.add(child.id)
            guidance_items.append(
                StudentGuidanceItem(
                    child_id=child.id,
                    display_name=child.display_name,
                    avatar_key=child.avatar_key,
                    class_name=cls_name,
                    reason=f"Gentle extra practice in {lowest.skill_name} ({lowest.mastery_pct}%)",
                    lessons_completed=done_cnt,
                    lowest_skill=lowest.skill_name,
                )
            )

    total_students = len(unique_child_ids)
    total_done_all = sum(completed_lessons_by_child.values())
    avg_lessons = round(total_done_all / total_students, 1) if total_students else 0.0
    possible_total = total_students * max(1, total_published_lessons)
    completion_rate = (
        min(100, round(100 * total_done_all / possible_total)) if possible_total else 0
    )

    return TeacherAnalyticsOut(
        total_classes=len(classes),
        total_students=total_students,
        active_learners_this_week=len(active_child_set),
        average_lessons_completed=avg_lessons,
        completion_rate_pct=completion_rate,
        class_summaries=class_summaries,
        subject_averages=subject_averages,
        students_needing_guidance=guidance_items,
        weekly_completions=[
            WeeklyCompletionPoint(
                day=d.strftime("%a"),
                lessons=lessons_per_day[d],
                games=games_per_day[d],
            )
            for d in days_list
        ],
    )


@router.get("/lessons", response_model=list[LessonOut])
def list_teacher_lessons(
    _current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List all lessons across draft, published, and archived states."""
    lessons = list(db.scalars(select(Lesson).order_by(Lesson.created_at.desc())).all())
    return [LessonOut.model_validate(l) for l in lessons]


@router.post("/lessons", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def create_teacher_lesson(
    payload: TeacherLessonCreate,
    request: Request,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Create a new kindergarten lesson with slides and draft/published status."""
    subj = db.get(Subject, payload.subject_id)
    if not subj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    if payload.theme_id and not db.get(Theme, payload.theme_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found.")

    content_json = {
        "skill": payload.skill or subj.name,
        "slides": [s.model_dump() for s in payload.slides],
        "encouragement": "Wonderful effort!",
    }
    lesson = Lesson(
        subject_id=subj.id,
        theme_id=payload.theme_id,
        slug=_slugify(payload.title),
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        content_json=content_json,
        age_group=payload.age_group,
        estimated_minutes=payload.estimated_minutes,
        audio_narration_text=payload.audio_narration_text,
        status=payload.status,
        created_by=current_user.id,
    )
    db.add(lesson)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="teacher.lesson_created",
        resource_type="lesson",
        resource_id=lesson.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(lesson)
    return LessonOut.model_validate(lesson)


@router.patch("/lessons/{lesson_id}", response_model=LessonOut)
def update_teacher_lesson(
    lesson_id: str,
    payload: TeacherLessonUpdate,
    request: Request,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Edit lesson fields, slides, or publishing status (draft/published/archived)."""
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")
    if payload.theme_id and not db.get(Theme, payload.theme_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found.")

    updates = payload.model_dump(exclude_unset=True)
    slides = updates.pop("slides", None)
    for field, val in updates.items():
        setattr(lesson, field, val.strip() if isinstance(val, str) else val)

    if slides is not None:
        new_content = dict(lesson.content_json or {})
        new_content["slides"] = slides
        lesson.content_json = new_content

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="teacher.lesson_updated",
        resource_type="lesson",
        resource_id=lesson.id,
        details={"status": lesson.status},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(lesson)
    return LessonOut.model_validate(lesson)


@router.post("/activities", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_teacher_activity(
    payload: TeacherActivityCreate,
    _current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Attach a choice-engine practice activity round to a lesson."""
    lesson = db.get(Lesson, payload.lesson_id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")
    if payload.correct_index >= len(payload.choices):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Correct choice index is out of range.",
        )

    max_order = (
        db.scalar(
            select(func.coalesce(func.max(Activity.sort_order), 0)).where(
                Activity.lesson_id == lesson.id
            )
        )
        or 0
    )
    round_payload = {
        "engine": "choice",
        "skill": (lesson.content_json or {}).get("skill") or lesson.title,
        "feedback": ["Great job!", "You did it!", "Wonderful effort!"],
        "rounds": [
            {
                "prompt": payload.prompt.strip(),
                "speak": payload.prompt.strip(),
                "visual": None,
                "choices": [
                    {"key": str(idx), "text": choice.strip()}
                    for idx, choice in enumerate(payload.choices)
                ],
                "answer": str(payload.correct_index),
            }
        ],
    }
    activity = Activity(
        lesson_id=lesson.id,
        title=payload.title.strip(),
        activity_type="choice",
        instructions=payload.instructions.strip(),
        payload_json=round_payload,
        sort_order=max_order + 1,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return ActivityOut.model_validate(activity)


@router.get("/lessons/{lesson_id}/resources", response_model=list[LessonResourceOut])
def list_lesson_resources(
    lesson_id: str,
    _current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List uploaded media resources attached to a lesson."""
    if not db.get(Lesson, lesson_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")
    resources = list(
        db.scalars(
            select(LessonResource)
            .where(LessonResource.lesson_id == lesson_id)
            .order_by(LessonResource.created_at.desc())
        ).all()
    )
    return [LessonResourceOut.model_validate(r) for r in resources]


@router.post(
    "/lessons/{lesson_id}/resources",
    response_model=LessonResourceOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_lesson_resource(
    lesson_id: str,
    request: Request,
    title: str = Form(..., min_length=2, max_length=150),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Upload a validated image, audio, or PDF learning resource for a lesson."""
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    raw_bytes = await file.read()
    content_type = file.content_type or "application/octet-stream"
    try:
        storage_key = storage_service.save_bytes("lesson_resources", raw_bytes, content_type)
    except StorageValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    res_type = (
        "audio"
        if content_type.startswith("audio/")
        else "document"
        if content_type == "application/pdf"
        else "image"
    )
    resource = LessonResource(
        lesson_id=lesson.id,
        title=title.strip(),
        resource_type=res_type,
        storage_key=storage_key,
        mime_type=content_type,
        file_size_bytes=len(raw_bytes),
    )
    db.add(resource)
    db.flush()
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="teacher.resource_uploaded",
        resource_type="lesson_resource",
        resource_id=resource.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(resource)
    return LessonResourceOut.model_validate(resource)


@router.get("/themes", response_model=list[ThemeOut])
def list_teacher_themes(
    _current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List all weekly themes (including drafts and archived)."""
    themes = list(db.scalars(select(Theme).order_by(Theme.week_number.asc())).all())
    return [ThemeOut.model_validate(t) for t in themes]


@router.post("/themes", response_model=ThemeOut, status_code=status.HTTP_201_CREATED)
def create_teacher_theme(
    payload: TeacherThemeCreate,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Create a weekly learning theme and optional home parent guide."""
    if db.scalar(select(Theme).where(Theme.week_number == payload.week_number)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Week {payload.week_number} already has a theme.",
        )

    now = datetime.now(timezone.utc)
    theme = Theme(
        week_number=payload.week_number,
        slug=_slugify(payload.title),
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        color_hex=payload.color_hex,
        status=payload.status,
        published_at=now if payload.status == "published" else None,
        created_by=current_user.id,
    )
    db.add(theme)
    db.flush()

    if payload.what_child_learns or payload.why_it_matters or payload.learning_tip:
        db.add(
            ParentGuide(
                theme_id=theme.id,
                what_child_learns=payload.what_child_learns or payload.summary,
                why_it_matters=payload.why_it_matters
                or "Supports playful curiosity and communication at home.",
                materials_needed_json=["Everyday household items"],
                conversation_prompts_json=["What did you notice today?"],
                learning_tip=payload.learning_tip
                or "Follow your child's curiosity and celebrate every attempt!",
                estimated_duration_mins=15,
            )
        )

    db.commit()
    db.refresh(theme)
    return ThemeOut.model_validate(theme)


@router.patch("/themes/{theme_id}", response_model=ThemeOut)
def update_teacher_theme(
    theme_id: str,
    payload: TeacherThemeUpdate,
    _current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Update weekly theme details or publish status."""
    theme = db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found.")

    updates = payload.model_dump(exclude_unset=True)
    for field in ("title", "summary", "color_hex", "status"):
        if field in updates:
            val = updates[field]
            setattr(theme, field, val.strip() if isinstance(val, str) else val)
    if updates.get("status") == "published" and theme.published_at is None:
        theme.published_at = datetime.now(timezone.utc)

    guide = db.scalar(select(ParentGuide).where(ParentGuide.theme_id == theme.id))
    if guide:
        for field in ("what_child_learns", "why_it_matters", "learning_tip"):
            if field in updates and updates[field] is not None:
                setattr(guide, field, updates[field])

    db.commit()
    db.refresh(theme)
    return ThemeOut.model_validate(theme)


@router.get("/assignments", response_model=list[TeacherAssignmentOut])
def list_teacher_assignments(
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List assignments created by the teacher or targeting their classes."""
    class_ids = _get_teacher_class_ids(db, current_user)
    roles = set(current_user.role_names)
    stmt = select(Assignment)
    if "admin" not in roles or "teacher" in roles:
        conds = [Assignment.teacher_user_id == current_user.id]
        if class_ids:
            conds.append(Assignment.class_id.in_(class_ids))
        stmt = stmt.where(or_(*conds))

    rows = list(db.scalars(stmt.order_by(Assignment.created_at.desc())).all())
    if not rows:
        return []

    ref_class_ids = list({a.class_id for a in rows if a.class_id})
    ref_child_ids = list({a.child_id for a in rows if a.child_id})
    ref_lesson_ids = list({a.lesson_id for a in rows if a.lesson_id})
    ref_game_ids = list({a.game_id for a in rows if a.game_id})

    classes_by_id = (
        {
            c.id: c
            for c in db.scalars(select(SchoolClass).where(SchoolClass.id.in_(ref_class_ids))).all()
        }
        if ref_class_ids
        else {}
    )
    enrolled_by_class: dict[str, list[str]] = defaultdict(list)
    if ref_class_ids:
        for cid_class, cid_child in db.execute(
            select(ClassEnrollment.class_id, ClassEnrollment.child_id).where(
                ClassEnrollment.class_id.in_(ref_class_ids),
                ClassEnrollment.status == "active",
            )
        ).all():
            enrolled_by_class[cid_class].append(cid_child)

    children_by_id = (
        {
            c.id: c
            for c in db.scalars(select(Child).where(Child.id.in_(ref_child_ids))).all()
        }
        if ref_child_ids
        else {}
    )

    all_target_child_ids = list(
        set(ref_child_ids)
        | {cid for cid_list in enrolled_by_class.values() for cid in cid_list}
    )

    completed_lessons: set[tuple[str, str]] = set()
    if all_target_child_ids and ref_lesson_ids:
        completed_lessons = {
            (r[0], r[1])
            for r in db.execute(
                select(LessonProgress.child_id, LessonProgress.lesson_id).where(
                    LessonProgress.child_id.in_(all_target_child_ids),
                    LessonProgress.lesson_id.in_(ref_lesson_ids),
                    LessonProgress.status == "completed",
                )
            ).all()
        }

    completed_games: set[tuple[str, str]] = set()
    if all_target_child_ids and ref_game_ids:
        completed_games = {
            (r[0], r[1])
            for r in db.execute(
                select(ActivityAttempt.child_id, ActivityAttempt.game_id).where(
                    ActivityAttempt.child_id.in_(all_target_child_ids),
                    ActivityAttempt.game_id.in_(ref_game_ids),
                    ActivityAttempt.completed.is_(True),
                )
            ).all()
        }

    out: list[TeacherAssignmentOut] = []
    for a in rows:
        cls = classes_by_id.get(a.class_id) if a.class_id else None
        child = children_by_id.get(a.child_id) if a.child_id else None
        target_cids = (
            [a.child_id]
            if a.child_id
            else enrolled_by_class.get(a.class_id, []) if a.class_id else []
        )
        done = sum(
            1
            for cid in target_cids
            if (a.lesson_id and (cid, a.lesson_id) in completed_lessons)
            or (a.game_id and (cid, a.game_id) in completed_games)
        )
        total = len(target_cids)
        out.append(
            TeacherAssignmentOut(
                id=a.id,
                title=a.title,
                class_id=a.class_id,
                class_name=cls.name if cls else None,
                child_id=a.child_id,
                child_name=child.display_name if child else None,
                lesson_id=a.lesson_id,
                game_id=a.game_id,
                due_date=a.due_date,
                completed_count=done,
                target_count=total,
                created_at=a.created_at,
            )
        )
    return out


@router.post("/assignments", response_model=TeacherAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_teacher_assignment(
    payload: TeacherAssignmentCreate,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Assign a lesson or game to an assigned class or enrolled learner."""
    cls: SchoolClass | None = None
    child: Child | None = None
    if payload.class_id:
        cls = _ensure_teacher_owns_class(db, current_user, payload.class_id)
    if payload.child_id:
        child = verify_child_access(db, current_user, payload.child_id)
    if payload.lesson_id and not db.get(Lesson, payload.lesson_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")
    if payload.game_id and not db.get(Game, payload.game_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    assignment = Assignment(
        teacher_user_id=current_user.id,
        class_id=payload.class_id,
        child_id=payload.child_id,
        lesson_id=payload.lesson_id,
        game_id=payload.game_id,
        title=payload.title.strip(),
        due_date=payload.due_date,
    )
    db.add(assignment)
    db.flush()

    target_cids: list[str] = []
    if child:
        target_cids = [child.id]
    elif cls:
        target_cids = list(
            db.scalars(
                select(ClassEnrollment.child_id).where(
                    ClassEnrollment.class_id == cls.id, ClassEnrollment.status == "active"
                )
            ).all()
        )
    for cid in target_cids:
        _notify_child_parents(
            db,
            cid,
            title=f"New Assigned Activity: {assignment.title}",
            message=f"{current_user.full_name} assigned a playful new activity.",
            category="assignment",
        )

    db.commit()
    db.refresh(assignment)
    done, total = _compute_assignment_counts(db, assignment)
    return TeacherAssignmentOut(
        id=assignment.id,
        title=assignment.title,
        class_id=assignment.class_id,
        class_name=cls.name if cls else None,
        child_id=assignment.child_id,
        child_name=child.display_name if child else None,
        lesson_id=assignment.lesson_id,
        game_id=assignment.game_id,
        due_date=assignment.due_date,
        completed_count=done,
        target_count=total,
        created_at=assignment.created_at,
    )


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher_assignment(
    assignment_id: str,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Remove an assignment created by the teacher (or admin)."""
    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")
    roles = set(current_user.role_names)
    if "admin" not in roles and assignment.teacher_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")
    db.delete(assignment)
    db.commit()
    return None


@router.get("/observations", response_model=list[TeacherObservationOut])
def list_teacher_observations(
    child_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List classroom observations for authorized students."""
    if child_id:
        child = verify_child_access(db, current_user, child_id)
        child_ids = [child.id]
    else:
        roles = set(current_user.role_names)
        if "admin" in roles and "teacher" not in roles:
            child_ids = list(db.scalars(select(Child.id).where(Child.is_active.is_(True))).all())
        else:
            child_ids = [c.id for c in get_children_for_teacher(db, current_user.id)]

    if not child_ids:
        return []

    rows = list(
        db.execute(
            select(TeacherObservation, User.full_name)
            .join(User, User.id == TeacherObservation.teacher_user_id)
            .where(TeacherObservation.child_id.in_(child_ids))
            .order_by(TeacherObservation.observed_at.desc())
            .limit(40)
        ).all()
    )
    return [
        TeacherObservationOut(
            id=obs.id,
            teacher_name=t_name,
            category=obs.category,
            observation_text=obs.observation_text,
            observed_at=obs.observed_at,
        )
        for obs, t_name in rows
    ]


@router.post(
    "/observations",
    response_model=TeacherObservationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_observation(
    payload: TeacherObservationCreate,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Record a classroom observation for an enrolled learner."""
    child = verify_child_access(db, current_user, payload.child_id)
    if payload.class_id:
        _ensure_teacher_owns_class(db, current_user, payload.class_id)

    obs = TeacherObservation(
        teacher_user_id=current_user.id,
        child_id=child.id,
        class_id=payload.class_id,
        category=payload.category.strip(),
        observation_text=payload.observation_text.strip(),
        observed_at=datetime.now(timezone.utc),
    )
    db.add(obs)
    _notify_child_parents(
        db,
        child.id,
        title=f"New classroom observation for {child.display_name}",
        message=obs.observation_text[:160],
        category="observation",
    )
    db.commit()
    db.refresh(obs)
    return TeacherObservationOut(
        id=obs.id,
        teacher_name=current_user.full_name,
        category=obs.category,
        observation_text=obs.observation_text,
        observed_at=obs.observed_at,
    )


@router.get("/feedback", response_model=list[TeacherFeedbackOut])
def list_teacher_feedback(
    child_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List teacher-to-parent feedback messages for authorized learners."""
    if child_id:
        child = verify_child_access(db, current_user, child_id)
        child_ids = [child.id]
    else:
        roles = set(current_user.role_names)
        if "admin" in roles and "teacher" not in roles:
            child_ids = list(db.scalars(select(Child.id).where(Child.is_active.is_(True))).all())
        else:
            child_ids = [c.id for c in get_children_for_teacher(db, current_user.id)]

    if not child_ids:
        return []

    rows = list(
        db.execute(
            select(TeacherFeedback, User.full_name)
            .join(User, User.id == TeacherFeedback.teacher_user_id)
            .where(TeacherFeedback.child_id.in_(child_ids))
            .order_by(TeacherFeedback.created_at.desc())
            .limit(40)
        ).all()
    )
    return [
        TeacherFeedbackOut(
            id=fb.id,
            teacher_name=t_name,
            message=fb.message,
            is_read=fb.is_read,
            created_at=fb.created_at,
        )
        for fb, t_name in rows
    ]


@router.post("/feedback", response_model=TeacherFeedbackOut, status_code=status.HTTP_201_CREATED)
def send_teacher_feedback(
    payload: TeacherFeedbackCreate,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Send encouraging parent feedback for an enrolled learner."""
    child = verify_child_access(db, current_user, payload.child_id)
    parent_ids = list(
        db.scalars(
            select(ParentChildRelationship.parent_user_id).where(
                ParentChildRelationship.child_id == child.id
            )
        ).all()
    )
    if not parent_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No guardian account is linked to this learner.",
        )

    created_rows: list[TeacherFeedback] = []
    for pid in parent_ids:
        fb = TeacherFeedback(
            teacher_user_id=current_user.id,
            parent_user_id=pid,
            child_id=child.id,
            message=payload.message.strip(),
            is_read=False,
        )
        db.add(fb)
        created_rows.append(fb)
        db.add(
            Notification(
                user_id=pid,
                title=f"Message from {current_user.full_name} about {child.display_name}",
                message=payload.message.strip()[:160],
                category="feedback",
                is_read=False,
            )
        )

    db.commit()
    db.refresh(created_rows[0])
    return TeacherFeedbackOut(
        id=created_rows[0].id,
        teacher_name=current_user.full_name,
        message=created_rows[0].message,
        is_read=created_rows[0].is_read,
        created_at=created_rows[0].created_at,
    )


@router.get("/reflections", response_model=list[ParentReflectionOut])
def list_student_parent_reflections(
    child_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """View parent home-learning reflections for students enrolled in teacher's classes."""
    if child_id:
        child = verify_child_access(db, current_user, child_id)
        child_ids = [child.id]
    else:
        roles = set(current_user.role_names)
        if "admin" in roles and "teacher" not in roles:
            child_ids = list(db.scalars(select(Child.id).where(Child.is_active.is_(True))).all())
        else:
            child_ids = [c.id for c in get_children_for_teacher(db, current_user.id)]

    if not child_ids:
        return []

    rows = list(
        db.execute(
            select(ParentReflection, Theme.title, Theme.week_number)
            .join(Theme, Theme.id == ParentReflection.theme_id)
            .where(ParentReflection.child_id.in_(child_ids))
            .order_by(ParentReflection.created_at.desc())
            .limit(30)
        ).all()
    )
    return [
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
        for r, th_title, wk_num in rows
    ]


@router.get("/announcements", response_model=list[AnnouncementOut])
def list_teacher_announcements(
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """List announcements authored by the teacher or targeting their classes."""
    class_ids = _get_teacher_class_ids(db, current_user)
    roles = set(current_user.role_names)
    stmt = select(Announcement)
    if "admin" not in roles or "teacher" in roles:
        conds = [Announcement.author_user_id == current_user.id, Announcement.class_id.is_(None)]
        if class_ids:
            conds.append(Announcement.class_id.in_(class_ids))
        stmt = stmt.where(or_(*conds))

    rows = list(db.scalars(stmt.order_by(Announcement.published_at.desc()).limit(30)).all())
    return [AnnouncementOut.model_validate(a) for a in rows]


@router.post("/announcements", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_teacher_announcement(
    payload: AnnouncementCreate,
    current_user: User = Depends(require_roles("teacher", "admin")),
    db: Session = Depends(get_db),
):
    """Publish a class or school announcement and notify parents."""
    if payload.class_id:
        _ensure_teacher_owns_class(db, current_user, payload.class_id)
        target_cids = list(
            db.scalars(
                select(ClassEnrollment.child_id).where(
                    ClassEnrollment.class_id == payload.class_id,
                    ClassEnrollment.status == "active",
                )
            ).all()
        )
    else:
        target_cids = [c.id for c in get_children_for_teacher(db, current_user.id)]

    ann = Announcement(
        author_user_id=current_user.id,
        class_id=payload.class_id,
        title=payload.title.strip(),
        body=payload.body.strip(),
        published_at=datetime.now(timezone.utc),
    )
    db.add(ann)
    db.flush()

    notified_parents: set[str] = set()
    for cid in target_cids:
        pids = list(
            db.scalars(
                select(ParentChildRelationship.parent_user_id).where(
                    ParentChildRelationship.child_id == cid
                )
            ).all()
        )
        for pid in pids:
            if pid not in notified_parents:
                notified_parents.add(pid)
                db.add(
                    Notification(
                        user_id=pid,
                        title=f"Announcement: {ann.title}",
                        message=ann.body[:160],
                        category="announcement",
                        is_read=False,
                    )
                )

    db.commit()
    db.refresh(ann)
    return AnnouncementOut.model_validate(ann)
