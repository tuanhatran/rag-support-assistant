# Fieldnote Support Assistant File Graph

Updated: 2026-10-10

## Backend Modules

| File | Responsibility | API / data surface | Tests |
| --- | --- | --- | --- |
| `backend/app/main.py` | FastAPI factory, lifespan, error mapping, request middleware | `/api/health`, router registration | `backend/tests/test_core.py` |
| `backend/app/config.py` | `RAG_` settings | Mongo, retention, model, cookie settings | `backend/tests/test_core.py` |
| `backend/app/security.py` | scrypt, opaque session token hashing, Fernet | users, sessions, LLM keys | `backend/tests/test_core.py` |
| `backend/app/redaction.py` | Secret redaction | free text before persistence/provider/logging | `backend/tests/test_core.py` |
| `backend/app/observability.py` | JSON logging, request context and IDs, access events | response `X-Request-ID` | `backend/tests/test_core.py` |
| `backend/app/audit.py` | Audit event recording | `audit_logs` | `backend/tests/test_core.py` |
| `backend/app/repositories.py` | Async Mongo collections, indexes, seed simulator | all collections | `backend/tests/test_core.py` |
| `backend/app/schemas.py` | Request validation and enums | API request bodies | `backend/tests/test_core.py` |
| `backend/app/rag.py` | Front matter/section parsing and BM25 index | `backend/app/data/documents/*.md` | `backend/tests/test_core.py` |
| `backend/app/llm.py` | Prompt, simulator, OpenAI-compatible/Azure/Anthropic clients | plan-routed completion | `backend/tests/test_core.py` |
| `backend/app/services.py` | Auth, chat, feedback, privacy, admin workflows | users, auth_sessions, chat_sessions, chat_feedback, llm_connections, audit_logs | `backend/tests/test_core.py`, `backend/tests/test_api.py` |
| `backend/app/dependencies.py` | Container builder, session/RBAC/consent guards | auth/admin/data endpoint guards | `backend/tests/test_core.py`, `backend/tests/test_api.py` |
| `backend/app/ingestion.py` | Parsing, chunking, option validation, pipeline orchestration | `ingestion_pipelines` | `backend/tests/test_ingestion.py` |
| `backend/app/embeddings.py` | Embedding provider protocol and Cloudflare, local (fastembed), OpenAI providers | Embedding vectors | `backend/tests/test_ingestion.py` |
| `backend/app/vectorstore.py` | pgvector store (psycopg async), schema bootstrap, sweep | PostgreSQL `document_chunks` | `backend/tests/test_ingestion.py` |

## Backend Tests

| File | Coverage |
| --- | --- |
| `backend/tests/fakes.py` | In-memory collection/query/update behavior for API tests |
| `backend/tests/test_core.py` | Retrieval, redaction, hashing, policy and model provider protocols |
| `backend/tests/test_api.py` | Session lifecycle, cookie flags, consent, RBAC, request IDs, user isolation, last-admin protection |
| `backend/tests/test_ingestion.py` | Chunking, parsing, redaction, embedding providers, pipeline orchestration, admin endpoints, vectorstore sweep |

## Backend Routes

| Router | Endpoints | Owner |
| --- | --- | --- |
| `routers/auth.py` | plans, register, login, logout, me | `AuthService` |
| `routers/chat.py` | active model, list/create/get/delete sessions, send message | `ChatService` |
| `routers/feedback.py` | submit/upsert answer feedback | `FeedbackService` |
| `routers/documents.py` | searchable document list and document details | `KnowledgeBase` |
| `routers/privacy.py` | policy, consent, export, erase, account deletion | `PrivacyService` |
| `routers/admin.py` | connections, test, users, feedback/stats, audit | `AdminService` |
| `routers/ingestion.py` | options, pipelines (list/create), pipeline detail, chunks | `IngestionService` |

## Collections

| Collection | Owner | Indexes / policy |
| --- | --- | --- |
| `users` | Auth/Admin/Privacy | unique lowercase username |
| `auth_sessions` | Auth | SHA-256 token `_id`, TTL `expires_at`, user ID |
| `chat_sessions` | Chat/Privacy | `(user_id, updated_at)`, TTL `expires_at` |
| `chat_feedback` | Feedback/Admin/Privacy | unique `(session_id, message_id)`, TTL `expires_at` |
| `llm_connections` | Admin/Chat | unique name, plans |
| `audit_logs` | Audit/Admin | timestamp, event/actor timestamp, TTL `expires_at` |
| `ingestion_pipelines` (Mongo) | Ingestion/Admin | TTL `expires_at`, `created_at` |
| `document_chunks` (PostgreSQL) | Ingestion/VectorStore | `pipeline_id`, `expires_at` |

## Knowledge Base

| Document | Category |
| --- | --- |
| `vpn-connection-issues.md` | Network |
| `password-reset-and-account-lockout.md` | Identity & Access |
| `outlook-email-not-syncing.md` | Collaboration |
| `printer-not-responding.md` | Workplace |
| `slow-laptop-performance.md` | Workplace |
| `wifi-connectivity-problems.md` | Network |
| `kubernetes-pod-crashloopbackoff.md` | Platform Engineering |
| `database-connection-timeouts.md` | Platform Engineering |
| `api-gateway-401-403-errors.md` | API Management |
| `linux-disk-space-full.md` | Platform Engineering |

## Frontend Modules

| File | Responsibility |
| --- | --- |
| `frontend/src/App.tsx` | Session bootstrap, unauthorized-session handling, sign-in/sign-out transitions |
| `frontend/src/components/AppShell.tsx` | Authenticated header, navigation, active-view composition, consent gate |
| `frontend/src/api.ts` | Same-origin JSON transport, credentials, error mapping, global 401 handler |
| `frontend/src/api/auth.ts` | Sign-in, registration, plan lookup, current user, sign-out contracts |
| `frontend/src/api/chat.ts` | Session, message, and feedback endpoint contracts |
| `frontend/src/api/documents.ts` | Document list filters and detail lookup contracts |
| `frontend/src/api/privacy.ts` | Policy, consent, export, erasure, and account-deletion contracts |
| `frontend/src/api/admin.ts` | Connection, user, feedback, and audit endpoint contracts |
| `frontend/src/api/ingestion.ts` | Ingestion options, pipeline, and chunk endpoint contracts |
| `frontend/src/types.ts` | Compatibility barrel for domain contracts |
| `frontend/src/types/account.ts` | User, role, plan, and plan-option contracts |
| `frontend/src/types/chat.ts` | Chat session, message, source, and rating contracts |
| `frontend/src/types/documents.ts` | Knowledge-base document contract |
| `frontend/src/types/connections.ts` | LLM connection contract |
| `frontend/src/types/privacy.ts` | Versioned policy contract |
| `frontend/src/types/ingestion.ts` | Ingestion options, stages, pipelines, and chunk contracts |
| `frontend/src/types/admin.ts` | Admin API models and connection form payload |
| `frontend/src/components/LoginPage.tsx` | Authentication shell, brand panel, policy-modal ownership |
| `frontend/src/components/auth/AccountForm.tsx` | Sign-in, registration, plan selection, and form validation |
| `frontend/src/components/PolicyModal.tsx` | Versioned policy loading and consent submission |
| `frontend/src/components/ChatView.tsx` | Chat session lifecycle, API actions, retention/error/notice state |
| `frontend/src/components/chat/ConversationRail.tsx` | Conversation selection, creation/deletion controls, document navigation |
| `frontend/src/components/chat/ChatTranscript.tsx` | Welcome suggestions, answer rendering, citations, ratings |
| `frontend/src/components/chat/MessageComposer.tsx` | Question input, keyboard submission, notices, data-policy link |
| `frontend/src/components/chat/FeedbackDialog.tsx` | Detailed answer feedback form and local selection state |
| `frontend/src/components/chat/SourceDialog.tsx` | Cited runbook modal |
| `frontend/src/components/DocumentsView.tsx` | Document query/filter lifecycle and selected-document state |
| `frontend/src/components/documents/DocumentList.tsx` | Search/filter controls, document rows, tags, empty/error states |
| `frontend/src/components/documents/DocumentReader.tsx` | Selected runbook rendering and empty reader state |
| `frontend/src/components/PrivacyView.tsx` | Policy/data-rights loading, actions, and feedback state |
| `frontend/src/components/privacy/PolicySummary.tsx` | Current policy summary and full-policy action |
| `frontend/src/components/privacy/PrivacyActions.tsx` | Export, conversation erasure, and account-deletion controls |
| `frontend/src/components/AdminView.tsx` | Admin workflow orchestration, API mutations, tab selection, ingestion routing |
| `frontend/src/components/admin/ConnectionsSection.tsx` | LLM connection list, missing-plan warning, connection actions |
| `frontend/src/components/admin/ConnectionDialog.tsx` | Create/edit connection form and provider-specific fields |
| `frontend/src/components/admin/UsersSection.tsx` | User table, row-local staged role/plan edits, and save locking UI |
| `frontend/src/components/admin/FeedbackSection.tsx` | Feedback rating filter, statistics, and feedback entries |
| `frontend/src/components/admin/AuditSection.tsx` | Audit filters, event table, and empty state |
| `frontend/src/components/admin/types.ts` | Admin tab state and shared plan labels; re-exports admin API models |
| `frontend/src/components/IngestionView.tsx` | Ingestion options/history loading, submission, and pipeline routing |
| `frontend/src/components/ingestion/IngestionForm.tsx` | File validation, upload selection, chunking/model form state |
| `frontend/src/components/ingestion/PipelineHistory.tsx` | Pipeline history refresh, loading/error/empty states, and selection |
| `frontend/src/components/IngestionPipelineView.tsx` | Pipeline polling, summary metadata, and error state |
| `frontend/src/components/ingestion/PipelineStages.tsx` | Pipeline stage status and latency cards |
| `frontend/src/components/ingestion/PipelineDetails.tsx` | Chunk, extracted-text, and export tabs with clipboard state |
| `frontend/src/components/ingestion/pipelinePayload.ts` | Shared export payload construction for display and clipboard |
| `frontend/src/components/Markdown.tsx` | GFM Markdown rendering |
| `frontend/src/styles.css` | Responsive application and component styling |
| `frontend/src/styles/tokens.css` | Shared design tokens and root typography/colors |

## Frontend E2E Tests (Cypress)

| File | Responsibility |
| --- | --- |
| `frontend/cypress.config.ts` | Root `.env` admin credentials, base URL `http://localhost:8080`, Windows localhost IPv6 routing, spec and support paths |
| `frontend/cypress/tsconfig.json` | Cypress-only TypeScript project, outside the app `tsc -b` |
| `frontend/cypress/support/e2e.ts` | Support entry, loads commands |
| `frontend/cypress/support/helpers.ts` | Unique credentials, admin env credentials, admin skip guard |
| `frontend/cypress/support/commands.ts` | `registerUser`, `login`, `adminLogin`, `acceptPolicy`, `seedConversation`, `deleteUser` |
| `frontend/cypress/e2e/login.cy.ts` | Login screen: tabs, validation, plans, registration |
| `frontend/cypress/e2e/policy-header.cy.ts` | Header, navigation, sign out, blocking policy modal |
| `frontend/cypress/e2e/chat.cy.ts` | AI Chat: suggestions, answers, sources, feedback, redaction, conversations |
| `frontend/cypress/e2e/documents.cy.ts` | Documents: list, search, category, tag, reader |
| `frontend/cypress/e2e/privacy.cy.ts` | Privacy: policy, export, erase, account deletion |
| `frontend/cypress/e2e/admin.cy.ts` | Admin tabs, connection management, user role/plan edit confirmation/cancellation, delayed-save locking and last-admin protection, feedback, and audit (needs running stack and `CYPRESS_ADMIN_USERNAME` / `CYPRESS_ADMIN_PASSWORD`) |
| `frontend/cypress/e2e/rbac.cy.ts` | Admin guards, unauthenticated access, per-user conversation isolation |

## Operations

| File | Responsibility |
| --- | --- |
| `docker-compose.yml` | MongoDB, backend, frontend services |
| `backend/Dockerfile` | Python 3.13 API image |
| `frontend/Dockerfile` | Vite build and nginx image |
| `frontend/nginx.conf` | Same-origin `/api` reverse proxy and SPA fallback |
| `.env.example` | Local and Docker configuration template |
