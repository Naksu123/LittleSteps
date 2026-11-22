import os
import uuid
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

ALLOWED_MIME_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "application/pdf": ".pdf",
}


class StorageValidationError(ValueError):
    """Raised when an uploaded file fails MIME type or size validation."""


class StorageService:
    """Abstracts local filesystem storage (dev) and private Amazon S3 signed URLs (prod)."""

    def _get_s3_client(self):
        kwargs: dict[str, str] = {"region_name": settings.AWS_REGION}
        if settings.S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
        return boto3.client("s3", **kwargs)

    def validate_file(self, content_type: str, size_bytes: int) -> str:
        if content_type not in ALLOWED_MIME_TYPES:
            raise StorageValidationError(
                f"Unsupported file type '{content_type}'. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
            )
        if size_bytes <= 0 or size_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
            raise StorageValidationError(
                f"File size must be between 1 byte and {settings.MAX_UPLOAD_SIZE_BYTES} bytes."
            )
        return ALLOWED_MIME_TYPES[content_type]

    def save_bytes(self, prefix: str, content: bytes, content_type: str) -> str:
        ext = self.validate_file(content_type, len(content))
        key = f"{prefix.strip('/')}/{uuid.uuid4().hex}{ext}"

        if settings.STORAGE_BACKEND == "s3":
            client = self._get_s3_client()
            client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=content,
                ContentType=content_type,
                ServerSideEncryption="AES256",
                CacheControl="private, max-age=3600",
            )
            return key

        upload_root = Path(settings.LOCAL_UPLOAD_DIR).resolve()
        target = (upload_root / key).resolve()
        if not str(target).startswith(str(upload_root)):
            raise StorageValidationError("Invalid storage key path.")
        os.makedirs(target.parent, exist_ok=True)
        target.write_bytes(content)
        return key

    def create_presigned_upload_url(
        self,
        prefix: str,
        content_type: str,
        size_bytes: int,
        expires_in: int = 300,
    ) -> dict[str, str]:
        """Generate an opaque storage key and direct pre-signed PUT URL for S3 uploads."""
        ext = self.validate_file(content_type, size_bytes)
        key = f"{prefix.strip('/')}/{uuid.uuid4().hex}{ext}"

        if settings.STORAGE_BACKEND == "s3":
            client = self._get_s3_client()
            url = client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.S3_BUCKET_NAME,
                    "Key": key,
                    "ContentType": content_type,
                    "ServerSideEncryption": "AES256",
                },
                ExpiresIn=expires_in,
            )
            return {"storage_key": key, "upload_url": url, "content_type": content_type}

        return {
            "storage_key": key,
            "upload_url": f"/api/media/local/{key}",
            "content_type": content_type,
        }

    def get_signed_url(self, key: str, expires_in: int = 900) -> Optional[str]:
        if settings.STORAGE_BACKEND == "s3":
            try:
                client = self._get_s3_client()
                return client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
                    ExpiresIn=expires_in,
                )
            except (BotoCoreError, ClientError):
                return None
        return f"/api/media/local/{key}"

    def _resolve_local_path(self, key: str) -> Path:
        upload_root = Path(settings.LOCAL_UPLOAD_DIR).resolve()
        target = (upload_root / key).resolve()
        if not str(target).startswith(str(upload_root)):
            raise StorageValidationError("Invalid storage key path.")
        return target

    def read_local_bytes(self, key: str) -> bytes:
        target = self._resolve_local_path(key)
        if not target.is_file():
            raise FileNotFoundError(f"Stored asset not found: {key}")
        return target.read_bytes()

    def get_file_size(self, key: str) -> int:
        if settings.STORAGE_BACKEND == "s3":
            try:
                resp = self._get_s3_client().head_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=key,
                )
                return int(resp.get("ContentLength", 0))
            except (BotoCoreError, ClientError):
                return 0

        try:
            target = self._resolve_local_path(key)
            if target.is_file():
                return target.stat().st_size
        except (StorageValidationError, OSError):
            return 0
        return 0

    def check_health(self) -> dict[str, str]:
        """Verify local storage directory or S3 bucket reachability."""
        if settings.STORAGE_BACKEND == "s3":
            if not settings.S3_BUCKET_NAME:
                return {"backend": "s3", "status": "error"}
            try:
                self._get_s3_client().head_bucket(Bucket=settings.S3_BUCKET_NAME)
                return {"backend": "s3", "status": "connected"}
            except (BotoCoreError, ClientError, Exception):
                return {"backend": "s3", "status": "error"}

        try:
            os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)
            return {"backend": "local", "status": "ready"}
        except OSError:
            return {"backend": "local", "status": "error"}

    def delete(self, key: str) -> None:
        if settings.STORAGE_BACKEND == "s3":
            try:
                client = self._get_s3_client()
                client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
            except (BotoCoreError, ClientError):
                return
            return

        target = self._resolve_local_path(key)
        if target.is_file():
            target.unlink()


storage_service = StorageService()
