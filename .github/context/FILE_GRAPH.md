# File Graph

- `backend/app/dependencies.py` wires the chat service to the configured vector store and the ingestion embedding-provider factory.
- `backend/app/services.py` owns chat orchestration, deterministic BM25/vector candidate fusion, expired-pipeline filtering, source metadata, and connection credential validation.
- `backend/app/vectorstore.py` implements pgvector model discovery and similarity search, plus fake and unconfigured store behavior.
- `backend/app/llm.py` builds grounded provider requests and restricts keyless OpenAI-compatible requests to local Ollama endpoints.
- `backend/app/routers/admin.py` exposes admin-only connection configuration and testing.
- `backend/tests/test_api.py` covers keyless local Ollama administration and hybrid chat integration/fallback; `backend/tests/test_core.py` covers provider requests and deterministic source merging.
