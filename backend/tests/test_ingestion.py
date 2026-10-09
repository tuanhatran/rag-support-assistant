from __future__ import annotations

import asyncio
import io
import os
import time
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.config import Settings
from app.embeddings import (
    CLOUDFLARE_MAX_BATCH_SIZE,
    EMBEDDING_MODELS,
    OPENAI_MAX_BATCH_SIZE,
    CloudflareEmbeddingProvider,
    OpenAIEmbeddingProvider,
    validate_embedding_dimensions,
)
from app.errors import ConfigurationError, ValidationError
from app.ingestion import (
    IngestionService,
    chunk_text,
    parse_document,
    validate_ingestion_options,
)
from app.main import create_app
from app.repositories import Repositories, utcnow
from app.security import hash_password
from app.vectorstore import FakeVectorStore, PgVectorStore, UnconfiguredVectorStore
from tests.fakes import FakeDatabase


class MockEmbeddingProvider:
    def __init__(self, dimensions: int = 384, fail: bool = False, wrong_dim: int | None = None):
        self.dimensions = dimensions
        self.fail = fail
        self.wrong_dim = wrong_dim

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if self.fail:
            raise RuntimeError("Embedding service unavailable")
        dim = self.wrong_dim if self.wrong_dim is not None else self.dimensions
        return [[0.1] * dim for _ in texts]


@pytest.fixture
def fake_container():
    database = FakeDatabase()
    settings = Settings(
        data_policy_version="current-policy",
        ingestion_retention_days=90,
    )
    vectorstore = FakeVectorStore()
    app = create_app(settings=settings, database=database, initialize=False, vectorstore=vectorstore)
    # Configure custom provider factory for tests
    return app, database, vectorstore


def make_admin(database: FakeDatabase, username: str = "admin_user"):
    oid = ObjectId()
    database["users"].documents.append({
        "_id": oid,
        "username": username,
        "password": hash_password("secretpass"),
        "role": "admin",
        "plan": "premium",
        "policy_consent": {"version": "current-policy", "accepted_at": utcnow()},
        "created_at": utcnow(),
    })
    session_id = f"session-{username}"
    from app.security import hash_token
    database["auth_sessions"].documents.append({
        "_id": hash_token(session_id),
        "user_id": str(oid),
        "expires_at": utcnow() + timedelta(hours=2),
    })
    return session_id


def make_normal_user(database: FakeDatabase, username: str = "normal_user"):
    oid = ObjectId()
    database["users"].documents.append({
        "_id": oid,
        "username": username,
        "password": hash_password("secretpass"),
        "role": "user",
        "plan": "standard",
        "policy_consent": {"version": "current-policy", "accepted_at": utcnow()},
        "created_at": utcnow(),
    })
    session_id = f"session-{username}"
    from app.security import hash_token
    database["auth_sessions"].documents.append({
        "_id": hash_token(session_id),
        "user_id": str(oid),
        "expires_at": utcnow() + timedelta(hours=2),
    })
    return session_id


# =========================================================================
# Unit Tests: Chunking & Options
# =========================================================================

def test_chunk_text_basic_split():
    text = "Section 1: Introduction\n\nSection 2: Details\n\nSection 3: Conclusion"
    chunks = chunk_text(text, chunk_size=500, chunk_overlap=50, separator="\n\n")
    assert len(chunks) == 1
    assert chunks[0] == text


def test_chunk_text_hard_split_and_overlap():
    long_piece = "A" * 250
    chunks = chunk_text(long_piece, chunk_size=100, chunk_overlap=20, separator="\n\n")
    assert len(chunks) == 3
    assert len(chunks[0]) == 100
    assert len(chunks[1]) <= 100
    assert len(chunks[2]) <= 100
    for chunk in chunks:
        assert len(chunk) <= 100


def test_chunk_text_carries_overlap():
    piece1 = "First chunk text."
    piece2 = "Second chunk text."
    text = f"{piece1}\n\n{piece2}"
    chunks = chunk_text(text, chunk_size=35, chunk_overlap=10, separator="\n\n")
    assert len(chunks) == 2
    assert chunks[0] == piece1
    # Second chunk must carry overlap from previous chunk
    assert chunks[1].startswith(piece1[-10:])
    for chunk in chunks:
        assert len(chunk) <= 35


def test_validate_ingestion_options():
    # Valid options
    validate_ingestion_options(500, 50, "\n\n", "@cf/baai/bge-small-en-v1.5")
    validate_ingestion_options(100, 0, "\n", "text-embedding-3-small")
    validate_ingestion_options(2000, 1999, " ", "BAAI/bge-base-en-v1.5")

    # Invalid chunk_size
    with pytest.raises(ValidationError):
        validate_ingestion_options(99, 10, "\n\n", "@cf/baai/bge-small-en-v1.5")
    with pytest.raises(ValidationError):
        validate_ingestion_options(2001, 10, "\n\n", "@cf/baai/bge-small-en-v1.5")

    # Invalid overlap
    with pytest.raises(ValidationError):
        validate_ingestion_options(500, 500, "\n\n", "@cf/baai/bge-small-en-v1.5")
    with pytest.raises(ValidationError):
        validate_ingestion_options(500, -1, "\n\n", "@cf/baai/bge-small-en-v1.5")

    # Invalid separator
    with pytest.raises(ValidationError):
        validate_ingestion_options(500, 50, "---", "@cf/baai/bge-small-en-v1.5")

    # Invalid model
    with pytest.raises(ValidationError):
        validate_ingestion_options(500, 50, "\n\n", "invalid-model")


# =========================================================================
# Unit Tests: Document Parsing & Redaction
# =========================================================================

def test_parse_text_document():
    content = b"This is a test document with credentials: token: secret_value_123"
    text = parse_document(content, "test.txt")
    assert "test document" in text
    assert "secret_value_123" in text


def test_parse_pdf_document_stream():
    # Construct a minimal standard PDF with a text stream
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length 50 >>\nstream\n"
        b"BT\n/F1 12 Tf\n(Hello PDF World) Tj\nET\n"
        b"endstream\nendobj\nxref\n0 5\n0000000000 65535 f \n"
        b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF"
    )
    text = parse_document(pdf_bytes, "doc.pdf")
    assert "Hello PDF World" in text


def test_parse_pdf_high_ratio_decompression_fails(monkeypatch):
    import zlib
    from app import ingestion

    # Set a small limit for fast testing
    monkeypatch.setattr(ingestion, "MAX_STREAM_DECOMPRESSED_BYTES", 500)
    monkeypatch.setattr(ingestion, "MAX_TOTAL_DECOMPRESSED_BYTES", 1000)

    bomb_content = b"BT /F1 12 Tf (Decompression Bomb Text That Exceeds Small Limit) Tj ET\n" * 100
    compressed = zlib.compress(bomb_content)
    pdf_bytes = b"stream\n" + compressed + b"\nendstream"

    with pytest.raises(ValidationError, match="PDF content exceeds decompression limit"):
        parse_document(pdf_bytes, "crafted.pdf")


def test_parse_pdf_cumulative_decompression_limit_fails(monkeypatch):
    import zlib
    from app import ingestion

    monkeypatch.setattr(ingestion, "MAX_STREAM_DECOMPRESSED_BYTES", 600)
    monkeypatch.setattr(ingestion, "MAX_TOTAL_DECOMPRESSED_BYTES", 1000)

    stream1 = zlib.compress(b"(Stream1 text) Tj\n" * 25)
    stream2 = zlib.compress(b"(Stream2 text) Tj\n" * 25)
    stream3 = zlib.compress(b"(Stream3 text) Tj\n" * 25)

    pdf_bytes = (
        b"stream\n" + stream1 + b"\nendstream\n"
        b"stream\n" + stream2 + b"\nendstream\n"
        b"stream\n" + stream3 + b"\nendstream\n"
    )

    with pytest.raises(ValidationError, match="PDF content exceeds decompression limit"):
        parse_document(pdf_bytes, "multi_stream.pdf")


@pytest.mark.asyncio
async def test_pipeline_pdf_decompression_limit_fails(fake_container, monkeypatch):
    import zlib
    from app import ingestion

    monkeypatch.setattr(ingestion, "MAX_STREAM_DECOMPRESSED_BYTES", 500)
    monkeypatch.setattr(ingestion, "MAX_TOTAL_DECOMPRESSED_BYTES", 1000)

    database = FakeDatabase()
    settings = Settings()
    repos = Repositories(database)
    from app.audit import AuditService
    audit = AuditService(repos, 365)
    vectorstore = FakeVectorStore()
    service = IngestionService(
        repos, settings, audit, vectorstore,
        provider_factory=lambda model, s: MockEmbeddingProvider(),
    )
    actor = {"_id": ObjectId(), "username": "admin_user"}

    bomb_content = b"BT /F1 12 Tf (Decompression Bomb Text That Exceeds Small Limit) Tj ET\n" * 100
    compressed = zlib.compress(bomb_content)
    pdf_bytes = b"stream\n" + compressed + b"\nendstream"

    pipeline_id = await service.create_pipeline(
        filename="bomb.pdf",
        file_bytes=pdf_bytes,
        chunk_size=500,
        chunk_overlap=50,
        separator="\n\n",
        embedding_model="@cf/baai/bge-small-en-v1.5",
        actor=actor,
    )
    await asyncio.sleep(0.1)

    pipe = await service.get_pipeline(pipeline_id)
    assert pipe["status"] == "failed"
    assert pipe["stages"]["file_parsing"]["status"] == "failed"
    assert pipe["error"] == "PDF content exceeds decompression limit"
    assert pipe["stages"]["chunking"]["status"] == "idle"
    assert pipe["stages"]["embedding"]["status"] == "idle"
    assert pipe["stages"]["database_ready"]["status"] == "idle"


# =========================================================================
# API & RBAC Tests
# =========================================================================

def test_ingestion_endpoints_require_admin(fake_container):
    app, database, _ = fake_container
    with TestClient(app) as client:
        # Unauthenticated
        resp = client.get("/api/admin/ingestion/options")
        assert resp.status_code == 401

        # Non-admin user
        session_id = make_normal_user(database)
        client.cookies.set("rag-support-assistant", session_id)
        resp = client.get("/api/admin/ingestion/options")
        assert resp.status_code == 403


def test_get_options_returns_four_models_and_limits(fake_container):
    app, database, _ = fake_container
    session_id = make_admin(database)
    with TestClient(app) as client:
        client.cookies.set("rag-support-assistant", session_id)
        resp = client.get("/api/admin/ingestion/options")
        assert resp.status_code == 200
        data = resp.json()
        models = {m["id"]: m for m in data["models"]}
        assert len(models) == 4
        assert models["@cf/baai/bge-small-en-v1.5"]["dimensions"] == 384
        assert models["@cf/baai/bge-small-en-v1.5"]["target"] == "Cloudflare Workers AI"
        assert models["sentence-transformers/all-MiniLM-L6-v2"]["dimensions"] == 384
        assert models["sentence-transformers/all-MiniLM-L6-v2"]["target"] == "Local CPU"
        assert models["BAAI/bge-base-en-v1.5"]["dimensions"] == 768
        assert models["BAAI/bge-base-en-v1.5"]["target"] == "Local CPU"
        assert models["text-embedding-3-small"]["dimensions"] == 1536
        assert models["text-embedding-3-small"]["target"] == "OpenAI API"
        assert any(sep["value"] == "\n\n" for sep in data["separators"])
        assert data["chunk_size"]["min"] == 100
        assert data["chunk_size"]["max"] == 2000


def test_pipeline_upload_validations(fake_container):
    app, database, _ = fake_container
    session_id = make_admin(database)
    with TestClient(app) as client:
        client.cookies.set("rag-support-assistant", session_id)

        # 415 on invalid extension
        resp = client.post(
            "/api/admin/ingestion/pipelines",
            files={"file": ("doc.docx", b"some binary data", "application/octet-stream")},
            data={"chunk_size": 500, "chunk_overlap": 50, "separator": "\n\n", "embedding_model": "@cf/baai/bge-small-en-v1.5"},
        )
        assert resp.status_code == 415

        # 400 on empty file
        resp = client.post(
            "/api/admin/ingestion/pipelines",
            files={"file": ("empty.txt", b"", "text/plain")},
            data={"chunk_size": 500, "chunk_overlap": 50, "separator": "\n\n", "embedding_model": "@cf/baai/bge-small-en-v1.5"},
        )
        assert resp.status_code == 400

        # 413 on file > 512,000 bytes
        large_content = b"x" * 512_001
        resp = client.post(
            "/api/admin/ingestion/pipelines",
            files={"file": ("large.txt", large_content, "text/plain")},
            data={"chunk_size": 500, "chunk_overlap": 50, "separator": "\n\n", "embedding_model": "@cf/baai/bge-small-en-v1.5"},
        )
        assert resp.status_code == 413

        # 400 on invalid options
        resp = client.post(
            "/api/admin/ingestion/pipelines",
            files={"file": ("valid.txt", b"Valid text", "text/plain")},
            data={"chunk_size": 50, "chunk_overlap": 10, "separator": "\n\n", "embedding_model": "@cf/baai/bge-small-en-v1.5"},
        )
        assert resp.status_code == 400


def test_pipeline_api_lifecycle(fake_container):
    app, database, vectorstore = fake_container
    app.state.container.ingestion.provider_factory = lambda model, s: MockEmbeddingProvider(dimensions=384)
    session_id = make_admin(database)
    with TestClient(app) as client:
        client.cookies.set("rag-support-assistant", session_id)

        # 404 for unknown pipeline ID
        resp = client.get("/api/admin/ingestion/pipelines/660e8400ece9f345a3000000")
        assert resp.status_code == 404

        # 404 for chunks of unknown pipeline ID
        resp = client.get("/api/admin/ingestion/pipelines/660e8400ece9f345a3000000/chunks")
        assert resp.status_code == 404

        # Successful POST returns 202 with id and queued status
        resp = client.post(
            "/api/admin/ingestion/pipelines",
            files={"file": ("guide.txt", b"Header line\n\nContent line", "text/plain")},
            data={"chunk_size": 500, "chunk_overlap": 50, "separator": "\n\n", "embedding_model": "@cf/baai/bge-small-en-v1.5"},
        )
        assert resp.status_code == 202
        data = resp.json()
        assert "id" in data
        assert data["status"] == "queued"
        pipeline_id = data["id"]

        # GET pipeline details
        resp = client.get(f"/api/admin/ingestion/pipelines/{pipeline_id}")
        assert resp.status_code == 200
        pipe_data = resp.json()
        assert pipe_data["id"] == pipeline_id
        assert pipe_data["filename"] == "guide.txt"
        assert "stages" in pipe_data
        assert "options" in pipe_data

        # GET chunks preview
        resp = client.get(f"/api/admin/ingestion/pipelines/{pipeline_id}/chunks")
        assert resp.status_code == 200
        chunks_data = resp.json()
        assert isinstance(chunks_data, list)
        for chunk in chunks_data:
            assert "embedding" not in chunk


# =========================================================================
# Pipeline Execution & Background Flow Tests
# =========================================================================

@pytest.mark.asyncio
async def test_full_pipeline_success_redacts_and_inserts():
    database = FakeDatabase()
    settings = Settings(ingestion_retention_days=90)
    repos = Repositories(database)
    from app.audit import AuditService
    audit = AuditService(repos, retention_days=365)
    vectorstore = FakeVectorStore()

    # Provider returns 384-dim mock vectors
    mock_provider = MockEmbeddingProvider(dimensions=384)
    service = IngestionService(
        repos, settings, audit, vectorstore,
        provider_factory=lambda model, s: mock_provider
    )

    actor = {"_id": ObjectId(), "username": "admin_user"}
    file_content = (
        b"Configuration Guide\n\n"
        b"Sensitive key: token: my_secret_token_12345\n\n"
        b"System operational."
    )

    pipeline_id = await service.create_pipeline(
        filename="guide.txt",
        file_bytes=file_content,
        chunk_size=500,
        chunk_overlap=50,
        separator="\n\n",
        embedding_model="@cf/baai/bge-small-en-v1.5",
        actor=actor,
    )

    # Let background asyncio task finish
    await asyncio.sleep(0.1)

    pipeline = await service.get_pipeline(pipeline_id)
    assert pipeline["status"] == "completed"
    assert pipeline["stages"]["file_parsing"]["status"] == "done"
    assert pipeline["stages"]["chunking"]["status"] == "done"
    assert pipeline["stages"]["embedding"]["status"] == "done"
    assert pipeline["stages"]["database_ready"]["status"] == "done"

    # Verify redaction: secret was redacted
    assert "my_secret_token_12345" not in pipeline["extracted_text"]
    assert "[REDACTED]" in pipeline["extracted_text"]

    # Verify chunks in vectorstore
    chunks = await service.get_chunks_preview(pipeline_id)
    assert len(chunks) == pipeline["chunk_count"]
    for ch in chunks:
        assert "embedding" not in ch  # vectors never returned
        assert ch["dimensions"] == 384
        assert ch["model"] == "@cf/baai/bge-small-en-v1.5"

    # Verify audit events
    events = [doc for doc in database["audit_logs"].documents if doc.get("event", "").startswith("admin.ingestion.")]
    event_names = [e["event"] for e in events]
    assert "admin.ingestion.started" in event_names
    assert "admin.ingestion.completed" in event_names
    # Audit details contain pipeline_id and file_name only
    for e in events:
        details = e.get("details", {})
        assert "pipeline_id" in details
        assert "file_name" in details
        assert "token" not in str(details)


@pytest.mark.asyncio
async def test_pipeline_embedding_dimension_mismatch_fails():
    database = FakeDatabase()
    settings = Settings()
    repos = Repositories(database)
    from app.audit import AuditService
    audit = AuditService(repos, retention_days=365)
    vectorstore = FakeVectorStore()

    # Expected 384, provider returns 512
    mock_provider = MockEmbeddingProvider(wrong_dim=512)
    service = IngestionService(
        repos, settings, audit, vectorstore,
        provider_factory=lambda model, s: mock_provider
    )

    actor = {"_id": ObjectId(), "username": "admin_user"}
    pipeline_id = await service.create_pipeline(
        filename="test.txt",
        file_bytes=b"Hello world\n\nSecond paragraph",
        chunk_size=500,
        chunk_overlap=50,
        separator="\n\n",
        embedding_model="@cf/baai/bge-small-en-v1.5",
        actor=actor,
    )

    await asyncio.sleep(0.1)

    pipeline = await service.get_pipeline(pipeline_id)
    assert pipeline["status"] == "failed"
    assert pipeline["stages"]["embedding"]["status"] == "failed"
    assert pipeline["stages"]["database_ready"]["status"] == "idle"
    assert "dimension mismatch" in pipeline["error"].lower()

    # Failure audit event recorded
    failed_event = next(
        (e for e in database["audit_logs"].documents if e.get("event") == "admin.ingestion.failed"),
        None,
    )
    assert failed_event is not None


@pytest.mark.asyncio
async def test_mark_interrupted_on_startup():
    database = FakeDatabase()
    repos = Repositories(database)
    settings = Settings()
    from app.audit import AuditService
    audit = AuditService(repos, 365)
    service = IngestionService(repos, settings, audit, FakeVectorStore())

    p1 = ObjectId()
    p2 = ObjectId()
    database["ingestion_pipelines"].documents.extend([
        {"_id": p1, "status": "queued", "created_at": utcnow()},
        {"_id": p2, "status": "running", "created_at": utcnow()},
    ])

    await service.mark_interrupted_on_startup()

    doc1 = await database["ingestion_pipelines"].find_one({"_id": p1})
    doc2 = await database["ingestion_pipelines"].find_one({"_id": p2})
    assert doc1["status"] == "failed"
    assert doc1["error"] == "interrupted by restart"
    assert doc2["status"] == "failed"
    assert doc2["error"] == "interrupted by restart"


@pytest.mark.asyncio
async def test_vectorstore_sweep_expired():
    store = FakeVectorStore()
    now = utcnow()
    await store.insert_chunks([
        {
            "id": "c1",
            "pipeline_id": "p1",
            "chunk_index": 0,
            "content": "active chunk",
            "model": "m",
            "dimensions": 384,
            "embedding": [0.1] * 384,
            "expires_at": now + timedelta(days=10),
        },
        {
            "id": "c2",
            "pipeline_id": "p1",
            "chunk_index": 1,
            "content": "expired chunk",
            "model": "m",
            "dimensions": 384,
            "embedding": [0.1] * 384,
            "expires_at": now - timedelta(days=1),
        },
    ])

    deleted = await store.sweep_expired()
    assert deleted == 1
    remaining = await store.get_chunks_preview("p1")
    assert len(remaining) == 1
    assert remaining[0]["content"] == "active chunk"


@pytest.mark.asyncio
async def test_background_tasks_set_holds_and_discards():
    database = FakeDatabase()
    settings = Settings()
    repos = Repositories(database)
    from app.audit import AuditService
    audit = AuditService(repos, 365)
    vectorstore = FakeVectorStore()

    class SlowProvider:
        async def embed(self, texts: list[str]) -> list[list[float]]:
            await asyncio.sleep(0.05)
            return [[0.1] * 384 for _ in texts]

    service = IngestionService(
        repos, settings, audit, vectorstore,
        provider_factory=lambda model, s: SlowProvider(),
    )
    actor = {"_id": ObjectId(), "username": "admin_user"}
    pipeline_id = await service.create_pipeline(
        filename="test.txt",
        file_bytes=b"Hello world\n\nSecond paragraph",
        chunk_size=500,
        chunk_overlap=50,
        separator="\n\n",
        embedding_model="@cf/baai/bge-small-en-v1.5",
        actor=actor,
    )
    # The set must hold the active task
    assert len(service.background_tasks) == 1
    # Wait for completion
    await asyncio.gather(*service.background_tasks)
    # The set must have discarded the completed task
    assert len(service.background_tasks) == 0
    pipe = await service.get_pipeline(pipeline_id)
    assert pipe["status"] == "completed"


@pytest.mark.asyncio
async def test_pipeline_audit_record_raises_marks_failed():
    database = FakeDatabase()
    settings = Settings()
    repos = Repositories(database)
    from app.audit import AuditService
    audit = AuditService(repos, 365)
    vectorstore = FakeVectorStore()

    async def failing_record(*args, **kwargs):
        raise RuntimeError("Audit log connection lost")
    audit.record = failing_record

    service = IngestionService(
        repos, settings, audit, vectorstore,
        provider_factory=lambda model, s: MockEmbeddingProvider(),
    )
    actor = {"_id": ObjectId(), "username": "admin_user"}
    pipeline_id = await service.create_pipeline(
        filename="test.txt",
        file_bytes=b"Hello world\n\nSecond paragraph",
        chunk_size=500,
        chunk_overlap=50,
        separator="\n\n",
        embedding_model="@cf/baai/bge-small-en-v1.5",
        actor=actor,
    )
    await asyncio.sleep(0.1)
    pipe = await service.get_pipeline(pipeline_id)
    assert pipe["status"] == "failed"
    assert "Audit log connection lost" in (pipe["error"] or "")


def test_pipeline_error_redaction_secrets(fake_container):
    app, database, vectorstore = fake_container
    fake_token = "sk-abcdef1234567890abcdef1234567890"

    class SecretLeakingProvider:
        async def embed(self, texts: list[str]) -> list[list[float]]:
            raise RuntimeError(f"OpenAI error with key {fake_token}")

    service = app.state.container.ingestion
    service.provider_factory = lambda model, s: SecretLeakingProvider()

    session_id = make_admin(database)
    with TestClient(app) as client:
        client.cookies.set("rag-support-assistant", session_id)
        resp = client.post(
            "/api/admin/ingestion/pipelines",
            files={"file": ("guide.txt", b"Test content\n\nParagraph 2", "text/plain")},
            data={"chunk_size": 500, "chunk_overlap": 50, "separator": "\n\n", "embedding_model": "@cf/baai/bge-small-en-v1.5"},
        )
        assert resp.status_code == 202
        pipeline_id = resp.json()["id"]

        data = {}
        for _ in range(50):
            resp = client.get(f"/api/admin/ingestion/pipelines/{pipeline_id}")
            assert resp.status_code == 200
            data = resp.json()
            if data["status"] in ("completed", "failed"):
                break
            time.sleep(0.05)

        assert data["status"] == "failed"
        assert fake_token not in data["error"]
        assert "[REDACTED]" in data["error"]


@pytest.mark.asyncio
async def test_pipeline_empty_text_fails():
    database = FakeDatabase()
    settings = Settings()
    repos = Repositories(database)
    from app.audit import AuditService
    audit = AuditService(repos, 365)
    vectorstore = FakeVectorStore()
    service = IngestionService(
        repos, settings, audit, vectorstore,
        provider_factory=lambda model, s: MockEmbeddingProvider(),
    )
    actor = {"_id": ObjectId(), "username": "admin_user"}

    # Whitespace-only document
    pipeline_id = await service.create_pipeline(
        filename="empty.txt",
        file_bytes=b"   \n\n  \t  \n  ",
        chunk_size=500,
        chunk_overlap=50,
        separator="\n\n",
        embedding_model="@cf/baai/bge-small-en-v1.5",
        actor=actor,
    )
    await asyncio.sleep(0.1)

    pipe = await service.get_pipeline(pipeline_id)
    assert pipe["status"] == "failed"
    assert pipe["stages"]["file_parsing"]["status"] == "failed"
    assert pipe["error"] == "No text could be extracted from this document"
    # Ensure remaining stages were skipped
    assert pipe["stages"]["chunking"]["status"] == "idle"
    assert pipe["stages"]["embedding"]["status"] == "idle"
    assert pipe["stages"]["database_ready"]["status"] == "idle"
    assert pipe["chunk_count"] == 0


def test_validate_embedding_dimensions_count_mismatch():
    with pytest.raises(ValueError, match="Vector count mismatch"):
        validate_embedding_dimensions("@cf/baai/bge-small-en-v1.5", [[0.1] * 384], expected_count=2)


def test_pipeline_fails_when_vectorstore_unconfigured():
    database = FakeDatabase()
    settings = Settings(
        data_policy_version="current-policy",
        ingestion_retention_days=90,
        pgvector_dsn="",
    )
    # create_app without vectorstore argument defaults to UnconfiguredVectorStore
    app = create_app(settings=settings, database=database, initialize=False)
    service = app.state.container.ingestion
    service.provider_factory = lambda model, s: MockEmbeddingProvider()

    session_id = make_admin(database)
    with TestClient(app) as client:
        client.cookies.set("rag-support-assistant", session_id)
        resp = client.post(
            "/api/admin/ingestion/pipelines",
            files={"file": ("guide.txt", b"Paragraph one\n\nParagraph two", "text/plain")},
            data={"chunk_size": 500, "chunk_overlap": 50, "separator": "\n\n", "embedding_model": "@cf/baai/bge-small-en-v1.5"},
        )
        assert resp.status_code == 202
        pipeline_id = resp.json()["id"]

        data = {}
        for _ in range(50):
            resp = client.get(f"/api/admin/ingestion/pipelines/{pipeline_id}")
            assert resp.status_code == 200
            data = resp.json()
            if data["status"] in ("completed", "failed"):
                break
            time.sleep(0.05)

        assert data["status"] == "failed"
        assert data["status"] != "completed"
        assert data["stages"]["database_ready"]["status"] == "failed"
        assert "not configured" in data["error"].lower()


@pytest.mark.asyncio
async def test_cloudflare_embedding_provider_batching_and_order(monkeypatch):
    provider = CloudflareEmbeddingProvider(account_id="test-acc", api_token="test-token")
    texts = [f"item_{i}" for i in range(250)]
    recorded_calls: list[list[str]] = []

    async def mock_post(self, url, headers=None, json=None):
        batch = json.get("text", [])
        recorded_calls.append(list(batch))
        vectors = [[float(len(t))] * 384 for t in batch]
        mock_response = httpx.Response(
            status_code=200,
            json={"result": {"data": vectors}},
            request=httpx.Request("POST", url),
        )
        return mock_response

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    results = await provider.embed(texts)

    assert len(recorded_calls) == 3
    assert [len(b) for b in recorded_calls] == [100, 100, 50]
    assert recorded_calls[0] == texts[:100]
    assert recorded_calls[1] == texts[100:200]
    assert recorded_calls[2] == texts[200:250]

    assert len(results) == 250
    for i in range(250):
        expected_val = float(len(f"item_{i}"))
        assert results[i] == [expected_val] * 384


@pytest.mark.asyncio
async def test_openai_embedding_provider_batching_and_order(monkeypatch):
    provider = OpenAIEmbeddingProvider(api_key="sk-testkey")
    texts = [f"text_{i}" for i in range(2500)]
    recorded_calls: list[list[str]] = []

    async def mock_post(self, url, headers=None, json=None):
        batch = json.get("input", [])
        recorded_calls.append(list(batch))
        items = [{"index": idx, "embedding": [float(idx)] * 1536} for idx in range(len(batch))]
        items.reverse()
        mock_response = httpx.Response(
            status_code=200,
            json={"data": items},
            request=httpx.Request("POST", url),
        )
        return mock_response

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    results = await provider.embed(texts)

    assert len(recorded_calls) == 2
    assert [len(b) for b in recorded_calls] == [2048, 452]
    assert recorded_calls[0] == texts[:2048]
    assert recorded_calls[1] == texts[2048:2500]

    assert len(results) == 2500
    for i in range(2048):
        assert results[i] == [float(i)] * 1536
    for i in range(452):
        assert results[2048 + i] == [float(i)] * 1536


# =========================================================================
# Postgres pgvector Integration Test (Conditional)
# =========================================================================

@pytest.mark.skipif(not os.getenv("RAG_PGVECTOR_DSN"), reason="RAG_PGVECTOR_DSN not set")
@pytest.mark.asyncio
async def test_pgvector_integration():
    dsn = os.environ["RAG_PGVECTOR_DSN"]
    store = PgVectorStore(dsn)
    await store.bootstrap()

    now = utcnow()
    test_pipeline_id = f"test-pipe-{int(now.timestamp())}"
    chunks = [
        {
            "id": f"{test_pipeline_id}:0",
            "pipeline_id": test_pipeline_id,
            "chunk_index": 0,
            "content": "Postgres test chunk 0",
            "model": "@cf/baai/bge-small-en-v1.5",
            "dimensions": 384,
            "embedding": [0.05] * 384,
            "expires_at": now + timedelta(hours=1),
        }
    ]
    await store.insert_chunks(chunks)
    preview = await store.get_chunks_preview(test_pipeline_id)
    assert len(preview) == 1
    assert preview[0]["content"] == "Postgres test chunk 0"
    assert "embedding" not in preview[0]
