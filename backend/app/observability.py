from __future__ import annotations

import contextvars
import json
import logging
import re
import time
import uuid
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.redaction import redact


@dataclass
class RequestContext:
    request_id: str
    user: dict | None = None


request_context: contextvars.ContextVar[RequestContext | None] = contextvars.ContextVar("request_context", default=None)
VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
SENSITIVE_FIELDS = re.compile(r"question|answer|comment|credential|api.?key|password|token|secret", re.IGNORECASE)


def safe_log_fields(value, key: str = ""):
    if SENSITIVE_FIELDS.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(child_key): safe_log_fields(child, str(child_key)) for child_key, child in value.items()}
    if isinstance(value, list):
        return [safe_log_fields(child) for child in value]
    if isinstance(value, str):
        return redact(value)
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        context = request_context.get()
        payload = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
                   "level": record.levelname, "logger": record.name, "message": redact(record.getMessage())}
        if context:
            payload["request_id"] = context.request_id
            if context.user:
                payload["user"] = context.user.get("username")
        extra = getattr(record, "fields", None)
        if isinstance(extra, dict):
            payload.update(safe_log_fields(extra))
        return json.dumps(payload, default=str)


def configure_logging(force: bool = False, level: str = "INFO", log_format: str = "json") -> None:
    root = logging.getLogger()
    if root.handlers and not force:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter() if log_format == "json" else logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    root.handlers = [handler]
    root.setLevel(level.upper())


def log_event(logger: logging.Logger, message: str, **fields) -> None:
    logger.info(redact(message), extra={"fields": fields})


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        requested_id = request.headers.get("x-request-id", "")
        request_id = requested_id if VALID_REQUEST_ID.fullmatch(requested_id) else str(uuid.uuid4())
        context = RequestContext(request_id=request_id)
        token = request_context.set(context)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            logger = logging.getLogger("app.request")
            logger.error("Unhandled request error", extra={"fields": {"error_type": type(exc).__name__}})
            response = JSONResponse({"error": "Internal server error", "request_id": request_id}, status_code=500)
        response.headers["X-Request-ID"] = request_id
        logging.getLogger("app.access").info("request", extra={"fields": {
            "method": request.method, "path": request.url.path, "status": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000),
            "ip": request.client.host if request.client else None,
        }})
        request_context.reset(token)
        return response
