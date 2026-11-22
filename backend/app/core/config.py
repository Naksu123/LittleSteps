from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.secrets import hydrate_settings_from_aws_secrets


class Settings(BaseSettings):
    """Application settings loaded from environment variables and AWS Secrets Manager."""

    APP_NAME: str = "LittleSteps LMS"
    APP_ENV: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./littlesteps_dev.db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 1800

    JWT_SECRET_KEY: str = "local-dev-only-change-before-production-32chars"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    RATE_LIMIT_PER_MINUTE: int = 120
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10
    STAFF_ACCESS_CODE: str = "LS-Staff-Private-2026!"
    SEED_ADMIN_PASSWORD: str = "LittleSteps2026!"
    SEED_TEACHER_PASSWORD: str = "LittleSteps2026!"
    SEED_PARENT_PASSWORD: str = "LittleSteps2026!"

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    STORAGE_BACKEND: str = "local"
    LOCAL_UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_ARTWORK_BYTES: int = 3 * 1024 * 1024  # 3 MB
    APP_TIMEZONE: str = "Asia/Manila"

    AWS_REGION: str = "ap-southeast-1"
    S3_BUCKET_NAME: str = "littlesteps-media-dev"
    S3_ENDPOINT_URL: str = ""
    CLOUDFRONT_DOMAIN: str = ""
    AWS_SECRETS_MANAGER_ARN: str = ""

    LOG_FORMAT: str = "json"
    LOG_LEVEL: str = "INFO"
    RUN_MIGRATIONS: bool = True
    SEED_ON_START: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Return sanitized list of allowed CORS origins."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


def validate_production_config(settings_obj: Settings) -> list[str]:
    """Validate critical cloud security settings when running in production."""
    if settings_obj.APP_ENV.lower() != "production":
        return []

    errors: list[str] = []
    jwt_secret = settings_obj.JWT_SECRET_KEY or ""
    if (
        len(jwt_secret) < 32
        or "local-dev-only" in jwt_secret
        or "change-this" in jwt_secret
    ):
        errors.append(
            "JWT_SECRET_KEY must be replaced with a random secret (>= 32 chars) in production."
        )

    if (settings_obj.DATABASE_URL or "").startswith("sqlite"):
        errors.append(
            "DATABASE_URL cannot point to local SQLite in production; use AWS RDS PostgreSQL."
        )

    if "*" in settings_obj.cors_origins_list:
        errors.append(
            "CORS_ORIGINS must not contain wildcard '*' in production; set the Amplify/frontend origin."
        )

    if settings_obj.STORAGE_BACKEND == "s3" and not (settings_obj.S3_BUCKET_NAME or "").strip():
        errors.append("S3_BUCKET_NAME must be configured when STORAGE_BACKEND=s3.")

    staff_code = (settings_obj.STAFF_ACCESS_CODE or "").strip()
    if (
        len(staff_code) < 12
        or "LS-Staff-Private" in staff_code
        or "change-this" in staff_code
    ):
        errors.append(
            "STAFF_ACCESS_CODE must be replaced with a private secret (>= 12 chars) in production."
        )

    return errors


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton, optionally hydrated from AWS Secrets Manager."""
    loaded = Settings()
    hydrate_settings_from_aws_secrets(loaded)
    return loaded


settings = get_settings()
