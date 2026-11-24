import time
from collections import defaultdict, deque

from fastapi import status
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings

AUTH_SENSITIVE_PATHS = {
    "/api/auth/login",
    "/api/auth/staff-login",
    "/api/auth/register",
}

_PRUNE_INTERVAL_SECONDS = 60.0
_WINDOW_SECONDS = 60.0


def _prune_buckets(buckets: dict[str, deque[float]], window_start: float) -> None:
    """Evict expired timestamps and remove idle IP buckets to bound memory usage."""
    stale_keys: list[str] = []
    for ip, dq in buckets.items():
        while dq and dq[0] < window_start:
            dq.popleft()
        if not dq:
            stale_keys.append(ip)
    for ip in stale_keys:
        del buckets[ip]


class RateLimitMiddleware:
    """Pure ASGI sliding-window per-IP rate limiter with stale-bucket pruning."""

    def __init__(
        self,
        app: ASGIApp,
        max_requests_per_minute: int = 120,
        auth_max_requests_per_minute: int = 10,
    ) -> None:
        self.app = app
        self.max_requests = max_requests_per_minute
        self.auth_max_requests = auth_max_requests_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._auth_hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_prune: float = time.monotonic()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if settings.APP_ENV == "test" or path in {
            "/api/health",
            "/api/health/ready",
        }:
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        forwarded_for = (headers.get("x-forwarded-for") or "").strip()
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip() or "unknown"
        else:
            real_ip = (headers.get("x-real-ip") or "").strip()
            client = scope.get("client")
            client_ip = real_ip or (client[0] if client else "unknown")

        now = time.monotonic()
        window_start = now - _WINDOW_SECONDS

        if now - self._last_prune >= _PRUNE_INTERVAL_SECONDS or len(self._hits) > 2000:
            _prune_buckets(self._hits, window_start)
            _prune_buckets(self._auth_hits, window_start)
            self._last_prune = now

        if path in AUTH_SENSITIVE_PATHS:
            auth_bucket = self._auth_hits[client_ip]
            while auth_bucket and auth_bucket[0] < window_start:
                auth_bucket.popleft()
            if len(auth_bucket) >= self.auth_max_requests:
                response = JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Too many authentication attempts. Please wait a minute and try again."
                    },
                )
                await response(scope, receive, send)
                return
            auth_bucket.append(now)

        bucket = self._hits[client_ip]
        while bucket and bucket[0] < window_start:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please pause briefly and try again."},
            )
            await response(scope, receive, send)
            return

        bucket.append(now)
        await self.app(scope, receive, send)
