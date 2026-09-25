import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    _requests: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        bucket = self._requests[client_ip]

        while bucket and now - bucket[0] > settings.rate_limit_window_seconds:
            bucket.popleft()

        if len(bucket) >= settings.rate_limit_requests:
            return JSONResponse(
                status_code=429,
                content={"success": False, "message": "Rate limit exceeded"},
            )

        bucket.append(now)
        return await call_next(request)
