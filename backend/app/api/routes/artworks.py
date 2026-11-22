import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_child_access
from app.core.config import settings
from app.core.database import get_db
from app.models.progress import ChildArtwork
from app.models.user import User
from app.repositories.learner_repo import parent_owns_child
from app.schemas.progress import ArtworkCreate, ArtworkOut
from app.services.audit_service import record_audit
from app.services.progress_service import finalize_learning_event
from app.services.storage_service import StorageValidationError, storage_service

router = APIRouter(prefix="/children", tags=["Child Artworks"])

PNG_DATA_URL_PREFIX = "data:image/png;base64,"
PNG_MAGIC_BYTES = b"\x89PNG\r\n\x1a\n"


def _to_artwork_out(child_id: str, artwork: ChildArtwork) -> ArtworkOut:
    return ArtworkOut(
        id=artwork.id,
        title=artwork.title,
        palette_used_json=artwork.palette_used_json,
        approved_by_parent=artwork.approved_by_parent,
        created_at=artwork.created_at,
        image_url=f"/api/children/{child_id}/artworks/{artwork.id}/image",
    )


@router.post("/{child_id}/artworks", response_model=ArtworkOut, status_code=status.HTTP_201_CREATED)
def create_artwork(
    child_id: str,
    payload: ArtworkCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate and store a PNG drawing from the Kids Art Studio."""
    child = verify_child_access(db, current_user, child_id)

    if not payload.image_data.startswith(PNG_DATA_URL_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Artwork must be encoded as a PNG data URL.",
        )

    encoded = payload.image_data[len(PNG_DATA_URL_PREFIX) :]
    try:
        raw_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PNG image payload.",
        ) from exc

    if len(raw_bytes) > settings.MAX_ARTWORK_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Artwork exceeds maximum allowed image size.",
        )

    if not raw_bytes.startswith(PNG_MAGIC_BYTES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded bytes do not form a valid PNG image.",
        )

    try:
        storage_key = storage_service.save_bytes("artworks", raw_bytes, "image/png")
    except StorageValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    artwork = ChildArtwork(
        child_id=child.id,
        title=payload.title.strip(),
        storage_key=storage_key,
        palette_used_json=payload.palette_used,
        approved_by_parent=True,
    )
    db.add(artwork)
    db.flush()

    record_audit(
        db,
        actor_user_id=current_user.id,
        action="artwork.created",
        resource_type="artwork",
        resource_id=artwork.id,
        ip_address=request.client.host if request.client else None,
    )
    finalize_learning_event(db, child, 0)
    db.refresh(artwork)
    return _to_artwork_out(child.id, artwork)


@router.get("/{child_id}/artworks", response_model=list[ArtworkOut])
def list_artworks(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List saved artworks for an authorized child, newest first."""
    child = verify_child_access(db, current_user, child_id)
    artworks = list(
        db.scalars(
            select(ChildArtwork)
            .where(ChildArtwork.child_id == child.id)
            .order_by(ChildArtwork.created_at.desc())
        ).all()
    )
    return [_to_artwork_out(child.id, art) for art in artworks]


@router.get("/{child_id}/artworks/{artwork_id}/image")
def get_artwork_image(
    child_id: str,
    artwork_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream saved PNG artwork bytes (local) or redirect to a signed S3 URL."""
    child = verify_child_access(db, current_user, child_id)
    artwork = db.scalar(
        select(ChildArtwork).where(
            ChildArtwork.id == artwork_id,
            ChildArtwork.child_id == child.id,
        )
    )
    if not artwork:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artwork not found.")

    if settings.STORAGE_BACKEND == "s3":
        signed_url = storage_service.get_signed_url(artwork.storage_key)
        if not signed_url:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artwork media unavailable.")
        return RedirectResponse(url=signed_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    try:
        content = storage_service.read_local_bytes(artwork.storage_key)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Artwork file not found."
        ) from exc

    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Cache-Control": "private, max-age=300",
            "Content-Disposition": 'inline; filename="artwork.png"',
        },
    )


@router.delete("/{child_id}/artworks/{artwork_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_artwork(
    child_id: str,
    artwork_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a child's artwork (owning parent or admin only)."""
    roles = set(current_user.role_names)
    if "admin" not in roles and not ("parent" in roles and parent_owns_child(db, current_user.id, child_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the child's parent or an administrator can delete artwork.",
        )

    artwork = db.scalar(
        select(ChildArtwork).where(
            ChildArtwork.id == artwork_id,
            ChildArtwork.child_id == child_id,
        )
    )
    if not artwork:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artwork not found.")

    storage_service.delete(artwork.storage_key)
    db.delete(artwork)
    record_audit(
        db,
        actor_user_id=current_user.id,
        action="artwork.deleted",
        resource_type="artwork",
        resource_id=artwork_id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return None
