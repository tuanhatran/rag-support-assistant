from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from bson import ObjectId
from fastapi import Request
from pymongo import AsyncMongoClient

from app.audit import AuditService
from app.config import Settings
from app.errors import AuthenticationError, AuthorizationError, ValidationError
from app.observability import request_context
from app.rag import KnowledgeBase
from app.repositories import Repositories, seed_connection, utcnow
from app.security import hash_password, hash_token
from app.services import AdminService, AuthService, ChatService, FeedbackService, PrivacyService


@dataclass
class Container:
    client: object
    repos: Repositories
    settings: Settings
    knowledge: KnowledgeBase
    audit: AuditService
    auth: AuthService
    chat: ChatService
    feedback: FeedbackService
    privacy: PrivacyService
    admin: AdminService


def build_container(settings: Settings, database=None, client=None) -> Container:
    if database is None:
        client = client or AsyncMongoClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
        database = client[settings.mongo_db]
    repos = Repositories(database)
    audit = AuditService(repos, settings.audit_retention_days)
    knowledge = KnowledgeBase(Path(__file__).parent / "data" / "documents", settings.retrieval_top_k)
    return Container(client, repos, settings, knowledge, audit,
                     AuthService(repos, settings, audit), ChatService(repos, settings, knowledge, audit),
                     FeedbackService(repos, settings, audit), PrivacyService(repos, settings, audit),
                     AdminService(repos, settings, audit))


async def initialize_container(container: Container) -> None:
    await container.repos.ensure_indexes()
    await seed_connection(container.repos)
    if container.settings.bootstrap_admin_password:
        username = container.settings.bootstrap_admin_username.strip().lower()
        if not await container.repos.get_user_by_username(username):
            from datetime import datetime, timezone
            await container.repos.users.insert_one({"username": username,
                "password": hash_password(container.settings.bootstrap_admin_password), "role": "admin", "plan": "premium",
                "policy_consent": {"version": container.settings.data_policy_version,
                                   "accepted_at": datetime.now(timezone.utc)},
                "created_at": datetime.now(timezone.utc)})


async def current_user(request: Request):
    container = request.app.state.container
    token = request.cookies.get("rag-support-assistant")
    if not token:
        raise AuthenticationError("Authentication required")
    session = await container.repos.sessions.find_one({"_id": hash_token(token), "expires_at": {"$gt": utcnow()}})
    if not session:
        raise AuthenticationError("Authentication required")
    user = await container.repos.get_user(session["user_id"])
    if not user:
        raise AuthenticationError("Authentication required")
    context = request_context.get()
    if context:
        context.user = user
    return user


async def require_admin(request: Request):
    user = await current_user(request)
    if user.get("role") != "admin":
        await request.app.state.container.audit.record("auth.access_denied", "denied", user,
            {"path": request.url.path}, request=request)
        raise AuthorizationError("Administrator access required")
    return user


async def consented_user(request: Request):
    user = await current_user(request)
    consent = user.get("policy_consent", {})
    if consent.get("version") != request.app.state.container.settings.data_policy_version or not consent.get("accepted_at"):
        raise ValidationError("Accept the current data policy before continuing")
    return user
