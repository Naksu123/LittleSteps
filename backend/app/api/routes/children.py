from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles, verify_child_access
from app.core.database import get_db
from app.models.content import Lesson, Subject
from app.models.learner import Child, ParentChildRelationship
from app.models.parent import HomeActivityProgress
from app.models.progress import ActivityAttempt, ChildArtwork, ChildReward, LessonProgress, SkillProgress
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
    GardenActionIn,
    RewardOut,
    SkillProgressOut,
    SubjectBreakdownItem,
)
from app.services.audit_service import record_audit
from app.services.garden_service import grow_garden_crop
from app.services.storage_service import storage_service

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
        age_group=payload.age_group or "4-5",
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

    lesson_totals_by_subject = {
        sid: int(cnt or 0)
        for sid, cnt in db.execute(
            select(Lesson.subject_id, func.count(Lesson.id))
            .where(Lesson.status == "published")
            .group_by(Lesson.subject_id)
        ).all()
    }
    total_lessons = sum(lesson_totals_by_subject.values())

    done_by_subject: dict[str, int] = {}
    lessons_completed = 0
    lesson_secs = 0
    for subj_id, prog_status, cnt, secs in db.execute(
        select(
            Lesson.subject_id,
            LessonProgress.status,
            func.count(LessonProgress.id),
            func.coalesce(func.sum(LessonProgress.time_spent_seconds), 0),
        )
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .where(LessonProgress.child_id == child.id)
        .group_by(Lesson.subject_id, LessonProgress.status)
    ).all():
        lesson_secs += int(secs or 0)
        if prog_status == "completed":
            c = int(cnt or 0)
            lessons_completed += c
            done_by_subject[subj_id] = done_by_subject.get(subj_id, 0) + c

    games_played_raw, game_secs_raw = db.execute(
        select(
            func.coalesce(
                func.sum(case((ActivityAttempt.completed.is_(True), 1), else_=0)), 0
            ),
            func.coalesce(func.sum(ActivityAttempt.duration_seconds), 0),
        ).where(ActivityAttempt.child_id == child.id)
    ).one()
    games_played = int(games_played_raw or 0)
    game_secs = int(game_secs_raw or 0)

    home_completed = (
        db.scalar(
            select(func.count(HomeActivityProgress.id)).where(
                HomeActivityProgress.child_id == child.id,
                HomeActivityProgress.completed.is_(True),
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
    breakdown: list[SubjectBreakdownItem] = [
        SubjectBreakdownItem(
            subject_id=subj.id,
            subject_name=subj.name,
            color_hex=subj.color_hex,
            lessons_completed=done_by_subject.get(subj.id, 0),
            total_lessons=lesson_totals_by_subject.get(subj.id, 0),
        )
        for subj in subjects
    ]

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


@router.post("/{child_id}/garden/grow", response_model=ChildOut)
def grow_child_garden_crop(
    child_id: str,
    payload: GardenActionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Water or sprout a Bahay Kubo garden crop using earned sunbeams or raindrops."""
    child = verify_child_access(db, current_user, child_id)
    try:
        grow_garden_crop(child, payload.crop_key, payload.use_resource)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    db.refresh(child)
    return ChildOut.model_validate(child)


@router.get("/{child_id}/export")
def export_child_data(
    child_id: str,
    request: Request,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Export minimal, portable JSON summary of a child's progress (RA 10173 portability)."""
    roles = set(current_user.role_names)
    if "admin" not in roles and not parent_owns_child(db, current_user.id, child_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to export this learner profile.",
        )

    progress = get_child_progress(child_id=child_id, current_user=current_user, db=db)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="learner.exported",
        resource_type="child",
        resource_id=child_id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "data_privacy_act": "Philippine RA 10173 Child Progress Export",
        "progress": progress.model_dump(mode="json"),
    }
    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": f'attachment; filename="littlesteps-{progress.child.display_name.lower()}-export.json"'
        },
    )


@router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child_profile(
    child_id: str,
    request: Request,
    current_user: User = Depends(require_roles("parent", "admin")),
    db: Session = Depends(get_db),
):
    """Permanently remove a learner profile and stored artworks (parent owner or admin)."""
    roles = set(current_user.role_names)
    if "admin" not in roles and not parent_owns_child(db, current_user.id, child_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this learner profile.",
        )

    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found.")

    artworks = list(
        db.scalars(select(ChildArtwork).where(ChildArtwork.child_id == child.id)).all()
    )
    for art in artworks:
        storage_service.delete(art.storage_key)

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="learner.deleted",
        resource_type="child",
        resource_id=child.id,
        details={"display_name": child.display_name},
        ip_address=request.client.host if request.client else None,
    )
    db.delete(child)
    db.commit()
    return None
