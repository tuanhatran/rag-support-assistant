from __future__ import annotations

import asyncio
import io
import re
import time
import zlib
from datetime import timedelta
from typing import Any, Callable

from bson import ObjectId

from app.audit import AuditService
from app.config import Settings
from app.embeddings import (
    EMBEDDING_MODELS,
    EmbeddingProvider,
    get_embedding_provider,
    validate_embedding_dimensions,
)
from app.errors import ConfigurationError, NotFoundError, ValidationError
from app.redaction import redact
from app.repositories import Repositories, utcnow
from app.vectorstore import VectorStore

MAX_STREAM_DECOMPRESSED_BYTES = 2 * 1024 * 1024  # 2 MB per stream
MAX_TOTAL_DECOMPRESSED_BYTES = 8 * 1024 * 1024   # 8 MB cumulative per document


def parse_document(file_bytes: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".txt"):
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return file_bytes.decode("latin-1", errors="replace")
    elif lower.endswith(".pdf"):
        # 1. Try pypdf if installed
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = [page.extract_text() or "" for page in reader.pages]
            extracted = "\n".join(t for t in pages_text if t)
            if extracted.strip():
                return extracted
        except Exception:
            pass

        # 2. Built-in stream extractor fallback for standard PDF streams
        text_parts: list[str] = []
        stream_pattern = re.compile(rb"stream\r?\n(.*?)endstream", re.DOTALL)
        total_decompressed = 0

        for match in stream_pattern.finditer(file_bytes):
            stream_data = match.group(1)
            remaining_bytes = MAX_TOTAL_DECOMPRESSED_BYTES - total_decompressed
            if remaining_bytes <= 0:
                raise ValidationError("PDF content exceeds decompression limit")

            stream_limit = min(MAX_STREAM_DECOMPRESSED_BYTES, remaining_bytes)
            decompressed = stream_data
            is_decompressed = False

            # Try zlib header first, then raw deflate
            for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
                try:
                    dco = zlib.decompressobj(wbits)
                    decomp = dco.decompress(stream_data, stream_limit + 1)
                    if len(decomp) > stream_limit or bool(dco.unconsumed_tail) or bool(dco.decompress(b"", 1)):
                        raise ValidationError("PDF content exceeds decompression limit")
                    decompressed = decomp
                    is_decompressed = True
                    break
                except ValidationError:
                    raise
                except Exception:
                    continue

            if not is_decompressed:
                if len(stream_data) > stream_limit:
                    raise ValidationError("PDF content exceeds decompression limit")
                decompressed = stream_data

            total_decompressed += len(decompressed)
            if total_decompressed > MAX_TOTAL_DECOMPRESSED_BYTES:
                raise ValidationError("PDF content exceeds decompression limit")

            tj_matches = re.findall(rb"\((.*?)\)\s*Tj", decompressed)
            for tj in tj_matches:
                text_parts.append(tj.decode("latin-1", errors="replace"))
            tj_array_matches = re.findall(rb"\[(.*?)\]\s*TJ", decompressed)
            for tja in tj_array_matches:
                sub = re.findall(rb"\((.*?)\)", tja)
                text_parts.append("".join(s.decode("latin-1", errors="replace") for s in sub))

        if text_parts:
            return "\n".join(text_parts)
        return ""
    else:
        raise ValidationError(f"Unsupported file type: {filename}")


def chunk_text(text: str, chunk_size: int, chunk_overlap: int, separator: str) -> list[str]:
    """
    Chunk text by separator, with chunk_size and chunk_overlap constraints.
    Pieces exceeding chunk_size are hard-split. Note that overlap is dropped
    when a hard-split piece is close to chunk_size.
    """
    if not text:
        return []

    # Split by separator
    raw_pieces = text.split(separator)
    pieces: list[str] = []
    for piece in raw_pieces:
        if not piece:
            continue
        if len(piece) > chunk_size:
            # Hard-split piece into slices of chunk_size
            for i in range(0, len(piece), chunk_size):
                pieces.append(piece[i:i + chunk_size])
        else:
            pieces.append(piece)

    if not pieces:
        return []

    chunks: list[str] = []
    current_chunk = ""

    for piece in pieces:
        if not current_chunk:
            current_chunk = piece
        else:
            candidate = current_chunk + separator + piece
            if len(candidate) <= chunk_size:
                current_chunk = candidate
            else:
                chunks.append(current_chunk)
                if chunk_overlap > 0:
                    overlap_len = min(chunk_overlap, len(current_chunk))
                    overlap_text = current_chunk[-overlap_len:]
                    candidate_with_overlap = overlap_text + separator + piece
                    if len(candidate_with_overlap) <= chunk_size:
                        current_chunk = candidate_with_overlap
                    else:
                        allowed_overlap = chunk_size - len(separator) - len(piece)
                        if allowed_overlap > 0:
                            current_chunk = current_chunk[-allowed_overlap:] + separator + piece
                        else:
                            current_chunk = piece
                else:
                    current_chunk = piece

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def validate_ingestion_options(
    chunk_size: int, chunk_overlap: int, separator: str, embedding_model: str
) -> None:
    if chunk_size < 100 or chunk_size > 2000:
        raise ValidationError("chunk_size must be between 100 and 2000")
    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise ValidationError("chunk_overlap must be >= 0 and < chunk_size")
    if separator not in ("\n\n", "\n", " "):
        raise ValidationError("separator must be one of '\\n\\n', '\\n', or ' '")
    if embedding_model not in EMBEDDING_MODELS:
        raise ValidationError(f"Invalid embedding_model: {embedding_model}")


class IngestionService:
    def __init__(
        self,
        repos: Repositories,
        settings: Settings,
        audit: AuditService,
        vectorstore: VectorStore,
        provider_factory: Callable[[str, Settings], EmbeddingProvider] | None = None,
    ):
        self.repos = repos
        self.settings = settings
        self.audit = audit
        self.vectorstore = vectorstore
        self.provider_factory = provider_factory or get_embedding_provider
        self.background_tasks: set[asyncio.Task] = set()

    async def get_options(self) -> dict[str, Any]:
        return {
            "models": list(EMBEDDING_MODELS.values()),
            "separators": [
                {"value": "\n\n", "label": "Paragraphs (\\n\\n)"},
                {"value": "\n", "label": "Lines (\\n)"},
                {"value": " ", "label": "Spaces ( )"},
            ],
            "chunk_size": {"min": 100, "max": 2000, "default": 500},
            "chunk_overlap": {"min": 0, "default": 50},
        }

    async def create_pipeline(
        self,
        filename: str,
        file_bytes: bytes,
        chunk_size: int,
        chunk_overlap: int,
        separator: str,
        embedding_model: str,
        actor: dict | None,
    ) -> str:
        validate_ingestion_options(chunk_size, chunk_overlap, separator, embedding_model)
        pipeline_oid = ObjectId()
        pipeline_id = str(pipeline_oid)
        expires_at = utcnow() + timedelta(days=self.settings.ingestion_retention_days)

        document = {
            "_id": pipeline_oid,
            "filename": filename,
            "file_size": len(file_bytes),
            "status": "queued",
            "options": {
                "chunk_size": chunk_size,
                "chunk_overlap": chunk_overlap,
                "separator": separator,
                "embedding_model": embedding_model,
            },
            "stages": {
                "file_parsing": {"status": "idle", "latency_ms": 0},
                "chunking": {"status": "idle", "latency_ms": 0},
                "embedding": {"status": "idle", "latency_ms": 0},
                "database_ready": {"status": "idle", "latency_ms": 0},
            },
            "chunk_count": 0,
            "extracted_text": "",
            "error": None,
            "created_at": utcnow(),
            "updated_at": utcnow(),
            "expires_at": expires_at,
        }
        await self.repos.db["ingestion_pipelines"].insert_one(document)

        options = {
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
            "separator": separator,
            "embedding_model": embedding_model,
        }
        # Run background pipeline and hold strong reference until completion
        task = asyncio.create_task(self.run_pipeline(pipeline_id, file_bytes, filename, options, actor))
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)
        return pipeline_id

    async def run_pipeline(
        self,
        pipeline_id: str,
        file_bytes: bytes,
        filename: str,
        options: dict[str, Any],
        actor: dict | None,
    ) -> None:
        try:
            oid = ObjectId(pipeline_id)
        except Exception:
            oid = pipeline_id

        pipelines = self.repos.db["ingestion_pipelines"]

        try:
            await pipelines.update_one(
                {"_id": oid},
                {"$set": {"status": "running", "updated_at": utcnow()}},
            )
            await self.audit.record(
                "admin.ingestion.started",
                "success",
                actor,
                details={"pipeline_id": pipeline_id, "file_name": filename},
            )

            # Stage 1: file_parsing
            await pipelines.update_one(
                {"_id": oid},
                {"$set": {"stages.file_parsing.status": "running", "updated_at": utcnow()}},
            )
            t0 = time.monotonic()
            raw_text = parse_document(file_bytes, filename)
            # Extracted text must go through redact() before chunking, embedding, storage
            extracted_text = redact(raw_text)
            lat_parsing = max(1, int((time.monotonic() - t0) * 1000))

            if not extracted_text.strip():
                err_msg = "No text could be extracted from this document"
                await pipelines.update_one(
                    {"_id": oid},
                    {
                        "$set": {
                            "stages.file_parsing.status": "failed",
                            "stages.file_parsing.latency_ms": lat_parsing,
                            "status": "failed",
                            "error": err_msg,
                            "updated_at": utcnow(),
                        }
                    },
                )
                try:
                    await self.audit.record(
                        "admin.ingestion.failed",
                        "failure",
                        actor,
                        details={"pipeline_id": pipeline_id, "file_name": filename},
                    )
                except Exception:
                    pass
                return

            await pipelines.update_one(
                {"_id": oid},
                {
                    "$set": {
                        "stages.file_parsing.status": "done",
                        "stages.file_parsing.latency_ms": lat_parsing,
                        "extracted_text": extracted_text,
                        "updated_at": utcnow(),
                    }
                },
            )

            # Stage 2: chunking
            await pipelines.update_one(
                {"_id": oid},
                {"$set": {"stages.chunking.status": "running", "updated_at": utcnow()}},
            )
            t0 = time.monotonic()
            chunks = chunk_text(
                extracted_text,
                options["chunk_size"],
                options["chunk_overlap"],
                options["separator"],
            )
            lat_chunking = max(1, int((time.monotonic() - t0) * 1000))
            await pipelines.update_one(
                {"_id": oid},
                {
                    "$set": {
                        "stages.chunking.status": "done",
                        "stages.chunking.latency_ms": lat_chunking,
                        "chunk_count": len(chunks),
                        "updated_at": utcnow(),
                    }
                },
            )

            # Stage 3: embedding
            await pipelines.update_one(
                {"_id": oid},
                {"$set": {"stages.embedding.status": "running", "updated_at": utcnow()}},
            )
            t0 = time.monotonic()
            provider = self.provider_factory(options["embedding_model"], self.settings)
            vectors = await provider.embed(chunks)
            validate_embedding_dimensions(options["embedding_model"], vectors, expected_count=len(chunks))
            lat_embedding = max(1, int((time.monotonic() - t0) * 1000))
            await pipelines.update_one(
                {"_id": oid},
                {
                    "$set": {
                        "stages.embedding.status": "done",
                        "stages.embedding.latency_ms": lat_embedding,
                        "updated_at": utcnow(),
                    }
                },
            )

            # Stage 4: database_ready
            await pipelines.update_one(
                {"_id": oid},
                {"$set": {"stages.database_ready.status": "running", "updated_at": utcnow()}},
            )
            t0 = time.monotonic()
            dims = EMBEDDING_MODELS[options["embedding_model"]]["dimensions"]
            expires_at = utcnow() + timedelta(days=self.settings.ingestion_retention_days)
            records = [
                {
                    "id": f"{pipeline_id}:{idx}",
                    "pipeline_id": pipeline_id,
                    "chunk_index": idx,
                    "content": chunk_content,
                    "model": options["embedding_model"],
                    "dimensions": dims,
                    "embedding": vectors[idx],
                    "expires_at": expires_at,
                }
                for idx, chunk_content in enumerate(chunks)
            ]
            await self.vectorstore.insert_chunks(records)
            lat_db = max(1, int((time.monotonic() - t0) * 1000))
            await pipelines.update_one(
                {"_id": oid},
                {
                    "$set": {
                        "stages.database_ready.status": "done",
                        "stages.database_ready.latency_ms": lat_db,
                        "status": "completed",
                        "updated_at": utcnow(),
                    }
                },
            )

            await self.audit.record(
                "admin.ingestion.completed",
                "success",
                actor,
                details={"pipeline_id": pipeline_id, "file_name": filename},
            )

        except Exception as exc:
            # Determine which stage failed
            doc = None
            try:
                doc = await pipelines.find_one({"_id": oid})
            except Exception:
                pass

            failed_stage = None
            if doc:
                stages = doc.get("stages", {})
                for stage_name in ("file_parsing", "chunking", "embedding", "database_ready"):
                    if stages.get(stage_name, {}).get("status") == "running":
                        failed_stage = stage_name
                        break

            clean_error = redact(str(exc) or f"{failed_stage or 'Pipeline'} failed")[:200]
            update_fields: dict[str, Any] = {
                "status": "failed",
                "error": clean_error,
                "updated_at": utcnow(),
            }
            if failed_stage:
                update_fields[f"stages.{failed_stage}.status"] = "failed"

            try:
                await pipelines.update_one({"_id": oid}, {"$set": update_fields})
            except Exception:
                pass

            try:
                await self.audit.record(
                    "admin.ingestion.failed",
                    "failure",
                    actor,
                    details={"pipeline_id": pipeline_id, "file_name": filename},
                )
            except Exception:
                pass


    async def get_pipeline(self, pipeline_id: str) -> dict[str, Any]:
        try:
            oid = ObjectId(pipeline_id)
        except Exception:
            oid = pipeline_id
        doc = await self.repos.db["ingestion_pipelines"].find_one({"_id": oid})
        if not doc:
            raise NotFoundError(f"Ingestion pipeline {pipeline_id} not found")
        return {
            "id": str(doc["_id"]),
            "filename": doc.get("filename", ""),
            "file_size": doc.get("file_size", 0),
            "status": doc.get("status", "queued"),
            "options": doc.get("options", {}),
            "stages": doc.get("stages", {}),
            "chunk_count": doc.get("chunk_count", 0),
            "extracted_text": doc.get("extracted_text", ""),
            "error": doc.get("error"),
            "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
            "expires_at": doc.get("expires_at").isoformat() if doc.get("expires_at") else None,
        }

    async def get_chunks_preview(self, pipeline_id: str) -> list[dict[str, Any]]:
        # Verify pipeline exists
        await self.get_pipeline(pipeline_id)
        return await self.vectorstore.get_chunks_preview(pipeline_id)

    async def mark_interrupted_on_startup(self) -> None:
        await self.repos.db["ingestion_pipelines"].update_many(
            {"status": {"$in": ["queued", "running"]}},
            {"$set": {"status": "failed", "error": "interrupted by restart", "updated_at": utcnow()}},
        )
