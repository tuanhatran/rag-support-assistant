from __future__ import annotations

from datetime import timedelta

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from app.audit import AuditService
from app.config import Settings
from app.main import create_app
from app.repositories import Repositories, utcnow
from app.security import hash_password, hash_token
from tests.fakes import FakeDatabase

COOKIE = "rag-support-assistant"
CONNECTION = {
    "name": "New connection",
    "provider": "mock",
    "model": "extractive-simulator",
    "plans": [],
}


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


def add_admin(database: FakeDatabase) -> str:
    user_id = ObjectId()
    database["users"].documents.append({
        "_id": user_id,
        "username": "admin",
        "password": hash_password("admin password long"),
        "role": "admin",
        "plan": "premium",
        "policy_consent": {"version": "current-policy", "accepted_at": utcnow()},
        "created_at": utcnow(),
    })
    token = "admin-session-token"
    database["auth_sessions"].documents.append({
        "_id": hash_token(token),
        "user_id": str(user_id),
        "expires_at": utcnow() + timedelta(hours=2),
    })
    return token


def test_invalid_connection_id_returns_404_not_500(harness):
    client, database = harness
    client.cookies.set(COOKIE, add_admin(database))

    patched = client.patch("/api/admin/connections/not-an-object-id", json=CONNECTION)
    deleted = client.delete("/api/admin/connections/not-an-object-id")

    assert patched.status_code == 404
    assert deleted.status_code == 404


def test_invalid_user_id_returns_404_not_500(harness):
    client, database = harness
    client.cookies.set(COOKIE, add_admin(database))

    response = client.patch("/api/admin/users/not-an-object-id", json={"role": "user"})

    assert response.status_code == 404


def test_duplicate_registration_race_returns_409(harness, monkeypatch):
    client, database = harness

    async def duplicate_insert(document):
        raise DuplicateKeyError("duplicate username")

    monkeypatch.setattr(database["users"], "insert_one", duplicate_insert)
    response = client.post("/api/auth/register", json={
        "username": "casey",
        "password": "correct horse battery",
        "plan": "standard",
        "policy_accepted": True,
    })

    assert response.status_code == 409
    assert response.json()["detail"] == "Username is already registered"


def test_audit_filters_escape_regex_metacharacters(harness):
    client, database = harness
    client.cookies.set(COOKIE, add_admin(database))
    database["audit_logs"].documents.append({
        "timestamp": utcnow(), "event": "auth.login", "outcome": "success",
        "actor": {"user_id": "someone", "username": "someone"}, "target": None,
        "details": {}, "expires_at": utcnow() + timedelta(days=1),
    })

    response = client.get("/api/admin/audit", params={"event": "(", "username": ".*"})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize("field", ["name", "model"])
def test_blank_connection_fields_are_rejected(harness, field):
    client, database = harness
    client.cookies.set(COOKIE, add_admin(database))

    response = client.post("/api/admin/connections", json={**CONNECTION, field: "   "})

    assert response.status_code == 422


def test_failed_connection_write_keeps_existing_plan_assignment(harness, monkeypatch):
    client, database = harness
    client.cookies.set(COOKIE, add_admin(database))
    existing = database["llm_connections"].documents[0]
    original_plans = list(existing["plans"])

    async def failed_insert(document):
        raise RuntimeError("write failed")

    monkeypatch.setattr(database["llm_connections"], "insert_one", failed_insert)
    response = client.post("/api/admin/connections", json={**CONNECTION, "plans": ["premium"]})

    assert response.status_code == 500
    assert existing["plans"] == original_plans


async def test_audit_target_is_redacted():
    database = FakeDatabase()
    audit = AuditService(Repositories(database), 1)

    await audit.record(
        "example",
        "success",
        None,
        target={"api_key": "secret-value", "note": "token=secret-value"},
        details={"credential": "secret-value", "note": "token=secret-value"},
    )

    stored = database["audit_logs"].documents[0]
    assert stored["target"] == {"api_key": "[REDACTED]", "note": "token=[REDACTED]"}
    assert stored["details"] == {"credential": "[REDACTED]", "note": "token=[REDACTED]"}


def test_deleting_session_is_audited(harness):
    client, database = harness
    assert client.post("/api/auth/register", json={
        "username": "casey",
        "password": "correct horse battery",
        "plan": "standard",
        "policy_accepted": True,
    }).status_code == 201
    session = client.post("/api/chat/sessions").json()

    assert client.delete(f"/api/chat/sessions/{session['id']}").status_code == 200

    events = [item for item in database["audit_logs"].documents if item["event"] == "chat.session.deleted"]
    assert len(events) == 1
    assert events[0]["target"] == {"session_id": session["id"]}
    assert events[0]["outcome"] == "success"
