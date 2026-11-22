import json
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

_SUPPORTED_SECRET_KEYS = (
    "DATABASE_URL",
    "JWT_SECRET_KEY",
    "S3_BUCKET_NAME",
    "CORS_ORIGINS",
    "CLOUDFRONT_DOMAIN",
    "STAFF_ACCESS_CODE",
)


def load_aws_secrets(secret_id: str, region: str) -> dict[str, Any]:
    """Fetch and parse a JSON secret bundle from AWS Secrets Manager."""
    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_id)
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"Failed to retrieve secret '{secret_id}' from AWS Secrets Manager.") from exc

    secret_string = response.get("SecretString")
    if not secret_string:
        raise RuntimeError(f"Secret '{secret_id}' returned an empty SecretString.")

    try:
        parsed = json.loads(secret_string)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Secret '{secret_id}' SecretString must contain a valid JSON object.") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError(f"Secret '{secret_id}' must decode to a JSON object.")

    return parsed


def hydrate_settings_from_aws_secrets(settings_obj: Any, force: bool = False) -> list[str]:
    """Hydrate supported runtime settings from AWS Secrets Manager when configured."""
    secret_arn = str(getattr(settings_obj, "AWS_SECRETS_MANAGER_ARN", "") or "").strip()
    if not secret_arn:
        return []

    app_env = str(getattr(settings_obj, "APP_ENV", "") or "").lower()
    if not force and app_env == "test":
        return []

    region = str(getattr(settings_obj, "AWS_REGION", "ap-southeast-1") or "ap-southeast-1")
    secret_data = load_aws_secrets(secret_arn, region)

    applied_keys: list[str] = []
    for key in _SUPPORTED_SECRET_KEYS:
        val = secret_data.get(key)
        if isinstance(val, str) and val.strip():
            setattr(settings_obj, key, val.strip())
            applied_keys.append(key)
    return applied_keys
