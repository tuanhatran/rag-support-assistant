from __future__ import annotations

import logging
from datetime import timedelta

from app.observability import log_event, request_context
from app.redaction import redact
from app.repositories import utcnow


class AuditService:
    def __init__(self, repos, retention_days: int):
        self.repos = repos
        self.retention_days = retention_days

    async def record(self, event: str, outcome: str, actor: dict | None, target: dict | None = None,
                     details: dict | None = None, request=None):
        context = request_context.get()
        safe_details = {key: redact(str(value)) for key, value in (details or {}).items()}
        document = {"timestamp": utcnow(), "event": event, "outcome": outcome,
                    "actor": {"user_id": str(actor.get("_id")), "username": actor.get("username")} if actor else None,
                    "target": target, "details": safe_details,
                    "request_id": context.request_id if context else None,
                    "ip": request.client.host if request and request.client else None,
                    "user_agent": request.headers.get("user-agent", "")[:300] if request else "",
                    "expires_at": utcnow() + timedelta(days=self.retention_days)}
        await self.repos.audit_logs.insert_one(document)
        log_event(logging.getLogger("app.audit"), event, outcome=outcome,
                  actor=document["actor"], target=target, details=safe_details)
