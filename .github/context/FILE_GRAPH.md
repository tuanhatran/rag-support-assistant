# File Graph

- `backend/app/dependencies.py` wires the chat service to the configured vector store and the ingestion embedding-provider factory.
- `backend/app/services.py` owns chat orchestration, deterministic BM25/vector candidate fusion, expired-pipeline filtering, source metadata, connection credential validation, and complete-only local Ollama stream persistence.
- `backend/app/vectorstore.py` implements pgvector model discovery and similarity search, plus fake and unconfigured store behavior.
- `backend/app/llm.py` builds grounded provider requests, parses OpenAI-compatible local Ollama SSE chunks, and restricts keyless requests to recognized local Ollama endpoints.
- `backend/app/routers/chat.py` keeps local Ollama streaming on the authenticated and consent-checked chat message endpoint; other providers retain JSON responses.
- `backend/app/routers/admin.py` exposes admin-only connection configuration and testing.
- `backend/tests/test_api.py` covers keyless local Ollama administration, hybrid chat integration/fallback, DeepSeek R1 SSE chat, and stream failure persistence; `backend/tests/test_core.py` covers provider requests and deterministic source merging.
- `frontend/src/api.ts` provides the shared same-origin response transport and retains response request IDs on API errors; `frontend/src/api/chat.ts` parses chat SSE with JSON compatibility and emits privacy-safe sendMessage lifecycle diagnostics.
- `frontend/src/components/ChatView.tsx` and `frontend/src/components/chat/ChatTranscript.tsx` render transient local Ollama answer chunks before final persisted messages arrive; `frontend/tests/api.test.ts` and `frontend/tests/views.test.tsx` cover parsing, incremental rendering, and safe request diagnostics.
- `frontend/src/components/admin/ConnectionDialog.tsx` exposes local Ollama configuration; `frontend/cypress/e2e/admin.cy.ts` covers keyless create, test, and edit flows.
