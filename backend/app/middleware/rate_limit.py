import time
from collections import defaultdict, deque

from fastapi import status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

AUTH_SENSITIVE_PATHS = {
    "/api/auth/login",
    "/api/auth/staff-login",
    "/api/auth/register",
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple sliding-window per-IP rate limiter with stricter auth limits (bypassed in test mode)."""

    def __init__(
        self,
        app,
        max_requests_per_minute: int = 120,
        auth_max_requests_per_minute: int = 10,
    ) -> None:
        super().__init__(app)
        self.max_requests = max_requests_per_minute
        self.auth_max_requests = auth_max_requests_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._auth_hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next) -> Response:
        if settings.APP_ENV == "test" or request.url.path in {
            "/api/health",
            "/api/health/ready",
        }:
            return await call_next(request)

        forwarded_for = (request.headers.get("x-forwarded-for") or "").strip()
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip() or "unknown"
        else:
            real_ip = (request.headers.get("x-real-ip") or "").strip()
            client_ip = real_ip or (request.client.host if request.client else "unknown")
        now = time.monotonic()
        window_start = now - 60.0

        if request.url.path in AUTH_SENSITIVE_PATHS:
            auth_bucket = self._auth_hits[client_ip]
            while auth_bucket and auth_bucket[0] < window_start:
                auth_bucket.popleft()
            if len(auth_bucket) >= self.auth_max_requests:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Too many authentication attempts. Please wait a minute and try again."
                    },
                )
            auth_bucket.append(now)

        bucket = self._hits[client_ip]
        while bucket and bucket[0] < window_start:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please pause briefly and try again."},
            )

        bucket.append(now)
        return await call_next(request)
