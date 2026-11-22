import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings

_STRUCTURED_EXTRAS = (
    "request_id",
    "method",
    "path",
    "status_code",
    "duration_ms",
    "client_ip",
)


class CloudWatchJsonFormatter(logging.Formatter):
    """Format log records as single-line JSON objects for Amazon CloudWatch Logs."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": "littlesteps-api",
            "environment": settings.APP_ENV,
        }

        for field in _STRUCTURED_EXTRAS:
            if hasattr(record, field):
                payload[field] = getattr(record, field)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging(log_level: str = "INFO", log_format: str = "json") -> None:
    """Configure application logging cleanly without duplicating handlers."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    if log_format.lower() == "json":
        handler.setFormatter(CloudWatchJsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level)

    http_logger = logging.getLogger("littlesteps.http")
    http_logger.setLevel(level)
    http_logger.propagate = True
