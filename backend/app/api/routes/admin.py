from datetime import datetime, timedelta, timezone
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_roles
from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.models.content import Game, Lesson, LessonResource, Subject, Theme
from app.models.learner import (
    Child,
    ClassEnrollment,
    ParentChildRelationship,
    SchoolClass,
    TeacherClassAssignment,
)
from app.models.parent import HomeActivityProgress
from app.models.progress import ActivityAttempt, ChildArtwork, LessonProgress
from app.models.system import AuditLog, PlatformSetting
from app.models.user import (
    AdminProfile,
    ParentProfile,
    RefreshToken,
    Role,
    TeacherProfile,
    User,
    UserRole,
)
from app.schemas.content import LessonOut, ThemeOut
from app.schemas.portal import (
    AdminAnalyticsOut,
    AdminChildSummaryOut,
    AdminClassCreate,
    AdminClassOut,
    AdminClassStudentOut,
    AdminClassTeacherOut,
    AdminClassUpdate,
    AdminContentStatusUpdate,
    AdminContentSummaryOut,
    AdminDailyActivityPoint,
    AdminEnrollmentIn,
    AdminStorageItemOut,
    AdminStorageOverviewOut,
    AdminSubjectCreate,
    AdminSubjectDistributionPoint,
    AdminSubjectOut,
    AdminSubjectUpdate,
    AdminTeacherAssignIn,
    AdminUserCreate,
    AdminUserOut,
    AdminUserUpdate,
    AuditLogOut,
    PlatformSettingOut,
    PlatformSettingUpdate,
    SystemHealthOut,
)
from app.services.audit_service import record_audit
from app.services.storage_service import storage_service

router = APIRouter(prefix="/admin", tags=["Admin Portal"])


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize naive (SQLite) and tz-aware (PostgreSQL) timestamps to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _slugify_subject(db: Session, text_value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text_value.lower()).strip("-")[:60] or "subject"
    if not db.scalar(select(Subject.id).where(Subject.slug == base)):
        return base
    return f"{base}-{uuid.uuid4().hex[:4]}"


def _ensure_role_profiles(db: Session, user_id: str, role_names: list[str]) -> None:
    role_set = set(role_names)
    if "parent" in role_set and not db.scalar(
        select(ParentProfile.id).where(ParentProfile.user_id == user_id)
    ):
        db.add(ParentProfile(user_id=user_id, preferred_language="en", daily_screen_limit_mins=30))
    if "teacher" in role_set and not db.scalar(
        select(TeacherProfile.id).where(TeacherProfile.user_id == user_id)
    ):
        db.add(TeacherProfile(user_id=user_id, specialization="Kindergarten Education"))
    if "admin" in role_set and not db.scalar(
        select(AdminProfile.id).where(AdminProfile.user_id == user_id)
    ):
        db.add(AdminProfile(user_id=user_id))


def _serialize_user(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        roles=sorted(user.role_names),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def _serialize_class(db: Session, school_class: SchoolClass) -> AdminClassOut:
    teacher_rows = list(
        db.execute(
            select(TeacherClassAssignment, User)
            .join(User, User.id == TeacherClassAssignment.teacher_user_id)
            .where(TeacherClassAssignment.class_id == school_class.id)
            .order_by(User.full_name.asc())
        ).all()
    )
    student_rows = list(
        db.execute(
            select(ClassEnrollment, Child)
            .join(Child, Child.id == ClassEnrollment.child_id)
            .where(
                ClassEnrollment.class_id == school_class.id,
                ClassEnrollment.status == "active",
            )
            .order_by(Child.display_name.asc())
        ).all()
    )
    return AdminClassOut(
        id=school_class.id,
        name=school_class.name,
        age_group=school_class.age_group,
        academic_year=school_class.academic_year,
        room_label=school_class.room_label,
        is_active=school_class.is_active,
        teachers=[
            AdminClassTeacherOut(
                teacher_user_id=teacher.id,
                full_name=teacher.full_name,
                email=teacher.email,
                is_lead=assignment.is_lead,
            )
            for assignment, teacher in teacher_rows
        ],
        students=[
            AdminClassStudentOut(
                child_id=child.id,
                display_name=child.display_name,
                age_group=child.age_group,
                avatar_key=child.avatar_key,
                status=enrollment.status,
            )
            for enrollment, child in student_rows
        ],
        created_at=school_class.created_at,
    )


def _collect_storage_overview(db: Session) -> AdminStorageOverviewOut:
    resources = list(
        db.execute(
            select(LessonResource, Lesson.title)
            .join(Lesson, Lesson.id == LessonResource.lesson_id)
        ).all()
    )
    artworks = list(db.scalars(select(ChildArtwork)).all())

    items: list[AdminStorageItemOut] = []
    for res, lesson_title in resources:
        size = res.file_size_bytes or storage_service.get_file_size(res.storage_key)
        items.append(
            AdminStorageItemOut(
                id=res.id,
                item_type="lesson_resource",
                title=res.title,
                storage_key=res.storage_key,
                mime_type=res.mime_type,
                file_size_bytes=size,
                parent_label=f"Lesson: {lesson_title}",
                created_at=res.created_at,
            )
        )

    for art in artworks:
        size = storage_service.get_file_size(art.storage_key)
        items.append(
            AdminStorageItemOut(
                id=art.id,
                item_type="child_artwork",
                title=art.title,
                storage_key=art.storage_key,
                mime_type="image/png",
                file_size_bytes=size,
                parent_label="Kids Art Studio",
                created_at=art.created_at,
            )
        )

    items.sort(
        key=lambda item: _to_utc(item.created_at) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    total_bytes = sum(item.file_size_bytes for item in items)
    return AdminStorageOverviewOut(
        storage_backend=settings.STORAGE_BACKEND,
        total_items=len(items),
        total_bytes=total_bytes,
        items=items,
    )


# ---------------------------------------------------------------------------
# User & Role Management
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List user accounts with optional search, role, and active status filters."""
    stmt = select(User).options(selectinload(User.user_roles).selectinload(UserRole.role))
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where((User.full_name.ilike(pattern)) | (User.email.ilike(pattern)))
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))

    users = list(db.scalars(stmt.order_by(User.created_at.desc())).all())
    if role:
        normalized_role = role.strip().lower()
        users = [u for u in users if normalized_role in u.role_names]

    return [_serialize_user(u) for u in users]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Create a parent, teacher, or admin user account and provision its role profile."""
    normalized_email = payload.email.strip().lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == normalized_email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    role_obj = db.scalar(select(Role).where(Role.name == payload.role))
    if not role_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{payload.role}' is not configured.",
        )

    user = User(
        email=normalized_email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        is_active=payload.is_active,
        privacy_consent_accepted_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()

    db.add(UserRole(user_id=user.id, role_id=role_obj.id))
    _ensure_role_profiles(db, user.id, [payload.role])

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.user_created",
        resource_type="user",
        resource_id=user.id,
        details={"role": payload.role, "is_active": payload.is_active},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    created_user = db.scalar(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user.id)
    )
    assert created_user is not None
    return _serialize_user(created_user)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Update a user's active status, full name, or assigned roles."""
    if user_id == current_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own active account.",
        )
    if user_id == current_user.id and payload.roles is not None and "admin" not in payload.roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot remove their own admin role.",
        )

    user = db.scalar(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user_id)
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    status_only = (
        payload.is_active is not None
        and payload.roles is None
        and payload.full_name is None
    )

    if payload.is_active is not None:
        user.is_active = payload.is_active
        if not payload.is_active:
            revoked_at = datetime.now(timezone.utc)
            active_tokens = list(
                db.scalars(
                    select(RefreshToken).where(
                        RefreshToken.user_id == user.id,
                        RefreshToken.revoked_at.is_(None),
                    )
                ).all()
            )
            for tok in active_tokens:
                tok.revoked_at = revoked_at
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()

    updated_roles: Optional[list[str]] = None
    if payload.roles is not None:
        unique_roles = list(dict.fromkeys(payload.roles))
        role_rows = {
            r.name: r
            for r in db.scalars(select(Role).where(Role.name.in_(unique_roles))).all()
        }
        missing = [name for name in unique_roles if name not in role_rows]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown roles: {', '.join(missing)}",
            )

        existing_by_name = {
            ur.role.name: ur for ur in list(user.user_roles) if ur.role is not None
        }
        for existing_name, link in list(existing_by_name.items()):
            if existing_name not in unique_roles:
                db.delete(link)
        for role_name in unique_roles:
            if role_name not in existing_by_name:
                db.add(UserRole(user_id=user.id, role_id=role_rows[role_name].id))
        db.flush()
        _ensure_role_profiles(db, user.id, unique_roles)
        updated_roles = sorted(unique_roles)

    audit_action = "admin.user_status_updated" if status_only else "admin.user_updated"
    record_audit(
        db,
        actor_user_id=current_user.id,
        action=audit_action,
        resource_type="user",
        resource_id=user.id,
        details={
            "is_active": user.is_active,
            "roles": updated_roles if updated_roles is not None else sorted(user.role_names),
        },
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.expire(user)

    refreshed = db.scalar(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user.id)
    )
    assert refreshed is not None
    return _serialize_user(refreshed)


# ---------------------------------------------------------------------------
# Learners, Classes, Teacher Assignments & Enrollments
# ---------------------------------------------------------------------------


@router.get("/children", response_model=list[AdminChildSummaryOut])
def list_all_children(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List all learner profiles with guardian links and class enrollments."""
    children = list(
        db.scalars(
            select(Child)
            .options(
                selectinload(Child.parent_links),
                selectinload(Child.enrollments).selectinload(ClassEnrollment.school_class),
            )
            .order_by(Child.display_name.asc())
        ).all()
    )

    parent_ids = {
        link.parent_user_id
        for child in children
        for link in child.parent_links
    }
    parent_map: dict[str, str] = {}
    if parent_ids:
        for parent in db.scalars(select(User).where(User.id.in_(parent_ids))).all():
            parent_map[parent.id] = parent.full_name

    results: list[AdminChildSummaryOut] = []
    for child in children:
        active_enrollments = [
            e for e in child.enrollments if e.status == "active" and e.school_class is not None
        ]
        results.append(
            AdminChildSummaryOut(
                id=child.id,
                display_name=child.display_name,
                age_group=child.age_group,
                avatar_key=child.avatar_key,
                is_active=child.is_active,
                parent_names=[
                    parent_map[link.parent_user_id]
                    for link in child.parent_links
                    if link.parent_user_id in parent_map
                ],
                class_ids=[e.class_id for e in active_enrollments],
                class_names=[
                    e.school_class.name for e in active_enrollments if e.school_class is not None
                ],
                total_stars=child.total_stars,
                streak_days=child.streak_days,
            )
        )
    return results


@router.get("/classes", response_model=list[AdminClassOut])
def list_classes(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List all kindergarten classes with assigned teachers and enrolled students."""
    classes = list(db.scalars(select(SchoolClass).order_by(SchoolClass.name.asc())).all())
    return [_serialize_class(db, c) for c in classes]


@router.post("/classes", response_model=AdminClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    payload: AdminClassCreate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Create a kindergarten classroom cohort."""
    clean_name = payload.name.strip()
    if db.scalar(select(SchoolClass.id).where(func.lower(SchoolClass.name) == clean_name.lower())):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A class with this name already exists.",
        )

    school_class = SchoolClass(
        name=clean_name,
        age_group=payload.age_group,
        academic_year=payload.academic_year.strip(),
        room_label=payload.room_label.strip() if payload.room_label else None,
        is_active=payload.is_active,
    )
    db.add(school_class)
    db.flush()

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.class_created",
        resource_type="class",
        resource_id=school_class.id,
        details={"age_group": school_class.age_group, "is_active": school_class.is_active},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(school_class)
    return _serialize_class(db, school_class)


@router.patch("/classes/{class_id}", response_model=AdminClassOut)
def update_class(
    class_id: str,
    payload: AdminClassUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Update classroom metadata or active status."""
    school_class = db.get(SchoolClass, class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")

    if payload.name is not None:
        clean_name = payload.name.strip()
        duplicate = db.scalar(
            select(SchoolClass.id).where(
                func.lower(SchoolClass.name) == clean_name.lower(),
                SchoolClass.id != class_id,
            )
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another class with this name already exists.",
            )
        school_class.name = clean_name

    if payload.age_group is not None:
        school_class.age_group = payload.age_group
    if payload.academic_year is not None:
        school_class.academic_year = payload.academic_year.strip()
    if "room_label" in payload.model_fields_set:
        school_class.room_label = payload.room_label.strip() if payload.room_label else None
    if payload.is_active is not None:
        school_class.is_active = payload.is_active

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.class_updated",
        resource_type="class",
        resource_id=school_class.id,
        details={"is_active": school_class.is_active, "age_group": school_class.age_group},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(school_class)
    return _serialize_class(db, school_class)


@router.post(
    "/classes/{class_id}/teachers",
    response_model=AdminClassOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_teacher_to_class(
    class_id: str,
    payload: AdminTeacherAssignIn,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Assign a teacher or admin educator to a classroom."""
    school_class = db.get(SchoolClass, class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")

    teacher = db.scalar(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == payload.teacher_user_id)
    )
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher account not found.")

    if "teacher" not in teacher.role_names and "admin" not in teacher.role_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected user must hold a teacher or admin role.",
        )

    existing = db.scalar(
        select(TeacherClassAssignment).where(
            TeacherClassAssignment.class_id == class_id,
            TeacherClassAssignment.teacher_user_id == teacher.id,
        )
    )
    if existing:
        existing.is_lead = payload.is_lead
    else:
        db.add(
            TeacherClassAssignment(
                teacher_user_id=teacher.id,
                class_id=class_id,
                is_lead=payload.is_lead,
            )
        )

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.teacher_assigned_class",
        resource_type="class",
        resource_id=class_id,
        details={"teacher_user_id": teacher.id, "is_lead": payload.is_lead},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _serialize_class(db, school_class)


@router.delete(
    "/classes/{class_id}/teachers/{teacher_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_teacher_from_class(
    class_id: str,
    teacher_id: str,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Unassign a teacher from a classroom."""
    assignment = db.scalar(
        select(TeacherClassAssignment).where(
            TeacherClassAssignment.class_id == class_id,
            TeacherClassAssignment.teacher_user_id == teacher_id,
        )
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher assignment not found for this class.",
        )

    db.delete(assignment)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.teacher_removed_class",
        resource_type="class",
        resource_id=class_id,
        details={"teacher_user_id": teacher_id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()


@router.post(
    "/classes/{class_id}/enrollments",
    response_model=AdminClassOut,
    status_code=status.HTTP_201_CREATED,
)
def enroll_child_in_class(
    class_id: str,
    payload: AdminEnrollmentIn,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Enroll a learner profile into a kindergarten class."""
    school_class = db.get(SchoolClass, class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")

    child = db.get(Child, payload.child_id)
    if not child:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner profile not found.")

    existing = db.scalar(
        select(ClassEnrollment).where(
            ClassEnrollment.class_id == class_id,
            ClassEnrollment.child_id == child.id,
        )
    )
    if existing:
        existing.status = "active"
    else:
        db.add(ClassEnrollment(class_id=class_id, child_id=child.id, status="active"))

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.child_enrolled",
        resource_type="class",
        resource_id=class_id,
        details={"child_id": child.id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _serialize_class(db, school_class)


@router.delete(
    "/classes/{class_id}/enrollments/{child_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unenroll_child_from_class(
    class_id: str,
    child_id: str,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Remove a learner enrollment from a class."""
    enrollment = db.scalar(
        select(ClassEnrollment).where(
            ClassEnrollment.class_id == class_id,
            ClassEnrollment.child_id == child_id,
        )
    )
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Learner enrollment not found for this class.",
        )

    db.delete(enrollment)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.child_unenrolled",
        resource_type="class",
        resource_id=class_id,
        details={"child_id": child_id},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()


# ---------------------------------------------------------------------------
# Subjects & Content Governance
# ---------------------------------------------------------------------------


def _serialize_subject(db: Session, subject: Subject) -> AdminSubjectOut:
    lesson_count = (
        db.scalar(select(func.count(Lesson.id)).where(Lesson.subject_id == subject.id)) or 0
    )
    game_count = (
        db.scalar(select(func.count(Game.id)).where(Game.subject_id == subject.id)) or 0
    )
    return AdminSubjectOut(
        id=subject.id,
        slug=subject.slug,
        name=subject.name,
        description=subject.description,
        icon_key=subject.icon_key,
        color_hex=subject.color_hex,
        sort_order=subject.sort_order,
        is_active=subject.is_active,
        lesson_count=lesson_count,
        game_count=game_count,
    )


@router.get("/subjects", response_model=list[AdminSubjectOut])
def list_admin_subjects(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List all learning modules including inactive ones with content counts."""
    subjects = list(
        db.scalars(
            select(Subject).order_by(Subject.sort_order.asc(), Subject.name.asc())
        ).all()
    )
    return [_serialize_subject(db, s) for s in subjects]


@router.post("/subjects", response_model=AdminSubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: AdminSubjectCreate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Create a curriculum learning module subject."""
    clean_name = payload.name.strip()
    subject = Subject(
        slug=_slugify_subject(db, clean_name),
        name=clean_name,
        description=payload.description.strip(),
        icon_key=payload.icon_key.strip() or "book-open",
        color_hex=payload.color_hex.strip() or "#78C8F5",
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(subject)
    db.flush()

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.subject_created",
        resource_type="subject",
        resource_id=subject.id,
        details={"slug": subject.slug, "is_active": subject.is_active},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(subject)
    return _serialize_subject(db, subject)


@router.patch("/subjects/{subject_id}", response_model=AdminSubjectOut)
def update_subject(
    subject_id: str,
    payload: AdminSubjectUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Update a subject module's metadata, ordering, or active visibility."""
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")

    if payload.name is not None:
        subject.name = payload.name.strip()
    if payload.description is not None:
        subject.description = payload.description.strip()
    if payload.icon_key is not None:
        subject.icon_key = payload.icon_key.strip()
    if payload.color_hex is not None:
        subject.color_hex = payload.color_hex.strip()
    if payload.sort_order is not None:
        subject.sort_order = payload.sort_order
    if payload.is_active is not None:
        subject.is_active = payload.is_active

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.subject_updated",
        resource_type="subject",
        resource_id=subject.id,
        details={"is_active": subject.is_active, "sort_order": subject.sort_order},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(subject)
    return _serialize_subject(db, subject)


@router.get("/content", response_model=AdminContentSummaryOut)
def list_content_governance(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Return all lessons and weekly themes across draft, published, and archived states."""
    lessons = list(db.scalars(select(Lesson).order_by(Lesson.created_at.desc())).all())
    themes = list(db.scalars(select(Theme).order_by(Theme.week_number.asc())).all())
    return AdminContentSummaryOut(
        lessons=[LessonOut.model_validate(item) for item in lessons],
        themes=[ThemeOut.model_validate(item) for item in themes],
    )


@router.patch("/lessons/{lesson_id}/status", response_model=LessonOut)
def update_lesson_status(
    lesson_id: str,
    payload: AdminContentStatusUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Set a lesson's publication status (draft, published, or archived)."""
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found.")

    lesson.status = payload.status
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.lesson_status_updated",
        resource_type="lesson",
        resource_id=lesson.id,
        details={"status": payload.status},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(lesson)
    return LessonOut.model_validate(lesson)


@router.patch("/themes/{theme_id}/status", response_model=ThemeOut)
def update_theme_status(
    theme_id: str,
    payload: AdminContentStatusUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Set a weekly learning theme's publication status."""
    theme = db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found.")

    theme.status = payload.status
    if payload.status == "published":
        theme.published_at = datetime.now(timezone.utc)

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.theme_status_updated",
        resource_type="theme",
        resource_id=theme.id,
        details={"status": payload.status},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(theme)
    return ThemeOut.model_validate(theme)


# ---------------------------------------------------------------------------
# Analytics, Cloud Storage, Settings, Health & Audit Logs
# ---------------------------------------------------------------------------


@router.get("/analytics", response_model=AdminAnalyticsOut)
def get_admin_analytics(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Return platform-wide user breakdown, 7-day learning activity, and storage analytics."""
    users = list(
        db.scalars(
            select(User).options(selectinload(User.user_roles).selectinload(UserRole.role))
        ).all()
    )
    users_by_role = {"admin": 0, "teacher": 0, "parent": 0}
    active_users = 0
    inactive_users = 0
    for user in users:
        if user.is_active:
            active_users += 1
        else:
            inactive_users += 1
        for role_name in user.role_names:
            if role_name in users_by_role:
                users_by_role[role_name] += 1

    total_children = db.scalar(select(func.count(Child.id))) or 0

    today_utc = datetime.now(timezone.utc).date()
    days = [today_utc - timedelta(days=offset) for offset in range(6, -1, -1)]
    day_buckets: dict[object, dict[str, int]] = {
        d: {"lessons": 0, "games": 0, "home_activities": 0} for d in days
    }
    window_start = days[0]
    active_learner_ids: set[str] = set()

    lesson_rows = list(db.scalars(select(LessonProgress)).all())
    total_lessons_completed = 0
    for lp in lesson_rows:
        if lp.status == "completed":
            total_lessons_completed += 1
            dt = _to_utc(lp.completed_at or lp.updated_at or lp.created_at)
            if dt:
                d = dt.date()
                if d >= window_start:
                    active_learner_ids.add(lp.child_id)
                if d in day_buckets:
                    day_buckets[d]["lessons"] += 1

    attempt_rows = list(db.scalars(select(ActivityAttempt)).all())
    total_game_attempts = len(attempt_rows)
    for att in attempt_rows:
        dt = _to_utc(att.created_at)
        if dt:
            d = dt.date()
            if d >= window_start:
                active_learner_ids.add(att.child_id)
            if att.completed and d in day_buckets:
                day_buckets[d]["games"] += 1

    home_rows = list(
        db.scalars(select(HomeActivityProgress).where(HomeActivityProgress.completed.is_(True))).all()
    )
    total_home_completed = len(home_rows)
    for ha in home_rows:
        dt = _to_utc(ha.completed_at or ha.updated_at or ha.created_at)
        if dt:
            d = dt.date()
            if d >= window_start:
                active_learner_ids.add(ha.child_id)
            if d in day_buckets:
                day_buckets[d]["home_activities"] += 1

    daily_activity = [
        AdminDailyActivityPoint(
            day=d.strftime("%a %d"),
            lessons=day_buckets[d]["lessons"],
            games=day_buckets[d]["games"],
            home_activities=day_buckets[d]["home_activities"],
        )
        for d in days
    ]

    subjects = list(
        db.scalars(
            select(Subject).order_by(Subject.sort_order.asc(), Subject.name.asc())
        ).all()
    )
    subject_distribution = [
        AdminSubjectDistributionPoint(
            subject_name=subj.name,
            lessons=db.scalar(select(func.count(Lesson.id)).where(Lesson.subject_id == subj.id))
            or 0,
            games=db.scalar(select(func.count(Game.id)).where(Game.subject_id == subj.id)) or 0,
            color_hex=subj.color_hex,
        )
        for subj in subjects
    ]

    storage_overview = _collect_storage_overview(db)

    return AdminAnalyticsOut(
        users_by_role=users_by_role,
        active_users=active_users,
        inactive_users=inactive_users,
        total_children=total_children,
        active_learners_7d=len(active_learner_ids),
        total_lessons_completed=total_lessons_completed,
        total_game_attempts=total_game_attempts,
        total_home_activities_completed=total_home_completed,
        total_storage_items=storage_overview.total_items,
        total_storage_bytes=storage_overview.total_bytes,
        daily_activity=daily_activity,
        subject_distribution=subject_distribution,
    )


@router.get("/storage", response_model=AdminStorageOverviewOut)
def get_storage_overview(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List uploaded lesson resources and saved studio artworks without exposing child PII."""
    return _collect_storage_overview(db)


@router.delete(
    "/storage/{item_type}/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_storage_item(
    item_type: str,
    item_id: str,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Remove an uploaded lesson resource or studio artwork from storage and database."""
    if item_type == "lesson_resource":
        resource = db.get(LessonResource, item_id)
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lesson resource not found."
            )
        storage_service.delete(resource.storage_key)
        db.delete(resource)
    elif item_type == "child_artwork":
        artwork = db.get(ChildArtwork, item_id)
        if not artwork:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Artwork asset not found."
            )
        storage_service.delete(artwork.storage_key)
        db.delete(artwork)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage item type. Expected 'lesson_resource' or 'child_artwork'.",
        )

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.storage_item_deleted",
        resource_type=item_type,
        resource_id=item_id,
        details={"item_type": item_type},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()


@router.get("/settings", response_model=list[PlatformSettingOut])
def list_platform_settings(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List all platform configuration settings."""
    rows = list(db.scalars(select(PlatformSetting).order_by(PlatformSetting.key.asc())).all())
    return [PlatformSettingOut.model_validate(row) for row in rows]


@router.put("/settings/{key}", response_model=PlatformSettingOut)
def upsert_platform_setting(
    key: str,
    payload: PlatformSettingUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Create or update a platform configuration setting and log the change."""
    normalized_key = key.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.-]{2,100}", normalized_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setting key must be 2-100 lowercase letters, digits, dots, dashes, or underscores.",
        )

    setting = db.scalar(select(PlatformSetting).where(PlatformSetting.key == normalized_key))
    if setting:
        setting.value_json = payload.value_json
        if payload.description is not None:
            setting.description = payload.description.strip()
    else:
        setting = PlatformSetting(
            key=normalized_key,
            value_json=payload.value_json,
            description=payload.description.strip() if payload.description else None,
        )
        db.add(setting)

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="admin.setting_updated",
        resource_type="platform_setting",
        resource_id=normalized_key,
        details={"value_keys": sorted(payload.value_json.keys())},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(setting)
    return PlatformSettingOut.model_validate(setting)


@router.get("/system-health", response_model=SystemHealthOut)
def get_system_health(
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Return live database health, storage configuration, and entity counts."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    counts = {
        "users": db.scalar(select(func.count(User.id))) or 0,
        "children": db.scalar(select(func.count(Child.id))) or 0,
        "classes": db.scalar(select(func.count(SchoolClass.id))) or 0,
        "subjects": db.scalar(select(func.count(Subject.id))) or 0,
        "themes": db.scalar(select(func.count(Theme.id))) or 0,
        "lessons": db.scalar(select(func.count(Lesson.id))) or 0,
        "games": db.scalar(select(func.count(Game.id))) or 0,
    }

    return SystemHealthOut(
        status="healthy" if db_status == "connected" else "degraded",
        database_status=db_status,
        storage_backend=settings.STORAGE_BACKEND,
        environment=settings.APP_ENV,
        counts=counts,
    )


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = Query(default=30, ge=1, le=100),
    action: Optional[str] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
    _current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Return recent administrative and authentication audit entries with optional filters."""
    stmt = select(AuditLog, User.email).outerjoin(User, User.id == AuditLog.actor_user_id)
    if action and action.strip():
        stmt = stmt.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if resource_type and resource_type.strip():
        stmt = stmt.where(AuditLog.resource_type == resource_type.strip())

    rows = list(db.execute(stmt.order_by(AuditLog.created_at.desc()).limit(limit)).all())
    return [
        AuditLogOut(
            id=log.id,
            actor_email=actor_email,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details_json=log.details_json,
            created_at=log.created_at,
        )
        for log, actor_email in rows
    ]
