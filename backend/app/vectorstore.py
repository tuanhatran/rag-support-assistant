from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Protocol

from app.errors import ConfigurationError
from app.repositories import utcnow


class VectorStore(Protocol):
    async def bootstrap(self) -> None:
        ...

    async def insert_chunks(self, chunks: list[dict[str, Any]]) -> None:
        ...

    async def get_chunks_preview(self, pipeline_id: str) -> list[dict[str, Any]]:
        ...

    async def sweep_expired(self) -> int:
        ...


class PgVectorStore:
    def __init__(self, dsn: str):
        if not dsn:
            raise ConfigurationError("RAG_PGVECTOR_DSN is required for PgVectorStore")
        self.dsn = dsn

    def _get_psycopg(self):
        try:
            import psycopg
            return psycopg
        except ImportError as err:
            raise ConfigurationError("psycopg is not installed. Install with pip install psycopg[binary]") from err

    async def _get_connection(self):
        psycopg = self._get_psycopg()
        return await psycopg.AsyncConnection.connect(self.dsn)

    async def bootstrap(self) -> None:
        conn = await self._get_connection()
        try:
            async with conn:
                async with conn.cursor() as cur:
                    await cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                    await cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS document_chunks (
                            id TEXT PRIMARY KEY,
                            pipeline_id TEXT NOT NULL,
                            chunk_index INTEGER NOT NULL,
                            content TEXT NOT NULL,
                            model TEXT NOT NULL,
                            dimensions INTEGER NOT NULL,
                            embedding vector,
                            expires_at TIMESTAMPTZ NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS idx_document_chunks_pipeline_id ON document_chunks (pipeline_id);
                        CREATE INDEX IF NOT EXISTS idx_document_chunks_expires_at ON document_chunks (expires_at);
                        """
                    )
        finally:
            await conn.close()

    async def insert_chunks(self, chunks: list[dict[str, Any]]) -> None:
        if not chunks:
            return
        conn = await self._get_connection()
        try:
            async with conn:
                async with conn.cursor() as cur:
                    for chunk in chunks:
                        vec_str = "[" + ",".join(str(f) for f in chunk["embedding"]) + "]"
                        await cur.execute(
                            """
                            INSERT INTO document_chunks (
                                id, pipeline_id, chunk_index, content, model, dimensions, embedding, expires_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s::vector, %s)
                            ON CONFLICT (id) DO UPDATE SET
                                content = EXCLUDED.content,
                                model = EXCLUDED.model,
                                dimensions = EXCLUDED.dimensions,
                                embedding = EXCLUDED.embedding,
                                expires_at = EXCLUDED.expires_at;
                            """,
                            (
                                chunk["id"],
                                chunk["pipeline_id"],
                                chunk["chunk_index"],
                                chunk["content"],
                                chunk["model"],
                                chunk["dimensions"],
                                vec_str,
                                chunk["expires_at"],
                            ),
                        )
        finally:
            await conn.close()

    async def get_chunks_preview(self, pipeline_id: str) -> list[dict[str, Any]]:
        conn = await self._get_connection()
        try:
            async with conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        SELECT chunk_index, content, model, dimensions
                        FROM document_chunks
                        WHERE pipeline_id = %s
                        ORDER BY chunk_index ASC;
                        """,
                        (pipeline_id,),
                    )
                    rows = await cur.fetchall()
                    return [
                        {
                            "index": row[0],
                            "content": row[1],
                            "model": row[2],
                            "dimensions": row[3],
                        }
                        for row in rows
                    ]
        finally:
            await conn.close()

    async def sweep_expired(self) -> int:
        conn = await self._get_connection()
        try:
            async with conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "DELETE FROM document_chunks WHERE expires_at <= NOW();"
                    )
                    return cur.rowcount
        finally:
            await conn.close()


class FakeVectorStore:
    def __init__(self):
        self.chunks: list[dict[str, Any]] = []
        self.bootstrapped = False

    async def bootstrap(self) -> None:
        self.bootstrapped = True

    async def insert_chunks(self, chunks: list[dict[str, Any]]) -> None:
        for chunk in chunks:
            # Replace existing if same id
            self.chunks = [c for c in self.chunks if c["id"] != chunk["id"]]
            self.chunks.append(dict(chunk))

    async def get_chunks_preview(self, pipeline_id: str) -> list[dict[str, Any]]:
        matching = [c for c in self.chunks if c["pipeline_id"] == pipeline_id]
        matching.sort(key=lambda c: c["chunk_index"])
        return [
            {
                "index": c["chunk_index"],
                "content": c["content"],
                "model": c["model"],
                "dimensions": c["dimensions"],
            }
            for c in matching
        ]

    async def sweep_expired(self) -> int:
        now = utcnow()
        before = len(self.chunks)
        self.chunks = [c for c in self.chunks if c.get("expires_at", now) > now]
        return before - len(self.chunks)


class UnconfiguredVectorStore:
    """VectorStore implementation used when RAG_PGVECTOR_DSN is not configured.
    Methods raise ConfigurationError to fail the database_ready stage or API calls."""

    async def bootstrap(self) -> None:
        pass

    async def insert_chunks(self, chunks: list[dict[str, Any]]) -> None:
        raise ConfigurationError("PostgreSQL vector store is not configured (RAG_PGVECTOR_DSN missing)")

    async def get_chunks_preview(self, pipeline_id: str) -> list[dict[str, Any]]:
        raise ConfigurationError("PostgreSQL vector store is not configured (RAG_PGVECTOR_DSN missing)")

    async def sweep_expired(self) -> int:
        return 0

