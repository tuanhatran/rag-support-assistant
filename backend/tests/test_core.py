from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from app.config import Settings
from app.llm import complete, mock_answer
from app.rag import KnowledgeBase, tokenize
from app.redaction import redact
from app.schemas import ConnectionRequest
from app.security import hash_password, hash_token, verify_password
from app.services import PrivacyService


DOCUMENTS = Path(__file__).parents[1] / "app" / "data" / "documents"


@pytest.fixture(scope="module")
def knowledge_base():
    return KnowledgeBase(DOCUMENTS)


@pytest.mark.parametrize(("question", "document_id"), [
    ("VPN stuck on connecting", "vpn-connection-issues"),
    ("my account is locked after too many attempts", "password-reset-and-account-lockout"),
    ("pod restarting with OOMKilled exit code 137", "kubernetes-pod-crashloopbackoff"),
    ("No space left on device on my linux server", "linux-disk-space-full"),
    ("API returns 403 forbidden through the gateway", "api-gateway-401-403-errors"),
])
def test_retrieval_ranks_expected_runbook_first(knowledge_base, question, document_id):
    results = knowledge_base.search(question)
    assert results
    assert results[0]["document_id"] == document_id
    assert results[0]["score"] == 1


def test_unrelated_question_has_no_retrieval_results(knowledge_base):
    assert knowledge_base.search("what is the best pizza near home") == []


def test_mock_answer_cites_the_top_source(knowledge_base):
    sources = knowledge_base.search("VPN stuck on connecting")
    answer = mock_answer(sources)
    assert "According to **VPN Connection Issues > Fix: stuck on \"Connecting\"** [1]" in answer


def test_knowledge_base_parses_ten_markdown_documents(knowledge_base):
    assert len(knowledge_base.documents) == 10
    assert all(document["chunks"] for document in knowledge_base.documents)


def test_tokenizer_drops_stopwords_and_short_tokens():
    assert tokenize("A VPN is stuck on the 5G network") == ["vpn", "stuck", "5g", "network"]


@pytest.mark.parametrize(("value", "secret"), [
    ("Authorization: Bearer abc.def.secret", "abc.def.secret"),
    ("password=hunter2", "hunter2"),
    ("api_key=sk-abcdefghijklmnopqrstuvwxyz012345", "sk-abcdefghijklmnopqrstuvwxyz012345"),
    ("AWS key AKIA1234567890ABCDEF", "AKIA1234567890ABCDEF"),
    ("connect mongodb://user:pass@db.corp.example.com/app now", "mongodb://user:pass@db.corp.example.com/app"),
    ("ghp_abcdefghijklmnopqrstuvwxyz123456789012", "ghp_abcdefghijklmnopqrstuvwxyz123456789012"),
])
def test_redaction_removes_secret_patterns(value, secret):
    assert secret not in redact(value)
    assert "[REDACTED]" in redact(value)


def test_redaction_preserves_ordinary_support_text():
    assert redact("Restart Outlook and check the connection status.") == "Restart Outlook and check the connection status."


def test_password_hash_uses_unique_salts_and_verifies():
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")
    assert first["algorithm"] == "scrypt"
    assert first["salt"] != second["salt"]
    assert verify_password("correct horse battery staple", first)
    assert not verify_password("wrong password", first)


def test_session_token_is_only_stored_as_hash():
    assert hash_token("opaque-session") != "opaque-session"
    assert len(hash_token("opaque-session")) == 64


def test_policy_retention_matches_runtime_settings():
    settings = Settings(conversation_retention_days=12, feedback_retention_days=34, audit_retention_days=56)
    policy = PrivacyService(None, settings, None).policy()
    assert policy["retention"] == {"conversations": 12, "feedback": 34, "audit": 56}
    assert "12 days" in policy["sections"][1]["text"]
    assert "34 days" in policy["sections"][1]["text"]


def test_azure_connection_requires_endpoint_and_api_version():
    with pytest.raises(ValueError, match="base URL and API version"):
        ConnectionRequest(name="Azure", provider="azure_openai", model="deployment")


@pytest.mark.asyncio
async def test_openai_client_uses_compatible_url_and_bearer_header():
    observed = {}

    async def handler(request: httpx.Request):
        observed["url"] = str(request.url)
        observed["authorization"] = request.headers["authorization"]
        observed["body"] = await request.aread()
        return httpx.Response(200, json={"choices": [{"message": {"content": "Grounded answer"}}]})

    answer = await complete({"provider": "openai", "model": "test-model", "base_url": "https://llm.example/v1"},
                            "private-test-key", [{"role": "user", "content": "hello"}], 3,
                            transport=httpx.MockTransport(handler))
    assert answer == "Grounded answer"
    assert observed["url"] == "https://llm.example/v1/chat/completions"
    assert observed["authorization"] == "Bearer private-test-key"
    assert b"test-model" in observed["body"]


@pytest.mark.asyncio
async def test_anthropic_client_uses_messages_url_and_headers():
    observed = {}

    async def handler(request: httpx.Request):
        observed["url"] = str(request.url)
        observed["key"] = request.headers["x-api-key"]
        observed["version"] = request.headers["anthropic-version"]
        observed["body"] = await request.aread()
        return httpx.Response(200, json={"content": [{"type": "text", "text": "Anthropic answer"}]})

    answer = await complete({"provider": "anthropic", "model": "claude-test", "base_url": "",
                             "api_version": "2023-06-01"}, "anthropic-private-key",
                            [{"role": "system", "content": "Grounded only"}, {"role": "user", "content": "hello"}],
                            3, transport=httpx.MockTransport(handler))
    assert answer == "Anthropic answer"
    assert observed["url"] == "https://api.anthropic.com/v1/messages"
    assert observed["key"] == "anthropic-private-key"
    assert observed["version"] == "2023-06-01"
    assert b"Grounded only" in observed["body"]


@pytest.mark.asyncio
async def test_provider_error_reports_status_without_requesting_key_echo():
    async def handler(request: httpx.Request):
        return httpx.Response(429, text="rate limited")

    with pytest.raises(RuntimeError, match="provider returned HTTP 429"):
        await complete({"provider": "openai", "model": "test-model", "base_url": "https://llm.example/v1"},
                       "private-test-key", [{"role": "user", "content": "hello"}], 3,
                       transport=httpx.MockTransport(handler))