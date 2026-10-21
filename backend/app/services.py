from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from app.embeddings import validate_embedding_dimensions
from app.errors import AuthenticationError, ConfigurationError, NotFoundError, ValidationError
from app.llm import build_messages, complete, is_keyless_ollama, mock_answer, stream_complete
from app.observability import log_event
from app.redaction import redact
from app.repositories import parse_object_id, utcnow
from app.security import decrypt_secret, encrypt_secret, hash_password, hash_token, new_session_token, verify_password


DUMMY_PASSWORD_HASH = hash_password("timing-safe-dummy-password")


PLANS = [
    {"id": "basic", "description": "Essential troubleshooting help"},
    {"id": "standard", "description": "A more capable model for everyday support"},
    {"id": "premium", "description": "The most capable model for complex incidents"},
]


def public_user(user: dict, connection: dict | None = None) -> dict:
    consent = user.get("policy_consent", {})
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "role": user["role"],
        "plan": user["plan"],
        "model": connection.get("model") if connection else None,
        "policy_version": consent.get("version"),
        "policy_accepted": bool(consent.get("accepted_at") and consent.get("version")),
    }


class AuthService:
    def __init__(self, repos, settings, audit):
        self.repos = repos
        self.settings = settings
        self.audit = audit

    async def register(self, body, request):
        if not body.policy_accepted:
            raise ValidationError("You must accept the data policy")
        username = body.username.strip().lower()
        if await self.repos.get_user_by_username(username):
            raise ValidationError("Username is already registered")
        now = utcnow()
        user = {
            "username": username,
            "password": hash_password(body.password),
            "role": "user",
            "plan": body.plan,
            "policy_consent": {"version": self.settings.data_policy_version, "accepted_at": now},
            "created_at": now,
        }
        try:
            user["_id"] = await self.repos.insert_user(user)
        except DuplicateKeyError as exc:
            raise ValidationError("Username is already registered") from exc
        await self.audit.record("auth.register", "success", user, {"user_id": str(user["_id"])}, request=request)
        await self.audit.record(
            "privacy.policy_accepted",
            "success",
            user,
            details={"version": self.settings.data_policy_version},
            request=request,
        )
        return user

    async def login(self, username: str, password: str, request):
        user = await self.repos.get_user_by_username(username.strip().lower())
        valid_password = verify_password(password, user["password"] if user else DUMMY_PASSWORD_HASH)
        if not valid_password:
            await self.audit.record(
                "auth.login", "failure", None, {"username": username.strip().lower()}, request=request
            )
            raise AuthenticationError("Invalid username or password")
        token = new_session_token()
        await self.repos.insert_session({
            "_id": hash_token(token),
            "user_id": str(user["_id"]),
            "expires_at": utcnow() + timedelta(hours=self.settings.session_ttl_hours),
        })
        await self.audit.record("auth.login", "success", user, request=request)
        return user, token

    async def logout(self, user: dict, token: str | None, request):
        if token:
            await self.repos.delete_session(hash_token(token))
        await self.audit.record("auth.logout", "success", user, request=request)

    async def connection_for_plan(self, plan: str):
        connection = await self.repos.find_connection_for_plan(plan)
        if not connection:
            raise ConfigurationError(f"No model is assigned to the {plan} plan")
        return connection

    async def plans(self) -> list[dict]:
        output = []
        for plan_info in PLANS:
            connection = await self.repos.find_connection_for_plan(plan_info["id"])
            output.append({
                **plan_info,
                "model": connection.get("model") if connection else None,
                "connection": connection.get("name") if connection else None,
            })
        return output

    async def me(self, user: dict):
        result = public_user(user, await self.connection_for_plan(user["plan"]))
        result["policy_accepted"] = (
            result["policy_accepted"] and result["policy_version"] == self.settings.data_policy_version
        )
        return result


class ChatService:
    def __init__(self, repos, settings, knowledge, audit, vectorstore=None, embedding_provider_factory=None):
        self.repos = repos
        self.settings = settings
        self.knowledge = knowledge
        self.audit = audit
        self.vectorstore = vectorstore
        self.embedding_provider_factory = embedding_provider_factory

    @staticmethod
    def _source_identity(source: dict) -> tuple[str, str, str]:
        source_type = source.get("source_type", "bundled")
        if source_type == "ingested":
            return source_type, str(source.get("pipeline_id", "")), str(source.get("chunk_index", ""))
        return source_type, str(source.get("document_id", "")), str(source.get("section", ""))

    @classmethod
    def _merge_ranked_sources(cls, ranked_lists: list[list[dict]], top_k: int) -> list[dict]:
        candidates: dict[tuple[str, str, str], dict] = {}
        for ranked in ranked_lists:
            seen = set()
            for rank, source in enumerate(ranked, start=1):
                source = dict(source)
                source.setdefault("source_type", "bundled")
                identity = cls._source_identity(source)
                if identity in seen:
                    continue
                seen.add(identity)
                item = candidates.setdefault(identity, {"source": source, "rank_score": 0.0})
                item["rank_score"] += 1 / (60 + rank)

        ordered = sorted(candidates.items(), key=lambda item: (-item[1]["rank_score"], item[0]))
        results = []
        seen_text = set()
        for _, item in ordered:
            source = item["source"]
            normalized_text = " ".join(source.get("text", "").split()).casefold()
            if normalized_text and normalized_text in seen_text:
                continue
            if normalized_text:
                seen_text.add(normalized_text)
            results.append(source)
            if len(results) >= top_k:
                break
        return results

    async def _ingested_sources(self, chunks: list[dict]) -> list[dict]:
        sources = []
        pipelines = {}
        for chunk in chunks:
            pipeline_id = str(chunk.get("pipeline_id", ""))
            if pipeline_id not in pipelines:
                pipeline_oid = parse_object_id(pipeline_id)
                pipelines[pipeline_id] = (
                    await self.repos.get_active_pipeline(pipeline_oid) if pipeline_oid else None
                )
            pipeline = pipelines[pipeline_id]
            if not pipeline:
                continue
            content = redact(chunk.get("content", ""))
            sources.append({
                "document_title": redact(pipeline.get("filename") or "Ingested document"),
                "category": "Ingested document",
                "section": f"Chunk {int(chunk.get('chunk_index', 0)) + 1}",
                "score": round(float(chunk.get("similarity", 0)), 5),
                "excerpt": content[:200],
                "text": content,
                "source_type": "ingested",
                "pipeline_id": pipeline_id,
                "chunk_index": int(chunk.get("chunk_index", 0)),
            })
        return sources

    async def _hybrid_sources(self, question: str) -> list[dict]:
        top_k = self.settings.retrieval_top_k
        ranked_lists = [[
            {**source, "source_type": "bundled"} for source in self.knowledge.search(question, top_k)
        ]]
        if self.vectorstore is None or self.embedding_provider_factory is None:
            return self._merge_ranked_sources(ranked_lists, top_k)
        logger = logging.getLogger("app.chat")
        try:
            models = await self.vectorstore.list_embedding_models()
        except Exception as exc:
            logger.warning("embedding model lookup failed", extra={"fields": {"error_type": type(exc).__name__}})
            return self._merge_ranked_sources(ranked_lists, top_k)
        for model in models:
            try:
                provider = self.embedding_provider_factory(model, self.settings)
                vectors = await provider.embed([question])
                validate_embedding_dimensions(model, vectors, expected_count=1)
                chunks = await self.vectorstore.search_chunks(vectors[0], model, top_k)
                ingested = await self._ingested_sources(chunks)
                if ingested:
                    ranked_lists.append(ingested)
            except Exception as exc:
                logger.warning(
                    "hybrid retrieval failed",
                    extra={"fields": {"error_type": type(exc).__name__}},
                )
                continue
        return self._merge_ranked_sources(ranked_lists, top_k)

    async def create_session(self, user: dict):
        now = utcnow()
        session = {
            "_id": str(uuid.uuid4()),
            "user_id": str(user["_id"]),
            "title": "New conversation",
            "messages": [],
            "created_at": now,
            "updated_at": now,
            "expires_at": now + timedelta(days=self.settings.conversation_retention_days),
        }
        await self.repos.insert_chat_session(session)
        return self.serialize_session(session, include_messages=False)

    async def list_sessions(self, user: dict) -> list[dict]:
        sessions = await self.repos.list_user_sessions(str(user["_id"]))
        return [self.serialize_session(item, include_messages=False) for item in sessions]

    async def get_session(self, user: dict, session_id: str) -> dict:
        session = await self.repos.get_chat(session_id, str(user["_id"]))
        if not session:
            raise NotFoundError("Conversation not found")
        return self.serialize_session(session)

    async def delete_session(self, user: dict, session_id: str, request) -> dict:
        deleted = await self.repos.delete_chat(session_id, str(user["_id"]))
        if not deleted:
            raise NotFoundError("Conversation not found")
        await self.repos.delete_feedback_for_session(session_id, str(user["_id"]))
        await self.audit.record(
            "chat.session.deleted", "success", user, {"session_id": session_id}, request=request
        )
        return {"ok": True}

    @staticmethod
    def serialize_session(session: dict, include_messages: bool = True) -> dict:
        result = {
            "id": str(session["_id"]),
            "title": session["title"],
            "created_at": session["created_at"],
            "updated_at": session["updated_at"],
        }
        if include_messages:
            result["messages"] = session.get("messages", [])
        return result

    async def _connection_for_plan(self, plan: str) -> dict:
        connection = await self.repos.find_connection_for_plan(plan)
        if not connection:
            raise ConfigurationError(f"No model is assigned to the {plan} plan")
        return connection

    async def _prepare_answer(self, user: dict, session_id: str, question: str, connection: dict | None = None):
        session = await self.repos.get_chat(session_id, str(user["_id"]))
        if not session:
            raise NotFoundError("Conversation not found")
        safe_question = redact(question)
        sources = await self._hybrid_sources(safe_question)
        connection = connection or await self._connection_for_plan(user["plan"])
        history = [
            item for item in session.get("messages", []) if item.get("status") == "ok"
        ][-self.settings.history_turns:]
        messages = build_messages(safe_question, sources, history)
        return {
            "session": session,
            "safe_question": safe_question,
            "sources": sources,
            "connection": connection,
            "messages": messages,
            "message_id": str(uuid.uuid4()),
            "started": time.perf_counter(),
            "user": user,
        }

    async def _save_answer(self, prepared: dict, answer: str, status: str = "ok"):
        user = prepared["user"]
        session = prepared["session"]
        safe_question = prepared["safe_question"]
        sources = prepared["sources"]
        connection = prepared["connection"]
        latency = round((time.perf_counter() - prepared["started"]) * 1000)
        stored_sources = [{key: value for key, value in source.items() if key != "text"} for source in sources]
        message = {
            "id": prepared["message_id"],
            "question": safe_question,
            "answer": answer,
            "status": status,
            "sources": stored_sources,
            "model": {
                "connection_id": str(connection["_id"]),
                "name": connection["name"],
                "provider": connection["provider"],
                "model": connection["model"],
            },
            "latency_ms": latency,
            "redacted": safe_question != prepared["original_question"],
            "created_at": utcnow(),
        }
        title = safe_question[:60].strip() or "New conversation"
        await self.repos.append_message(
            str(session["_id"]),
            str(user["_id"]),
            message,
            title if not session.get("messages") else session["title"],
            utcnow(),
            utcnow() + timedelta(days=self.settings.conversation_retention_days),
        )
        log_event(
            logging.getLogger("app.chat"),
            "answer generated",
            connection=connection["name"],
            model=connection["model"],
            status=status,
            latency_ms=latency,
            source_count=len(sources),
        )
        return message

    async def ask(self, user: dict, session_id: str, question: str, connection: dict | None = None):
        prepared = await self._prepare_answer(user, session_id, question, connection)
        prepared["original_question"] = question
        status = "ok"
        if prepared["connection"]["provider"] == "mock":
            answer = mock_answer(prepared["sources"])
        else:
            try:
                encrypted_key = prepared["connection"].get("api_key_encrypted", "")
                key = decrypt_secret(self.settings.encryption_key, encrypted_key) if encrypted_key else ""
                answer = await complete(
                    prepared["connection"], key, prepared["messages"], self.settings.llm_timeout_seconds
                )
                answer = redact(answer)
            except Exception as exc:
                status = "error"
                answer = (
                    f"The configured model could not answer this request ({type(exc).__name__}). "
                    "Please try again or open a support ticket."
                )
        return await self._save_answer(prepared, answer, status)

    async def ask_streaming(self, user: dict, session_id: str, question: str, connection: dict):
        prepared = await self._prepare_answer(user, session_id, question, connection)
        prepared["original_question"] = question
        encrypted_key = connection.get("api_key_encrypted", "")
        key = decrypt_secret(self.settings.encryption_key, encrypted_key) if encrypted_key else ""
        return self._stream_answer(prepared, key)

    async def _stream_answer(self, prepared: dict, api_key: str):
        connection = prepared["connection"]
        raw_parts = []
        redactor = _StreamingAnswerRedactor()
        try:
            async for part in stream_complete(
                connection, api_key, prepared["messages"], self.settings.llm_timeout_seconds
            ):
                raw_parts.append(part)
                safe_part = redactor.feed(part)
                if safe_part:
                    yield "chunk", {"text": safe_part}
            tail = redactor.finish()
            if tail:
                yield "chunk", {"text": tail}
            message = await self._save_answer(prepared, redact("".join(raw_parts)))
            yield "done", message
        except asyncio.CancelledError:
            log_event(
                logging.getLogger("app.chat"),
                "answer stream disconnected",
                connection=connection["name"],
                model=connection["model"],
                status="disconnected",
                latency_ms=round((time.perf_counter() - prepared["started"]) * 1000),
            )
            raise
        except Exception as exc:
            log_event(
                logging.getLogger("app.chat"),
                "answer stream failed",
                connection=connection["name"],
                model=connection["model"],
                status="error",
                error_type=type(exc).__name__,
                latency_ms=round((time.perf_counter() - prepared["started"]) * 1000),
            )
            yield "error", {
                "message": "The configured model could not answer this request. "
                "Please try again or open a support ticket."
            }


class _StreamingAnswerRedactor:
    _private_key_start = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
    _private_key_end = re.compile(r"-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")

    def __init__(self):
        self.pending = ""

    def feed(self, text: str) -> str:
        self.pending += text
        tokens = list(re.finditer(r"\S+", self.pending))
        if len(tokens) <= 4:
            return ""
        cutoff = tokens[-4].start()
        key_start = self._private_key_start.search(self.pending)
        if key_start and not self._private_key_end.search(self.pending, key_start.end()):
            cutoff = min(cutoff, key_start.start())
        safe = redact(self.pending[:cutoff])
        self.pending = self.pending[cutoff:]
        return safe

    def finish(self) -> str:
        safe = redact(self.pending)
        self.pending = ""
        return safe


class FeedbackService:
    def __init__(self, repos, settings, audit):
        self.repos = repos
        self.settings = settings
        self.audit = audit

    async def submit(self, user: dict, body):
        session = await self.repos.get_chat(body.session_id, str(user["_id"]))
        message = (
            next((item for item in session.get("messages", []) if item["id"] == body.message_id), None)
            if session
            else None
        )
        if not message:
            raise NotFoundError("Answer not found")
        document = {
            "session_id": body.session_id,
            "message_id": body.message_id,
            "user_id": str(user["_id"]),
            "username": user["username"],
            "rating": body.rating,
            "categories": body.categories,
            "comment": redact(body.comment),
            "question": message["question"],
            "answer": redact(message["answer"]),
            "model": message["model"],
            "created_at": utcnow(),
            "expires_at": utcnow() + timedelta(days=self.settings.feedback_retention_days),
        }
        await self.repos.upsert_feedback(document)
        return {"ok": True}


class PrivacyService:
    def __init__(self, repos, settings, audit):
        self.repos = repos
        self.settings = settings
        self.audit = audit

    def policy(self):
        return {
            "version": self.settings.data_policy_version,
            "title": "RAG Support Assistant data policy",
            "retention": {
                "conversations": self.settings.conversation_retention_days,
                "feedback": self.settings.feedback_retention_days,
                "audit": self.settings.audit_retention_days,
            },
            "sections": [
                {
                    "heading": "What we store",
                    "text": "Questions, grounded answers, sources, model metadata, feedback, and security "
                    "audit events. Potential secrets are redacted before model calls and storage.",
                },
                {
                    "heading": "Retention",
                    "text": f"Conversations are kept for {self.settings.conversation_retention_days} days "
                    f"after the latest message. Feedback is kept for {self.settings.feedback_retention_days} "
                    f"days. Audit events are kept for {self.settings.audit_retention_days} days.",
                },
                {
                    "heading": "Your choices",
                    "text": "You can export your data, erase conversations and feedback, or delete your account. "
                    "Audit records remain until their retention expires.",
                },
            ],
        }

    async def consent(self, user: dict, accepted: bool, request):
        if not accepted:
            raise ValidationError("Consent must be accepted to continue")
        now = utcnow()
        await self.repos.update_user(
            user["_id"],
            {"policy_consent": {"version": self.settings.data_policy_version, "accepted_at": now}},
        )
        await self.audit.record(
            "privacy.policy_accepted",
            "success",
            user,
            details={"version": self.settings.data_policy_version},
            request=request,
        )
        user["policy_consent"] = {"version": self.settings.data_policy_version, "accepted_at": now}
        return {"policy_version": self.settings.data_policy_version, "policy_accepted": True}

    async def export_data(self, user: dict, request):
        user_id = str(user["_id"])
        chats = await self.repos.export_chat_sessions(user_id)
        feedback = await self.repos.export_feedback(user_id)
        await self.audit.record("privacy.data_exported", "success", user, request=request)
        return {
            "user": {
                "id": user_id,
                "username": user["username"],
                "role": user["role"],
                "plan": user["plan"],
                "policy_consent": user.get("policy_consent"),
            },
            "conversations": chats,
            "feedback": feedback,
        }

    async def erase_data(self, user: dict, request):
        user_id = str(user["_id"])
        conversations = await self.repos.delete_user_chat_sessions(user_id)
        feedback = await self.repos.delete_user_feedback(user_id)
        await self.audit.record(
            "privacy.data_erased",
            "success",
            user,
            details={"conversations": conversations, "feedback": feedback},
            request=request,
        )
        return {"conversations_deleted": conversations, "feedback_deleted": feedback}

    async def delete_account(self, user: dict, password: str, request):
        if not verify_password(password, user["password"]):
            raise AuthenticationError("Invalid password")
        if user["role"] == "admin" and await self.repos.count_admins() <= 1:
            raise ValidationError("The last admin account cannot be deleted")
        await self.erase_data(user, request)
        await self.repos.delete_sessions_for_user(str(user["_id"]))
        await self.repos.delete_user(user["_id"])
        await self.audit.record(
            "privacy.account_deleted", "success", user, target={"user_id": str(user["_id"])}, request=request
        )
        return {"ok": True}


class AdminService:
    def __init__(self, repos, settings, audit):
        self.repos = repos
        self.settings = settings
        self.audit = audit

    @staticmethod
    def safe_connection(connection: dict):
        return {
            "id": str(connection["_id"]),
            "name": connection["name"],
            "provider": connection["provider"],
            "model": connection["model"],
            "base_url": connection.get("base_url", ""),
            "api_version": connection.get("api_version", ""),
            "temperature": connection.get("temperature", 0.2),
            "max_tokens": connection.get("max_tokens", 1200),
            "api_key_hint": connection.get("api_key_hint", ""),
            "has_api_key": bool(connection.get("api_key_encrypted")),
            "plans": connection.get("plans", []),
        }

    async def list_connections(self):
        return [self.safe_connection(item) for item in await self.repos.list_connections()]

    async def save_connection(self, actor: dict, body, request, connection_id: str | None = None):
        existing = await self.repos.get_connection(connection_id) if connection_id else None
        if connection_id and not existing:
            raise NotFoundError("Connection not found")
        if body.provider == "azure_openai" and not body.base_url:
            raise ValidationError("A base URL is required for this provider")
        value = {
            "name": body.name.strip(),
            "provider": body.provider,
            "model": body.model.strip(),
            "base_url": body.base_url.strip().rstrip("/"),
            "api_version": body.api_version.strip(),
            "temperature": body.temperature,
            "max_tokens": body.max_tokens,
            "plans": body.plans,
        }
        duplicate = await self.repos.get_connection_by_name(value["name"])
        if duplicate and (not existing or duplicate["_id"] != existing["_id"]):
            raise ValidationError("Connection name is already in use")
        key = body.api_key.strip()
        if key == "***" or body.remove_api_key:
            value.update(api_key_encrypted="", api_key_hint="")
        elif key:
            value.update(
                api_key_encrypted=encrypt_secret(self.settings.encryption_key, key),
                api_key_hint="****" + key[-4:],
            )
        elif existing:
            value.update(
                api_key_encrypted=existing.get("api_key_encrypted", ""),
                api_key_hint=existing.get("api_key_hint", ""),
            )
        if body.provider == "mock":
            value.update(api_key_encrypted="", api_key_hint="")
        elif not value.get("api_key_encrypted") and not is_keyless_ollama(value):
            raise ValidationError("An API key is required for this provider")

        if existing:
            await self.repos.update_connection(existing["_id"], value)
            connection_oid = existing["_id"]
            event = "admin.connection.updated"
        else:
            connection_oid = await self.repos.insert_connection(value)
            event = "admin.connection.created"
        for plan in body.plans:
            await self.repos.unassign_plan_from_others(plan, connection_oid)
        await self.audit.record(
            event,
            "success",
            actor,
            {"connection_id": str(connection_oid)},
            details={"fields": ",".join(sorted(value.keys()))},
            request=request,
        )
        return await self.repos.get_connection(connection_oid)

    async def test_connection(self, actor: dict, connection_id: str, request):
        connection = await self.repos.get_connection(connection_id)
        if not connection:
            raise NotFoundError("Connection not found")
        try:
            if connection["provider"] == "mock":
                answer = mock_answer([])
            else:
                encrypted_key = connection.get("api_key_encrypted", "")
                api_key = decrypt_secret(self.settings.encryption_key, encrypted_key) if encrypted_key else ""
                answer = await complete(
                    connection,
                    api_key,
                    [
                        {"role": "system", "content": "Reply with a brief connection test confirmation."},
                        {"role": "user", "content": "Connection test"},
                    ],
                    self.settings.llm_timeout_seconds,
                )
            outcome = "success"
            result = {"ok": True, "message": answer[:240]}
        except Exception as exc:
            outcome = "failure"
            result = {"ok": False, "message": f"Connection test failed ({type(exc).__name__})"}
        await self.audit.record(
            "admin.connection.tested",
            outcome,
            actor,
            {"connection_id": connection_id},
            details={"provider": connection["provider"], "model": connection["model"]},
            request=request,
        )
        return result

    async def delete_connection(self, actor: dict, connection_id: str, request):
        connection = await self.repos.get_connection(connection_id)
        if not connection:
            raise NotFoundError("Connection not found")
        if connection.get("plans"):
            raise ValidationError("Connection cannot be deleted while plans are assigned")
        await self.repos.delete_connection(connection["_id"])
        await self.audit.record(
            "admin.connection.deleted", "success", actor, {"connection_id": connection_id}, request=request
        )

    async def list_users(self) -> list[dict]:
        records = await self.repos.list_users()
        return [
            {
                "id": str(item["_id"]),
                "username": item["username"],
                "role": item["role"],
                "plan": item["plan"],
                "created_at": item.get("created_at"),
            }
            for item in records
        ]

    async def update_user(self, actor: dict, user_id: str, changes, request):
        target = await self.repos.get_user(user_id)
        if not target:
            raise NotFoundError("User not found")
        update = changes.model_dump(exclude_none=True)
        if not update:
            return {"id": user_id, "username": target["username"], "role": target["role"], "plan": target["plan"]}
        if (
            target["role"] == "admin"
            and update.get("role") == "user"
            and await self.repos.count_admins() <= 1
        ):
            raise ValidationError("The last admin cannot be demoted")
        await self.repos.update_user(target["_id"], update)
        await self.audit.record(
            "admin.user.updated",
            "success",
            actor,
            {"user_id": user_id},
            details={key: f"{target.get(key)}->{value}" for key, value in update.items()},
            request=request,
        )
        return {
            "id": user_id,
            "username": target["username"],
            "role": update.get("role", target["role"]),
            "plan": update.get("plan", target["plan"]),
        }

    async def list_feedback(self, rating: str = "") -> list[dict]:
        return await self.repos.list_feedback(rating)

    async def feedback_stats(self) -> dict:
        ratings = await self.repos.list_feedback_ratings()
        total = len(ratings)
        helpful = sum(rating == "up" for rating in ratings)
        return {
            "total": total,
            "helpful": helpful,
            "not_helpful": total - helpful,
            "satisfaction_percent": round(helpful / total * 100) if total else 0,
        }

    async def audit_list(self, event: str = "", outcome: str = "", username: str = "") -> list[dict]:
        return await self.repos.list_audit(event, outcome, username)
