import json
import logging
from pathlib import Path
from types import SimpleNamespace

import yaml
from fastapi.testclient import TestClient

from app.core.config import Settings, validate_production_config
from app.core.logging_config import CloudWatchJsonFormatter
from app.core.secrets import hydrate_settings_from_aws_secrets
from app.services.storage_service import StorageService

REPO_ROOT = Path(__file__).resolve().parents[2]


class _CfnSafeLoader(yaml.SafeLoader):
    """YAML SafeLoader supporting AWS CloudFormation intrinsic tags."""


for _tag in ("!Ref", "!Sub", "!GetAtt", "!If", "!Not", "!Equals", "!Base64", "!Select", "!Split"):
    _CfnSafeLoader.add_multi_constructor(_tag, lambda loader, tag, node: {tag: node.value})


def test_aws_secrets_hydration(monkeypatch) -> None:
    calls: list[dict[str, str]] = []

    class FakeSecretsClient:
        def get_secret_value(self, SecretId: str):
            calls.append({"SecretId": SecretId})
            return {
                "SecretString": json.dumps(
                    {
                        "DATABASE_URL": "postgresql+psycopg://admin:pass@rds.example:5432/littlesteps",
                        "JWT_SECRET_KEY": "super-secret-prod-jwt-key-at-least-32-chars",
                        "S3_BUCKET_NAME": "littlesteps-media-123-prod",
                        "CORS_ORIGINS": "https://main.demo.amplifyapp.com",
                    }
                )
            }

    monkeypatch.setattr("app.core.secrets.boto3.client", lambda *a, **kw: FakeSecretsClient())

    # Skips cleanly when secret ARN is empty
    empty_cfg = SimpleNamespace(
        AWS_SECRETS_MANAGER_ARN="",
        AWS_REGION="ap-southeast-1",
        APP_ENV="production",
    )
    assert hydrate_settings_from_aws_secrets(empty_cfg) == []
    assert calls == []

    # Applies supported keys when secret ARN is set
    prod_cfg = SimpleNamespace(
        AWS_SECRETS_MANAGER_ARN="arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:littlesteps",
        AWS_REGION="ap-southeast-1",
        APP_ENV="production",
        DATABASE_URL="",
        JWT_SECRET_KEY="",
        S3_BUCKET_NAME="",
        CORS_ORIGINS="",
    )
    applied = hydrate_settings_from_aws_secrets(prod_cfg, force=True)
    assert applied == ["DATABASE_URL", "JWT_SECRET_KEY", "S3_BUCKET_NAME", "CORS_ORIGINS"]
    assert prod_cfg.S3_BUCKET_NAME == "littlesteps-media-123-prod"


def test_validate_production_config_checks() -> None:
    bad = Settings(
        APP_ENV="production",
        DATABASE_URL="sqlite:///./littlesteps_dev.db",
        JWT_SECRET_KEY="local-dev-only-change-before-production-32chars",
        CORS_ORIGINS="*",
        STORAGE_BACKEND="s3",
        S3_BUCKET_NAME="",
    )
    errors = validate_production_config(bad)
    assert len(errors) == 5

    good = Settings(
        APP_ENV="production",
        DATABASE_URL="postgresql+psycopg://littlesteps:strong@db.example:5432/littlesteps",
        JWT_SECRET_KEY="a-very-strong-production-random-secret-key-64-chars",
        CORS_ORIGINS="https://app.littlesteps.edu",
        STORAGE_BACKEND="s3",
        S3_BUCKET_NAME="littlesteps-media-prod",
        STAFF_ACCESS_CODE="prod-private-staff-gate-key-9921",
    )
    assert validate_production_config(good) == []


def test_s3_storage_service_operations(monkeypatch) -> None:
    recorded: list[tuple[str, dict]] = []

    class FakeS3Client:
        def put_object(self, **kwargs):
            recorded.append(("put_object", kwargs))

        def generate_presigned_url(self, ClientMethod: str, Params: dict, ExpiresIn: int):
            recorded.append(("presign", {"method": ClientMethod, **Params, "ExpiresIn": ExpiresIn}))
            return f"https://s3.ap-southeast-1.amazonaws.com/{Params['Bucket']}/{Params['Key']}?signed=1"

        def head_object(self, **kwargs):
            recorded.append(("head_object", kwargs))
            return {"ContentLength": 4096}

        def head_bucket(self, **kwargs):
            recorded.append(("head_bucket", kwargs))

        def delete_object(self, **kwargs):
            recorded.append(("delete_object", kwargs))

    from app.core.config import settings

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "s3")
    monkeypatch.setattr(settings, "S3_BUCKET_NAME", "littlesteps-media-test")
    monkeypatch.setattr("app.services.storage_service.boto3.client", lambda *a, **kw: FakeS3Client())

    svc = StorageService()
    key = svc.save_bytes("resources/lesson-1", b"%PDF-1.4 demo payload", "application/pdf")
    assert key.startswith("resources/lesson-1/") and key.endswith(".pdf")
    put_call = next(payload for op, payload in recorded if op == "put_object")
    assert put_call["ServerSideEncryption"] == "AES256"

    presigned_up = svc.create_presigned_upload_url("resources/lesson-1", "image/png", 1024)
    assert "signed=1" in presigned_up["upload_url"]

    signed_get = svc.get_signed_url(key)
    assert signed_get is not None and "signed=1" in signed_get

    assert svc.get_file_size(key) == 4096
    assert svc.check_health() == {"backend": "s3", "status": "connected"}

    svc.delete(key)
    assert any(op == "delete_object" and payload["Key"] == key for op, payload in recorded)


def test_health_ready_and_request_id_headers(client: TestClient) -> None:
    r1 = client.get("/api/health")
    assert r1.status_code == 200
    assert r1.json()["storage_status"] == "ready"
    assert "X-Request-ID" in r1.headers

    r2 = client.get("/api/health/ready", headers={"X-Request-ID": "trace-cloud-123"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "ready"
    assert r2.headers["X-Request-ID"] == "trace-cloud-123"


def test_cloudwatch_json_formatter() -> None:
    formatter = CloudWatchJsonFormatter()
    record = logging.LogRecord(
        name="littlesteps.http",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="GET /api/health -> 200",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-abc"
    record.status_code = 200
    formatted = json.loads(formatter.format(record))
    assert formatted["service"] == "littlesteps-api"
    assert formatted["request_id"] == "req-abc"
    assert formatted["status_code"] == 200
    assert "timestamp" in formatted


def test_iac_yaml_templates_and_entrypoint_line_endings() -> None:
    cfn_path = REPO_ROOT / "infrastructure" / "aws" / "cloudformation-mvp.yaml"
    cfn = yaml.load(cfn_path.read_text(encoding="utf-8"), Loader=_CfnSafeLoader)
    resources = cfn["Resources"]
    for expected in (
        "MediaBucket",
        "MediaBucketPolicy",
        "BackendECRRepository",
        "AppCloudWatchLogGroup",
        "RDSSecurityGroup",
        "LittleStepsDB",
        "RDSHighCPUAlarm",
        "RDSLowStorageAlarm",
        "AppSecrets",
        "AppRunnerECRAccessRole",
        "AppRunnerInstanceRole",
        "AppRunnerService",
    ):
        assert expected in resources, f"Missing CloudFormation resource: {expected}"

    assert resources["MediaBucket"]["Properties"]["PublicAccessBlockConfiguration"]["BlockPublicAcls"] is True
    assert resources["LittleStepsDB"]["Properties"]["StorageEncrypted"] is True

    for rel in (
        "infrastructure/aws/apprunner.yaml",
        "infrastructure/aws/amplify.yml",
        "docker-compose.yml",
        ".github/workflows/ci-cd.yml",
    ):
        parsed = yaml.safe_load((REPO_ROOT / rel).read_text(encoding="utf-8"))
        assert isinstance(parsed, dict) and parsed

    entrypoint_bytes = (REPO_ROOT / "backend" / "scripts" / "entrypoint.sh").read_bytes()
    assert b"\r" not in entrypoint_bytes, "entrypoint.sh must use Unix LF line endings"
