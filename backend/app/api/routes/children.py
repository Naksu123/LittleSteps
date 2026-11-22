from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles, verify_child_access
from app.core.database import get_db
from app.models.content import Lesson, Subject
from app.models.learner import Child, ParentChildRelationship
from app.models.parent import HomeActivityProgress
from app.models.progress import ActivityAttempt, ChildReward, LessonProgress, SkillProgress
from app.models.user import User
from app.repositories.learner_repo import (
    get_children_for_parent,
    get_children_for_teacher,
    parent_owns_child,
)
from app.schemas.learner import (
    ChildCreate,
    ChildOut,
    ChildProgressOut,
    ChildUpdate,
    RewardOut,
    SkillProgressOut,
    SubjectBreakdownItem,
)
from app.services.audit_service import record_audit

router = APIRouter(prefix="/children", tags=["Learners"])


@router.get("", response_model=list[ChildOut])
def list_children(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """List learner profiles visible to the authenticated parent, teacher, or admin."""
    roles = set(current_user.role_names)
    if "admin" in roles:
        children = list(
            db.scalars(
                select(Child).where(Child.is_active.is_(True)).order_by(Child.display_name.asc())
            ).all()
        )
    elif "teacher" in roles:
        children = get_children_for_teacher(db, current_user.id)
    else:
        children = get_children_for_parent(db, current_user.id)
    return [ChildOut.model_validate(c) for c in children]


@router.post("", response_model=ChildOut, status_code=status.HTTP_201_CREATED)
def create_child(
    payload: ChildCreate,
    request: Request,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Create a child-safe learner profile linked to the creating parent/guardian."""
    clean_display_name = " ".join(payload.display_name.strip().split())
    existing_for_parent = db.scalar(
        select(Child.id)
        .join(ParentChildRelationship, ParentChildRelationship.child_id == Child.id)
        .where(
            ParentChildRelationship.parent_user_id == current_user.id,
            func.lower(Child.display_name) == clean_display_name.lower(),
        )
    )
    if existing_for_parent or db.scalar(
        select(Child.id).where(func.lower(Child.display_name) == clean_display_name.lower())
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A learner profile with this name already exists.",
        )

    child = Child(
        display_name=clean_display_name,
        birth_year=payload.birth_year,
        age_group=payload.age_group,
        avatar_key=payload.avatar_key,
        favorite_color=payload.favorite_color,
        daily_goal_minutes=payload.daily_goal_minutes,
        mascot_name="Pip",
        streak_days=0,
        total_stars=0,
        is_active=True,
    )
    db.add(child)
    db.flush()

    db.add(
        ParentChildRelationship(
            parent_user_id=current_user.id,
            child_id=child.id,
            relationship_type="parent",
            is_primary=True,
        )
    )
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="learner.created",
        resource_type="child",
        resource_id=child.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(child)
    return ChildOut.model_validate(child)


@router.get("/{child_id}", response_model=ChildOut)
def get_child(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single child profile if authorized."""
    child = verify_child_access(db, current_user, child_id)
    return ChildOut.model_validate(child)


@router.patch("/{child_id}", response_model=ChildOut)
def update_child(
    child_id: str,
    payload: ChildUpdate,
    request: Request,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Update a child profile (authorized parent or admin only)."""
    roles = set(current_user.role_names)
    if "admin" not in roles and not parent_owns_child(db, current_user.id, child_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this learner profile.",
        )

    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")

    update_data = payload.model_dump(exclude_unset=True)
    if "display_name" in update_data and update_data["display_name"] is not None:
        clean_display_name = " ".join(str(update_data["display_name"]).strip().split())
        dup_child = db.scalar(
            select(Child.id).where(
                func.lower(Child.display_name) == clean_display_name.lower(),
                Child.id != child_id,
            )
        )
        if dup_child:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another learner profile with this name already exists.",
            )
        update_data["display_name"] = clean_display_name

    for field, value in update_data.items():
        setattr(child, field, value.strip() if isinstance(value, str) else value)

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="learner.updated",
        resource_type="child",
        resource_id=child.id,
        details={"fields": sorted(update_data.keys())},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(child)
    return ChildOut.model_validate(child)


@router.get("/{child_id}/progress", response_model=ChildProgressOut)
def get_child_progress(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate real learning progress, rewards, and skills for an authorized learner."""
    child = verify_child_access(db, current_user, child_id)

    total_lessons = db.scalar(select(func.count(Lesson.id)).where(Lesson.status == "published")) or 0
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
    home_completed = (
        db.scalar(
            select(func.count(HomeActivityProgress.id)).where(
                HomeActivityProgress.child_id == child.id,
                HomeActivityProgress.completed.is_(True),
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

    rewards = list(
        db.scalars(
            select(ChildReward)
            .where(ChildReward.child_id == child.id)
            .order_by(ChildReward.awarded_at.desc())
        ).all()
    )

    skills_rows = list(
        db.execute(
            select(SkillProgress, Subject.name)
            .join(Subject, Subject.id == SkillProgress.subject_id)
            .where(SkillProgress.child_id == child.id)
        ).all()
    )
    skills = [
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

    subjects = list(db.scalars(select(Subject).order_by(Subject.sort_order.asc())).all())
    breakdown: list[SubjectBreakdownItem] = []
    for subj in subjects:
        subj_total = (
            db.scalar(
                select(func.count(Lesson.id)).where(
                    Lesson.subject_id == subj.id, Lesson.status == "published"
                )
            )
            or 0
        )
        subj_done = (
            db.scalar(
                select(func.count(LessonProgress.id))
                .join(Lesson, Lesson.id == LessonProgress.lesson_id)
                .where(
                    LessonProgress.child_id == child.id,
                    LessonProgress.status == "completed",
                    Lesson.subject_id == subj.id,
                )
            )
            or 0
        )
        breakdown.append(
            SubjectBreakdownItem(
                subject_id=subj.id,
                subject_name=subj.name,
                color_hex=subj.color_hex,
                lessons_completed=subj_done,
                total_lessons=subj_total,
            )
        )

    return ChildProgressOut(
        child=ChildOut.model_validate(child),
        lessons_completed=lessons_completed,
        total_lessons=total_lessons,
        games_played=games_played,
        home_activities_completed=home_completed,
        total_time_minutes=round((lesson_secs + game_secs) / 60),
        rewards=[RewardOut.model_validate(r) for r in rewards],
        skills=skills,
        subject_breakdown=breakdown,
    )
