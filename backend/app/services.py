from __future__ import annotations

import logging
import time
import uuid
from datetime import timedelta

from bson import ObjectId

from app.errors import AuthenticationError, ConfigurationError, NotFoundError, ValidationError
from app.llm import build_messages, complete, mock_answer
from app.observability import log_event
from app.redaction import redact
from app.repositories import utcnow
from app.security import decrypt_secret, encrypt_secret, hash_password, hash_token, new_session_token, verify_password


DUMMY_PASSWORD_HASH = hash_password("timing-safe-dummy-password")


PLANS = [
    {"id": "basic", "description": "Essential troubleshooting help"},
    {"id": "standard", "description": "A more capable model for everyday support"},
    {"id": "premium", "description": "The most capable model for complex incidents"},
]


def public_user(user: dict, connection: dict | None = None) -> dict:
    consent = user.get("policy_consent", {})
    return {"id": str(user["_id"]), "username": user["username"], "role": user["role"], "plan": user["plan"],
            "model": connection.get("model") if connection else None,
            "policy_version": consent.get("version"),
            "policy_accepted": bool(consent.get("accepted_at") and consent.get("version"))}


class AuthService:
    def __init__(self, repos, settings, audit):
        self.repos, self.settings, self.audit = repos, settings, audit

    async def register(self, body, request):
        if not body.policy_accepted:
            raise ValidationError("You must accept the data policy")
        username = body.username.strip().lower()
        if await self.repos.get_user_by_username(username):
            raise ValidationError("Username is already registered")
        now = utcnow()
        user = {"username": username, "password": hash_password(body.password), "role": "user", "plan": body.plan,
                "policy_consent": {"version": self.settings.data_policy_version, "accepted_at": now}, "created_at": now}
        result = await self.repos.users.insert_one(user)
        user["_id"] = result.inserted_id
        await self.audit.record("auth.register", "success", user, {"user_id": str(result.inserted_id)}, request=request)
        await self.audit.record("privacy.policy_accepted", "success", user,
                    details={"version": self.settings.data_policy_version}, request=request)
        return user

    async def login(self, username: str, password: str, request):
        user = await self.repos.get_user_by_username(username.strip().lower())
        valid_password = verify_password(password, user["password"] if user else DUMMY_PASSWORD_HASH)
        if not valid_password:
            await self.audit.record("auth.login", "failure", None, {"username": username.strip().lower()}, request=request)
            raise AuthenticationError("Invalid username or password")
        token = new_session_token()
        await self.repos.sessions.insert_one({"_id": hash_token(token), "user_id": str(user["_id"]),
                                              "expires_at": utcnow() + timedelta(hours=self.settings.session_ttl_hours)})
        await self.audit.record("auth.login", "success", user, request=request)
        return user, token

    async def logout(self, user: dict, token: str | None, request):
        if token:
            await self.repos.sessions.delete_one({"_id": hash_token(token)})
        await self.audit.record("auth.logout", "success", user, request=request)

    async def connection_for_plan(self, plan: str):
        connection = await self.repos.connections.find_one({"plans": plan})
        if not connection:
            raise ConfigurationError(f"No model is assigned to the {plan} plan")
        return connection

    async def me(self, user: dict):
        result = public_user(user, await self.connection_for_plan(user["plan"]))
        result["policy_accepted"] = result["policy_accepted"] and result["policy_version"] == self.settings.data_policy_version
        return result


class ChatService:
    def __init__(self, repos, settings, knowledge, audit):
        self.repos, self.settings, self.knowledge, self.audit = repos, settings, knowledge, audit

    async def create_session(self, user: dict):
        now = utcnow()
        session = {"_id": str(uuid.uuid4()), "user_id": str(user["_id"]), "title": "New conversation",
                   "messages": [], "created_at": now, "updated_at": now,
                   "expires_at": now + timedelta(days=self.settings.conversation_retention_days)}
        await self.repos.chat_sessions.insert_one(session)
        return self.serialize_session(session, include_messages=False)

    @staticmethod
    def serialize_session(session: dict, include_messages: bool = True) -> dict:
        result = {"id": str(session["_id"]), "title": session["title"], "created_at": session["created_at"],
                  "updated_at": session["updated_at"]}
        if include_messages:
            result["messages"] = session.get("messages", [])
        return result

    async def ask(self, user: dict, session_id: str, question: str):
        session = await self.repos.get_chat(session_id, str(user["_id"]))
        if not session:
            raise NotFoundError("Conversation not found")
        safe_question = redact(question)
        sources = self.knowledge.search(safe_question, self.settings.retrieval_top_k)
        connection = await AuthService(self.repos, self.settings, self.audit).connection_for_plan(user["plan"])
        history = [item for item in session.get("messages", []) if item.get("status") == "ok"][-self.settings.history_turns:]
        messages = build_messages(safe_question, sources, history)
        message_id = str(uuid.uuid4())
        started = time.perf_counter()
        status = "ok"
        if connection["provider"] == "mock":
            answer = mock_answer(sources)
        else:
            try:
                key = decrypt_secret(self.settings.encryption_key, connection.get("api_key_encrypted", ""))
                answer = await complete(connection, key, messages, self.settings.llm_timeout_seconds)
                answer = redact(answer)
            except Exception as exc:
                status = "error"
                answer = f"The configured model could not answer this request ({type(exc).__name__}). Please try again or open a support ticket."
        latency = round((time.perf_counter() - started) * 1000)
        stored_sources = [{key: value for key, value in source.items() if key != "text"} for source in sources]
        message = {"id": message_id, "question": safe_question, "answer": answer, "status": status,
                   "sources": stored_sources, "model": {"connection_id": str(connection["_id"]), "name": connection["name"],
                   "provider": connection["provider"], "model": connection["model"]}, "latency_ms": latency,
                   "redacted": safe_question != question, "created_at": utcnow()}
        title = safe_question[:60].strip() or "New conversation"
        await self.repos.chat_sessions.update_one({"_id": session_id, "user_id": str(user["_id"])}, {"$push": {"messages": message},
            "$set": {"title": title if not session.get("messages") else session["title"], "updated_at": utcnow(),
                     "expires_at": utcnow() + timedelta(days=self.settings.conversation_retention_days)}})
        log_event(logging.getLogger("app.chat"), "answer generated", connection=connection["name"], model=connection["model"],
                  status=status, latency_ms=latency, source_count=len(sources))
        return message


class FeedbackService:
    def __init__(self, repos, settings, audit):
        self.repos, self.settings, self.audit = repos, settings, audit

    async def submit(self, user: dict, body):
        session = await self.repos.get_chat(body.session_id, str(user["_id"]))
        message = next((item for item in session.get("messages", []) if item["id"] == body.message_id), None) if session else None
        if not message:
            raise NotFoundError("Answer not found")
        document = {"session_id": body.session_id, "message_id": body.message_id, "user_id": str(user["_id"]),
                    "username": user["username"], "rating": body.rating, "categories": body.categories,
                    "comment": redact(body.comment), "question": message["question"], "answer": redact(message["answer"]),
                    "model": message["model"], "created_at": utcnow(),
                    "expires_at": utcnow() + timedelta(days=self.settings.feedback_retention_days)}
        await self.repos.feedback.update_one({"session_id": body.session_id, "message_id": body.message_id},
                                            {"$set": document}, upsert=True)
        return {"ok": True}


class PrivacyService:
    def __init__(self, repos, settings, audit):
        self.repos, self.settings, self.audit = repos, settings, audit

    def policy(self):
        return {"version": self.settings.data_policy_version, "title": "RAG Support Assistant data policy",
                "retention": {"conversations": self.settings.conversation_retention_days,
                              "feedback": self.settings.feedback_retention_days,
                              "audit": self.settings.audit_retention_days},
                "sections": [
                    {"heading": "What we store", "text": "Questions, grounded answers, sources, model metadata, feedback, and security audit events. Potential secrets are redacted before model calls and storage."},
                    {"heading": "Retention", "text": f"Conversations are kept for {self.settings.conversation_retention_days} days after the latest message. Feedback is kept for {self.settings.feedback_retention_days} days. Audit events are kept for {self.settings.audit_retention_days} days."},
                    {"heading": "Your choices", "text": "You can export your data, erase conversations and feedback, or delete your account. Audit records remain until their retention expires."},
                ]}

    async def consent(self, user: dict, accepted: bool, request):
        if not accepted:
            raise ValidationError("Consent must be accepted to continue")
        now = utcnow()
        await self.repos.users.update_one({"_id": user["_id"]}, {"$set": {"policy_consent": {"version": self.settings.data_policy_version, "accepted_at": now}}})
        await self.audit.record("privacy.policy_accepted", "success", user, details={"version": self.settings.data_policy_version}, request=request)
        user["policy_consent"] = {"version": self.settings.data_policy_version, "accepted_at": now}
        return {"policy_version": self.settings.data_policy_version, "policy_accepted": True}

    async def export_data(self, user: dict):
        user_id = str(user["_id"])
        chats = await self.repos.chat_sessions.find({"user_id": user_id}, {"_id": 0}).to_list(length=1000)
        feedback = await self.repos.feedback.find({"user_id": user_id}, {"_id": 0}).to_list(length=1000)
        return {"user": {"id": user_id, "username": user["username"], "role": user["role"], "plan": user["plan"],
                          "policy_consent": user.get("policy_consent")}, "conversations": chats, "feedback": feedback}

    async def erase_data(self, user: dict, request):
        user_id = str(user["_id"])
        chats = await self.repos.chat_sessions.delete_many({"user_id": user_id})
        feedback = await self.repos.feedback.delete_many({"user_id": user_id})
        await self.audit.record("privacy.data_erased", "success", user, details={"conversations": chats.deleted_count,
                              "feedback": feedback.deleted_count}, request=request)
        return {"conversations_deleted": chats.deleted_count, "feedback_deleted": feedback.deleted_count}

    async def delete_account(self, user: dict, password: str, request):
        if not verify_password(password, user["password"]):
            raise AuthenticationError("Invalid password")
        if user["role"] == "admin" and await self.repos.users.count_documents({"role": "admin"}) <= 1:
            raise ValidationError("The last admin account cannot be deleted")
        await self.erase_data(user, request)
        await self.repos.sessions.delete_many({"user_id": str(user["_id"])})
        await self.repos.users.delete_one({"_id": user["_id"]})
        await self.audit.record("privacy.account_deleted", "success", user, target={"user_id": str(user["_id"])}, request=request)
        return {"ok": True}


class AdminService:
    def __init__(self, repos, settings, audit):
        self.repos, self.settings, self.audit = repos, settings, audit

    @staticmethod
    def safe_connection(connection: dict):
        return {"id": str(connection["_id"]), "name": connection["name"], "provider": connection["provider"],
                "model": connection["model"], "base_url": connection.get("base_url", ""),
                "api_version": connection.get("api_version", ""), "temperature": connection.get("temperature", 0.2),
                "max_tokens": connection.get("max_tokens", 1200), "api_key_hint": connection.get("api_key_hint", ""),
                "has_api_key": bool(connection.get("api_key_encrypted")), "plans": connection.get("plans", [])}

    async def list_connections(self):
        return [self.safe_connection(item) for item in await self.repos.connections.find().to_list(length=200)]

    async def save_connection(self, actor: dict, body, request, connection_id: str | None = None):
        existing = await self.repos.connections.find_one({"_id": ObjectId(connection_id)}) if connection_id else None
        if connection_id and not existing:
            raise NotFoundError("Connection not found")
        if body.provider == "azure_openai" and not body.base_url:
            raise ValidationError("A base URL is required for this provider")
        value = {"name": body.name.strip(), "provider": body.provider, "model": body.model.strip(),
                 "base_url": body.base_url.strip().rstrip("/"), "api_version": body.api_version.strip(),
                 "temperature": body.temperature, "max_tokens": body.max_tokens, "plans": body.plans}
        duplicate = await self.repos.connections.find_one({"name": value["name"]})
        if duplicate and (not existing or duplicate["_id"] != existing["_id"]):
            raise ValidationError("Connection name is already in use")
        key = body.api_key.strip()
        if key == "***" or body.remove_api_key:
            value.update(api_key_encrypted="", api_key_hint="")
        elif key:
            value.update(api_key_encrypted=encrypt_secret(self.settings.encryption_key, key), api_key_hint="****" + key[-4:])
        elif existing:
            value.update(api_key_encrypted=existing.get("api_key_encrypted", ""), api_key_hint=existing.get("api_key_hint", ""))
        elif body.provider != "mock":
            raise ValidationError("An API key is required for this provider")
        if body.provider == "mock":
            value.update(api_key_encrypted="", api_key_hint="")
        for plan in body.plans:
            await self.repos.connections.update_many({"plans": plan, **({"_id": {"$ne": existing["_id"]}} if existing else {})},
                                                     {"$pull": {"plans": plan}})
        if existing:
            await self.repos.connections.update_one({"_id": existing["_id"]}, {"$set": value})
            connection_id_value = str(existing["_id"])
            event = "admin.connection.updated"
        else:
            result = await self.repos.connections.insert_one(value)
            connection_id_value = str(result.inserted_id)
            event = "admin.connection.created"
        await self.audit.record(event, "success", actor, {"connection_id": connection_id_value},
                                details={"fields": ",".join(sorted(value.keys()))}, request=request)
        return await self.repos.connections.find_one({"_id": ObjectId(connection_id_value)})

    async def delete_connection(self, actor: dict, connection_id: str, request):
        connection = await self.repos.connections.find_one({"_id": ObjectId(connection_id)})
        if not connection:
            raise NotFoundError("Connection not found")
        if connection.get("plans"):
            raise ValidationError("Connection cannot be deleted while plans are assigned")
        await self.repos.connections.delete_one({"_id": connection["_id"]})
        await self.audit.record("admin.connection.deleted", "success", actor, {"connection_id": connection_id}, request=request)

    async def update_user(self, actor: dict, user_id: str, changes, request):
        try:
            target = await self.repos.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            target = None
        if not target:
            raise NotFoundError("User not found")
        update = changes.model_dump(exclude_none=True)
        if not update:
            return {"id": user_id, "username": target["username"], "role": target["role"], "plan": target["plan"]}
        if target["role"] == "admin" and update.get("role") == "user" and await self.repos.users.count_documents({"role": "admin"}) <= 1:
            raise ValidationError("The last admin cannot be demoted")
        await self.repos.users.update_one({"_id": target["_id"]}, {"$set": update})
        await self.audit.record("admin.user.updated", "success", actor, {"user_id": user_id},
                                details={key: f"{target.get(key)}->{value}" for key, value in update.items()}, request=request)
        return {"id": user_id, "username": target["username"], "role": update.get("role", target["role"]),
                "plan": update.get("plan", target["plan"])}

    async def audit_list(self, event: str = "", outcome: str = "", username: str = ""):
        query = {}
        if event:
            query["event"] = {"$regex": event, "$options": "i"}
        if outcome:
            query["outcome"] = outcome
        if username:
            query["actor.username"] = {"$regex": username, "$options": "i"}
        return await self.repos.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(length=500)
