import os
import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.auth.tokens import decode_access_token

logger = structlog.get_logger("backend.middleware")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(sections=None)

        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        admin_user = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            try:
                admin_user = decode_access_token(token)
            except Exception:
                admin_user = None

        environment = os.getenv("ENVIRONMENT", os.getenv("ENV", "dev"))

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status_code = response.status_code

            log_func = (
                logger.error
                if status_code >= 500
                else (logger.warning if status_code >= 400 else logger.info)
            )
            sections = getattr(request.state, "sections", None)
            if sections is None:
                sections = structlog.contextvars.get_contextvars().get("sections")
            log_func(
                "http_request",
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=duration_ms,
                request_id=request_id,
                environment=environment,
                admin_user=admin_user,
                sections=sections,
            )
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            sections = getattr(request.state, "sections", None)
            if sections is None:
                sections = structlog.contextvars.get_contextvars().get("sections")
            logger.error(
                "http_request",
                method=request.method,
                path=request.url.path,
                status_code=500,
                duration_ms=duration_ms,
                request_id=request_id,
                environment=environment,
                admin_user=admin_user,
                sections=sections,
                exc_info=exc,
            )
            raise exc
