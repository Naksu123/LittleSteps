import os
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import boto3
from botocore.config import Config
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

_S3_CLIENT_CONFIG = Config(connect_timeout=3, read_timeout=5, retries={"max_attempts": 2})
_HEALTH_CACHE_TTL_SECONDS = 15.0
_MAX_SIZE_CACHE_ENTRIES = 1000


class StorageValidationError(ValueError):
    """Raised when an uploaded file fails MIME type or size validation."""


class StorageService:
    """Abstracts local filesystem storage (dev) and private Amazon S3 signed URLs (prod)."""

    def __init__(self) -> None:
        self._s3_clients: dict[tuple[str, str, int], Any] = {}
        self._size_cache: dict[str, int] = {}
        self._health_cache: Optional[tuple[float, str, dict[str, str]]] = None

    def _get_s3_client(self):
        client_factory = boto3.client
        cache_key = (
            settings.AWS_REGION,
            settings.S3_ENDPOINT_URL or "",
            id(client_factory),
        )
        client = self._s3_clients.get(cache_key)
        if client is None:
            kwargs: dict[str, Any] = {
                "region_name": settings.AWS_REGION,
                "config": _S3_CLIENT_CONFIG,
            }
            if settings.S3_ENDPOINT_URL:
                kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
            client = client_factory("s3", **kwargs)
            if len(self._s3_clients) > 16:
                self._s3_clients.clear()
            self._s3_clients[cache_key] = client
        return client

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

    def _local_upload_root(self) -> Path:
        raw_dir = settings.LOCAL_UPLOAD_DIR
        if os.getenv("VERCEL") and raw_dir in {"./uploads", "uploads"}:
            raw_dir = "/tmp/uploads"
        return Path(raw_dir).resolve()

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
            if settings.APP_ENV != "test":
                self._size_cache[key] = len(content)
            return key

        upload_root = self._local_upload_root()
        target = (upload_root / key).resolve()
        if not str(target).startswith(str(upload_root)):
            raise StorageValidationError("Invalid storage key path.")
        os.makedirs(target.parent, exist_ok=True)
        target.write_bytes(content)
        if settings.APP_ENV != "test":
            self._size_cache[key] = len(content)
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
        upload_root = self._local_upload_root()
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
        if settings.APP_ENV != "test" and key in self._size_cache:
            return self._size_cache[key]

        size = 0
        if settings.STORAGE_BACKEND == "s3":
            try:
                resp = self._get_s3_client().head_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=key,
                )
                size = int(resp.get("ContentLength", 0))
            except (BotoCoreError, ClientError):
                size = 0
        else:
            try:
                target = self._resolve_local_path(key)
                if target.is_file():
                    size = target.stat().st_size
            except (StorageValidationError, OSError):
                size = 0

        if settings.APP_ENV != "test" and size > 0:
            if len(self._size_cache) >= _MAX_SIZE_CACHE_ENTRIES:
                self._size_cache.clear()
            self._size_cache[key] = size
        return size

    def check_health(self, use_cache: bool = False) -> dict[str, str]:
        """Verify local storage directory or S3 bucket reachability."""
        now = time.monotonic()
        if (
            use_cache
            and settings.APP_ENV != "test"
            and self._health_cache is not None
            and now - self._health_cache[0] < _HEALTH_CACHE_TTL_SECONDS
            and self._health_cache[1] == settings.STORAGE_BACKEND
        ):
            return dict(self._health_cache[2])

        if settings.STORAGE_BACKEND == "s3":
            if not settings.S3_BUCKET_NAME:
                result = {"backend": "s3", "status": "error"}
            else:
                try:
                    self._get_s3_client().head_bucket(Bucket=settings.S3_BUCKET_NAME)
                    result = {"backend": "s3", "status": "connected"}
                except (BotoCoreError, ClientError, Exception):
                    result = {"backend": "s3", "status": "error"}
        else:
            try:
                os.makedirs(self._local_upload_root(), exist_ok=True)
                result = {"backend": "local", "status": "ready"}
            except OSError:
                result = {"backend": "local", "status": "error"}

        if settings.APP_ENV != "test":
            self._health_cache = (now, settings.STORAGE_BACKEND, result)
        return dict(result)

    def delete(self, key: str) -> None:
        self._size_cache.pop(key, None)
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
