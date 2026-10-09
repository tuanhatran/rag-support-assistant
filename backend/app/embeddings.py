from __future__ import annotations

import asyncio
from typing import Any, Protocol

import httpx

from app.config import Settings
from app.errors import ConfigurationError


EMBEDDING_MODELS: dict[str, dict[str, Any]] = {
    "@cf/baai/bge-small-en-v1.5": {
        "id": "@cf/baai/bge-small-en-v1.5",
        "label": "BGE Small En v1.5 (Cloudflare)",
        "dimensions": 384,
        "target": "Cloudflare Workers AI",
    },
    "sentence-transformers/all-MiniLM-L6-v2": {
        "id": "sentence-transformers/all-MiniLM-L6-v2",
        "label": "All-MiniLM-L6-v2 (FastEmbed)",
        "dimensions": 384,
        "target": "Local CPU",
    },
    "BAAI/bge-base-en-v1.5": {
        "id": "BAAI/bge-base-en-v1.5",
        "label": "BGE Base En v1.5 (FastEmbed)",
        "dimensions": 768,
        "target": "Local CPU",
    },
    "text-embedding-3-small": {
        "id": "text-embedding-3-small",
        "label": "Text Embedding 3 Small (OpenAI)",
        "dimensions": 1536,
        "target": "OpenAI API",
    },
}

CLOUDFLARE_MAX_BATCH_SIZE = 100
# OpenAI /v1/embeddings API accepts up to 2048 input items per request
OPENAI_MAX_BATCH_SIZE = 2048


class EmbeddingProvider(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class CloudflareEmbeddingProvider:
    def __init__(self, account_id: str, api_token: str, model_id: str = "@cf/baai/bge-small-en-v1.5"):
        if not account_id or not api_token:
            raise ConfigurationError("Cloudflare Workers AI requires RAG_CLOUDFLARE_ACCOUNT_ID and RAG_CLOUDFLARE_API_TOKEN")
        self.account_id = account_id
        self.api_token = api_token
        self.model_id = model_id

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{self.model_id}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }
        results: list[list[float]] = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for i in range(0, len(texts), CLOUDFLARE_MAX_BATCH_SIZE):
                batch = texts[i : i + CLOUDFLARE_MAX_BATCH_SIZE]
                resp = await client.post(url, headers=headers, json={"text": batch})
                resp.raise_for_status()
                data = resp.json()
                result = data.get("result")
                if isinstance(result, dict) and "data" in result:
                    results.extend([list(vec) for vec in result["data"]])
                elif isinstance(result, list):
                    results.extend([list(vec) for vec in result])
                else:
                    raise ValueError("Unexpected Cloudflare embedding response format")
        return results


class FastEmbedEmbeddingProvider:
    def __init__(self, model_id: str):
        self.model_id = model_id
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from fastembed import TextEmbedding
            except ImportError as err:
                raise ConfigurationError("fastembed is not installed. Install with pip install fastembed") from err
            self._model = TextEmbedding(model_name=self.model_id)
        return self._model

    def _embed_sync(self, texts: list[str]) -> list[list[float]]:
        model = self._get_model()
        embeddings = model.embed(texts)
        return [vec.tolist() if hasattr(vec, "tolist") else list(vec) for vec in embeddings]

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await asyncio.to_thread(self._embed_sync, texts)


class OpenAIEmbeddingProvider:
    def __init__(self, api_key: str, model_id: str = "text-embedding-3-small"):
        if not api_key:
            raise ConfigurationError("OpenAI embedding requires RAG_OPENAI_API_KEY")
        self.api_key = api_key
        self.model_id = model_id

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        results: list[list[float]] = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for i in range(0, len(texts), OPENAI_MAX_BATCH_SIZE):
                batch = texts[i : i + OPENAI_MAX_BATCH_SIZE]
                resp = await client.post(url, headers=headers, json={"model": self.model_id, "input": batch})
                resp.raise_for_status()
                data = resp.json()
                items_data = data.get("data")
                if not isinstance(items_data, list):
                    raise ValueError("Unexpected OpenAI embedding response format")
                items = sorted(items_data, key=lambda x: x.get("index", 0))
                results.extend([list(item["embedding"]) for item in items])
        return results


def get_embedding_provider(model_id: str, settings: Settings) -> EmbeddingProvider:
    if model_id not in EMBEDDING_MODELS:
        raise ConfigurationError(f"Unsupported embedding model: {model_id}")
    if model_id == "@cf/baai/bge-small-en-v1.5":
        return CloudflareEmbeddingProvider(settings.cloudflare_account_id, settings.cloudflare_api_token, model_id)
    if model_id in ("sentence-transformers/all-MiniLM-L6-v2", "BAAI/bge-base-en-v1.5"):
        return FastEmbedEmbeddingProvider(model_id)
    if model_id == "text-embedding-3-small":
        return OpenAIEmbeddingProvider(settings.openai_api_key, model_id)
    raise ConfigurationError(f"No provider configured for model: {model_id}")


def validate_embedding_dimensions(
    model_id: str, embeddings: list[list[float]], expected_count: int | None = None
) -> None:
    if expected_count is not None and len(embeddings) != expected_count:
        raise ValueError(f"Vector count mismatch: expected {expected_count}, got {len(embeddings)}")
    expected = EMBEDDING_MODELS[model_id]["dimensions"]
    for idx, vec in enumerate(embeddings):
        if len(vec) != expected:
            raise ValueError(f"Vector dimension mismatch at chunk {idx}: expected {expected}, got {len(vec)}")
