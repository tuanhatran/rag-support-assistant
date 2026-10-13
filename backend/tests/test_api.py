from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.security import hash_password, hash_token
from app.vectorstore import FakeVectorStore
from tests.fakes import FakeDatabase


@pytest.fixture
def harness():
    database = FakeDatabase()
    database["llm_connections"].documents.append({
        "_id": "mock-connection", "name": "Built-in simulator", "provider": "mock",
        "model": "extractive-simulator", "base_url": "", "api_version": "",
        "temperature": 0, "max_tokens": 1200, "api_key_encrypted": "", "api_key_hint": "",
        "plans": ["basic", "standard", "premium"],
    })
    app = create_app(Settings(data_policy_version="current-policy"), database=database, initialize=False)
    with TestClient(app) as client:
        yield client, database


def register(client: TestClient, username: str = "casey"):
    return client.post("/api/auth/register", json={"username": username, "password": "correct horse battery", "plan": "standard", "policy_accepted": True})


def test_register_creates_salted_user_and_strict_session_cookie(harness):
    client, database = harness
    response = register(client)
    assert response.status_code == 201
    assert response.json()["policy_accepted"] is True
    assert response.json()["model"] == "extractive-simulator"
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api" in cookie
    user = database["users"].documents[0]
    assert user["password"]["algorithm"] == "scrypt"
    assert user["password"]["salt"]
    assert database["auth_sessions"].documents[0]["_id"] != client.cookies.get("rag-support-assistant")
    assert any(item["event"] == "privacy.policy_accepted" for item in database["audit_logs"].documents)


def test_logout_revokes_server_session(harness):
    client, database = harness
    assert register(client).status_code == 201
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert database["auth_sessions"].documents == []


def test_unknown_user_and_wrong_password_have_same_failure(harness):
    client, _ = harness
    assert register(client).status_code == 201
    client.post("/api/auth/logout")
    unknown = client.post("/api/auth/login", json={"username": "missing", "password": "incorrect password"})
    wrong = client.post("/api/auth/login", json={"username": "casey", "password": "incorrect password"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_expired_policy_is_reported_and_blocks_data_creation(harness):
    client, database = harness
    assert register(client).status_code == 201
    database["users"].documents[0]["policy_consent"]["version"] = "old-policy"
    assert client.get("/api/auth/me").json()["policy_accepted"] is False
    response = client.post("/api/chat/sessions")
    assert response.status_code == 409


def test_expired_session_cookie_is_rejected(harness):
    client, database = harness
    token = "expired-session-token"
    database["auth_sessions"].documents.append({"_id": hash_token(token), "user_id": "unknown-user",
        "expires_at": datetime(2000, 1, 1, tzinfo=timezone.utc)})
    client.cookies.set("rag-support-assistant", token)
    assert client.get("/api/auth/me").status_code == 401


def test_anonymous_user_cannot_access_admin_routes(harness):
    client, _ = harness
    assert client.get("/api/admin/connections").status_code == 401


def test_regular_user_is_denied_admin_routes_and_denial_is_audited(harness):
    client, database = harness
    assert register(client).status_code == 201
    response = client.get("/api/admin/connections")
    assert response.status_code == 403
    assert any(item["event"] == "auth.access_denied" for item in database["audit_logs"].documents)


def test_user_cannot_read_another_users_conversation(harness):
    client, _ = harness
    assert register(client, "first-user").status_code == 201
    created = client.post("/api/chat/sessions")
    assert created.status_code == 201
    session_id = created.json()["id"]
    assert register(client, "second-user").status_code == 201
    response = client.get(f"/api/chat/sessions/{session_id}")
    assert response.status_code == 404


def test_chat_redacts_question_before_storage_and_sets_expiry(harness):
    client, database = harness
    assert register(client).status_code == 201
    session = client.post("/api/chat/sessions").json()
    response = client.post(f"/api/chat/sessions/{session['id']}/messages",
        json={"question": "VPN stuck on connecting; password=hunter2"})
    assert response.status_code == 200
    message = response.json()
    assert message["redacted"] is True
    stored = database["chat_sessions"].documents[0]
    assert "hunter2" not in stored["messages"][0]["question"]
    assert "hunter2" not in stored["messages"][0]["answer"]
    assert stored["expires_at"] > datetime.now(timezone.utc)


def test_feedback_redacts_comment_and_sets_expiry(harness):
    client, database = harness
    assert register(client).status_code == 201
    session = client.post("/api/chat/sessions").json()
    message = client.post(f"/api/chat/sessions/{session['id']}/messages",
        json={"question": "VPN stuck on connecting"}).json()
    response = client.post("/api/feedback", json={"session_id": session["id"], "message_id": message["id"],
        "rating": "down", "categories": ["incomplete"], "comment": "token=secret-feedback-token"})
    assert response.status_code == 200
    stored = database["chat_feedback"].documents[0]
    assert "secret-feedback-token" not in stored["comment"]
    assert "[REDACTED]" in stored["comment"]
    assert stored["expires_at"] > datetime.now(timezone.utc)


def test_export_and_erase_are_scoped_to_the_current_user(harness):
    client, database = harness
    assert register(client, "first-user").status_code == 201
    first_session = client.post("/api/chat/sessions").json()
    assert register(client, "second-user").status_code == 201
    second_session = client.post("/api/chat/sessions").json()
    assert client.post("/api/auth/login", json={"username": "first-user", "password": "correct horse battery"}).status_code == 200
    exported = client.get("/api/privacy/data").json()
    assert [item["_id"] for item in exported["conversations"]] == [first_session["id"]]
    erased = client.delete("/api/privacy/data")
    assert erased.status_code == 200
    remaining = database["chat_sessions"].documents
    assert [item["_id"] for item in remaining] == [second_session["id"]]


def test_request_id_is_returned_and_invalid_value_is_replaced(harness):
    client, _ = harness
    accepted = client.get("/api/health", headers={"X-Request-ID": "support-ticket-123"})
    invalid = client.get("/api/health", headers={"X-Request-ID": "contains spaces"})
    assert accepted.headers["x-request-id"] == "support-ticket-123"
    assert invalid.headers["x-request-id"] != "contains spaces"
    assert len(invalid.headers["x-request-id"]) > 10


def test_unhandled_error_is_generic_and_carries_request_id(harness):
    client, _ = harness

    async def explode():
        raise RuntimeError("private-test-detail")

    client.app.add_api_route("/api/test-error", explode)
    response = client.get("/api/test-error", headers={"X-Request-ID": "test-error-123"})
    assert response.status_code == 500
    assert response.json() == {"error": "Internal server error", "request_id": "test-error-123"}
    assert "private-test-detail" not in response.text


def test_last_admin_cannot_be_deleted(harness):
    client, database = harness
    now = datetime.now(timezone.utc)
    database["users"].documents.append({"_id": ObjectId(), "username": "admin", "role": "admin", "plan": "premium",
        "password": hash_password("admin password long"), "policy_consent": {"version": "current-policy", "accepted_at": now}})
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin password long"})
    assert response.status_code == 200
    deleted = client.post("/api/privacy/account/delete", json={"password": "admin password long"})
    assert deleted.status_code == 409
    assert database["users"].documents[0]["username"] == "admin"


def test_last_admin_cannot_be_demoted(harness):
    client, database = harness
    admin_id = ObjectId()
    database["users"].documents.append({"_id": admin_id, "username": "admin", "role": "admin", "plan": "premium",
        "password": hash_password("admin password long"), "policy_consent": {"version": "current-policy", "accepted_at": datetime.now(timezone.utc)}})
    assert client.post("/api/auth/login", json={"username": "admin", "password": "admin password long"}).status_code == 200
    response = client.patch(f"/api/admin/users/{admin_id}", json={"role": "user"})
    assert response.status_code == 409
    assert next(item for item in database["users"].documents if item["_id"] == admin_id)["role"] == "admin"


def test_admin_can_create_and_test_keyless_local_ollama_connection(harness, monkeypatch):
    client, database = harness
    admin_id = ObjectId()
    database["users"].documents.append({"_id": admin_id, "username": "admin", "role": "admin", "plan": "premium",
        "password": hash_password("admin password long"),
        "policy_consent": {"version": "current-policy", "accepted_at": datetime.now(timezone.utc)}})
    assert client.post("/api/auth/login", json={"username": "admin", "password": "admin password long"}).status_code == 200

    response = client.post("/api/admin/connections", json={
        "name": "Local DeepSeek", "provider": "openai", "model": "deepseek-r1:14b",
        "base_url": "http://localhost:11434/v1", "api_key": "", "plans": ["premium"],
    })
    assert response.status_code == 201
    connection = response.json()
    assert connection["has_api_key"] is False
    assert "api_key_encrypted" not in connection

    edited = client.patch(f"/api/admin/connections/{connection['id']}", json={
        "name": "Local DeepSeek Updated", "provider": "openai", "model": "deepseek-r1:14b",
        "base_url": "http://localhost:11434/v1", "api_key": "", "plans": ["premium"],
    })
    assert edited.status_code == 200
    connection = edited.json()
    assert connection["has_api_key"] is False

    remote = client.post("/api/admin/connections", json={
        "name": "Remote OpenAI-compatible", "provider": "openai", "model": "remote-model",
        "base_url": "https://llm.example/v1", "api_key": "", "plans": ["basic"],
    })
    assert remote.status_code == 409

    from app.routers import admin as admin_router
    seen = {}

    async def fake_complete(connection, api_key, messages, timeout):
        seen["api_key"] = api_key
        seen["model"] = connection["model"]
        return "Connection confirmed"

    monkeypatch.setattr(admin_router, "complete", fake_complete)
    tested = client.post(f"/api/admin/connections/{connection['id']}/test")
    assert tested.status_code == 200
    assert tested.json() == {"ok": True, "message": "Connection confirmed"}
    assert seen == {"api_key": "", "model": "deepseek-r1:14b"}


def test_deepseek_r1_ollama_chat_streaming_returns_response_without_logging_sensitive_text(harness, monkeypatch, caplog):
    client, database = harness
    admin_id = ObjectId()
    database["users"].documents.append({"_id": admin_id, "username": "admin", "role": "admin", "plan": "premium",
        "password": hash_password("admin password long"),
        "policy_consent": {"version": "current-policy", "accepted_at": datetime.now(timezone.utc)}})
    assert client.post("/api/auth/login", json={"username": "admin", "password": "admin password long"}).status_code == 200
    configured = client.post("/api/admin/connections", json={
        "name": "Local DeepSeek", "provider": "openai", "model": "deepseek-r1:14b",
        "base_url": "http://localhost:11434/v1", "api_key": "", "plans": ["premium"],
    })
    assert configured.status_code == 201
    client.post("/api/auth/logout")

    registered = client.post("/api/auth/register", json={
        "username": "ollama-user", "password": "correct horse battery", "plan": "premium", "policy_accepted": True,
    })
    assert registered.status_code == 201
    assert registered.json()["model"] == "deepseek-r1:14b"
    from app import llm as llm_module
    from app import services as services_module
    called = {}
    upstream_events = (
        'data: {"choices":[{"delta":{"content":"Restart the VPN client and then "}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"reconnect; token=answer-secret-value"}}]}\n\n'
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
        'data: [DONE]\n\n'
    )

    def ollama_chat(request):
        called["url"] = str(request.url)
        called["authorization"] = request.headers.get("authorization")
        called["payload"] = json.loads(request.content)
        assert json.loads(request.content)["stream"] is True
        return httpx.Response(200, content=upstream_events, headers={"Content-Type": "text/event-stream"})

    async def mocked_ollama_stream(connection, api_key, messages, timeout):
        async for part in llm_module.stream_complete(connection, api_key, messages, timeout,
                                                      transport=httpx.MockTransport(ollama_chat)):
            yield part

    monkeypatch.setattr(services_module, "stream_complete", mocked_ollama_stream)
    caplog.set_level(logging.INFO, logger="app.chat")
    session = client.post("/api/chat/sessions").json()
    question = "VPN stuck on connecting; password=question-secret-value"
    response = client.post(f"/api/chat/sessions/{session['id']}/messages", json={"question": question})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = [item for item in response.text.strip().split("\n\n") if item]
    chunk_text = [json.loads(item.split("data: ", 1)[1])["text"] for item in events
                  if item.startswith("event: chunk\n")]
    completed = next(json.loads(item.split("data: ", 1)[1]) for item in events if item.startswith("event: done\n"))
    assert len(chunk_text) > 1
    assert "".join(chunk_text) == "Restart the VPN client and then reconnect; token=[REDACTED]"
    assert "answer-secret-value" not in response.text
    assert completed["answer"] == "Restart the VPN client and then reconnect; token=[REDACTED]"
    assert completed["model"]["model"] == "deepseek-r1:14b"
    assert completed["sources"]
    assert database["chat_sessions"].documents[0]["messages"][0]["answer"] == completed["answer"]
    assert called["url"] == "http://localhost:11434/v1/chat/completions"
    assert called["authorization"] is None
    assert called["payload"]["model"] == "deepseek-r1:14b"
    assert called["payload"]["stream"] is True
    assert called["payload"]["messages"][-1] == {"role": "user", "content": "VPN stuck on connecting; password=[REDACTED]"}
    invocation_logs = [record for record in caplog.records
                       if record.name == "app.chat" and record.getMessage() == "answer generated"]
    assert len(invocation_logs) == 1
    log_fields = vars(invocation_logs[0])["fields"]
    assert log_fields["model"] == "deepseek-r1:14b"
    assert log_fields["status"] == "ok"
    log_payload = repr(log_fields)
    sensitive_values = ("question-secret-value", "answer-secret-value", "VPN stuck on connecting")
    assert all(value not in log_payload for value in sensitive_values)
    assert all(value not in caplog.text for value in sensitive_values)


@pytest.mark.parametrize("upstream_body", [
    'data: {"choices":[{"delta":{"content":"This partial answer is long enough to stream before provider fails."}}]}\n\n'
    'data: {"error":{"message":"private-provider-error-secret"}}\n\n',
    'data: {"choices":[{"delta":{"content":"This partial answer is long enough to stream before provider disconnects."}}]}\n\n',
])
def test_ollama_streaming_failure_does_not_persist_partial_answer(harness, monkeypatch, caplog, upstream_body):
    client, database = harness
    admin_id = ObjectId()
    database["users"].documents.append({"_id": admin_id, "username": "admin", "role": "admin", "plan": "premium",
        "password": hash_password("admin password long"),
        "policy_consent": {"version": "current-policy", "accepted_at": datetime.now(timezone.utc)}})
    assert client.post("/api/auth/login", json={"username": "admin", "password": "admin password long"}).status_code == 200
    configured = client.post("/api/admin/connections", json={
        "name": "Local Ollama", "provider": "openai", "model": "configured-model",
        "base_url": "http://localhost:11434/v1", "api_key": "", "plans": ["premium"],
    })
    assert configured.status_code == 201
    client.post("/api/auth/logout")
    assert client.post("/api/auth/register", json={
        "username": "stream-user", "password": "correct horse battery", "plan": "premium", "policy_accepted": True,
    }).status_code == 201

    from app import llm as llm_module
    from app import services as services_module

    def upstream(request):
        assert json.loads(request.content)["stream"] is True
        return httpx.Response(200, content=upstream_body, headers={"Content-Type": "text/event-stream"})

    async def mocked_stream(connection, api_key, messages, timeout):
        async for part in llm_module.stream_complete(connection, api_key, messages, timeout,
                                                      transport=httpx.MockTransport(upstream)):
            yield part

    monkeypatch.setattr(services_module, "stream_complete", mocked_stream)
    caplog.set_level(logging.INFO, logger="app.chat")
    session = client.post("/api/chat/sessions").json()
    response = client.post(f"/api/chat/sessions/{session['id']}/messages", json={"question": "Where is the VPN guide?"})

    assert response.status_code == 200
    assert 'event: chunk' in response.text
    assert 'event: error' in response.text
    assert "The configured model could not answer this request." in response.text
    assert "private-provider-error-secret" not in response.text
    assert database["chat_sessions"].documents[0]["messages"] == []
    assert "private-provider-error-secret" not in caplog.text


@pytest.mark.anyio
async def test_ollama_streaming_cancellation_does_not_persist_partial_answer(harness, monkeypatch):
    client, database = harness
    assert register(client).status_code == 201
    session = client.post("/api/chat/sessions").json()
    user = database["users"].documents[0]
    connection = {"_id": "local-ollama", "name": "Local Ollama", "provider": "openai",
                  "model": "configured-model", "api_key_encrypted": ""}
    from app import services as services_module

    async def cancelled_stream(*args, **kwargs):
        yield "This partial answer is long enough to stream before cancellation."
        raise asyncio.CancelledError()

    monkeypatch.setattr(services_module, "stream_complete", cancelled_stream)
    stream = await client.app.state.container.chat.ask_streaming(
        user, session["id"], "Where is the VPN guide?", connection,
    )

    assert (await anext(stream))[0] == "chunk"
    with pytest.raises(asyncio.CancelledError):
        await anext(stream)
    assert database["chat_sessions"].documents[0]["messages"] == []


def test_chat_hybrid_retrieval_includes_redacted_active_chunk_and_attribution(harness, monkeypatch):
    client, database = harness
    assert register(client).status_code == 201
    container = client.app.state.container
    vectorstore = FakeVectorStore()
    container.chat.vectorstore = vectorstore
    pipeline_id = ObjectId()
    expires_at = datetime.now(timezone.utc) + timedelta(days=20)
    database["ingestion_pipelines"].documents.append({
        "_id": pipeline_id, "filename": "Network repair.txt", "expires_at": expires_at,
    })
    vectorstore.chunks.extend([
        {"id": f"{pipeline_id}:0", "pipeline_id": str(pipeline_id), "chunk_index": 0,
         "content": "Stored redacted guidance for edge-router recovery.",
         "model": "@cf/baai/bge-small-en-v1.5", "embedding": [0.1] * 384, "expires_at": expires_at},
        {"id": "expired:0", "pipeline_id": str(ObjectId()), "chunk_index": 0,
         "content": "Expired private chunk must stay hidden.",
         "model": "@cf/baai/bge-small-en-v1.5", "embedding": [0.1] * 384,
         "expires_at": datetime.now(timezone.utc) - timedelta(days=1)},
    ])

    class TestEmbeddingProvider:
        async def embed(self, texts):
            assert len(texts) == 1
            return [[0.1] * 384]

    container.chat.embedding_provider_factory = lambda model, settings: TestEmbeddingProvider()
    connection = database["llm_connections"].documents[0]
    connection.update({"provider": "openai", "model": "test-model", "base_url": "https://llm.example/v1",
                       "api_key_encrypted": "test-encrypted-key"})
    captured = {}

    async def fake_complete(connection, api_key, messages, timeout):
        captured["messages"] = messages
        return "Grounded response"

    from app import services as services_module
    monkeypatch.setattr(services_module, "decrypt_secret", lambda key, value: "test-api-key")
    monkeypatch.setattr(services_module, "complete", fake_complete)
    session = client.post("/api/chat/sessions").json()
    response = client.post(f"/api/chat/sessions/{session['id']}/messages", json={"question": "VPN stuck on connecting"})

    assert response.status_code == 200
    sources = response.json()["sources"]
    ingested = next(source for source in sources if source["source_type"] == "ingested")
    assert ingested["document_title"] == "Network repair.txt"
    assert ingested["pipeline_id"] == str(pipeline_id)
    assert ingested["chunk_index"] == 0
    assert "text" not in ingested
    assert any(source["source_type"] == "bundled" for source in sources)
    assert "Stored redacted guidance for edge-router recovery." in captured["messages"][0]["content"]
    assert "Expired private chunk must stay hidden." not in captured["messages"][0]["content"]


def test_chat_falls_back_to_bm25_when_query_embedding_fails(harness):
    client, _ = harness
    assert register(client).status_code == 201
    container = client.app.state.container
    vectorstore = FakeVectorStore()
    container.chat.vectorstore = vectorstore
    vectorstore.chunks.append({
        "id": "active:0", "pipeline_id": str(ObjectId()), "chunk_index": 0,
        "content": "Unavailable embedding path content.", "model": "@cf/baai/bge-small-en-v1.5",
        "embedding": [0.1] * 384, "expires_at": datetime.now(timezone.utc) + timedelta(days=2),
    })

    class FailedEmbeddingProvider:
        async def embed(self, texts):
            raise RuntimeError("provider unavailable")

    container.chat.embedding_provider_factory = lambda model, settings: FailedEmbeddingProvider()
    session = client.post("/api/chat/sessions").json()
    response = client.post(f"/api/chat/sessions/{session['id']}/messages", json={"question": "VPN stuck on connecting"})

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["sources"]
    assert all(source["source_type"] == "bundled" for source in response.json()["sources"])