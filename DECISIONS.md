# Technical Decisions

This document records the main implementation trade-offs for the RAG Support Assistant, along with current limitations and possible follow-up work.

## Architecture and Retrieval

- **Keep the product small and self-contained.** The backend is a FastAPI application, the frontend is React with TypeScript, MongoDB stores accounts, conversations, feedback, model connections, audit events, and ingestion pipeline history, and PostgreSQL with pgvector stores ingested document chunks and embeddings. This keeps the demo easy to run while retaining clear HTTP, service, and repository boundaries.
- **Use BM25 rather than a vector database for retrieval.** The knowledge base is small and local, so lexical ranking avoids an embedding service, vector-store operations, and extra infrastructure. Documents are split at Markdown `##` headings and indexed with their title, tags, section name, and body. Retrieval returns up to four sections and filters weak matches against the best score.
- **Keep BM25 as the chat retriever for now.** The admin ingestion pipeline can create embeddings and store chunks in pgvector using Cloudflare Workers AI, local FastEmbed, or OpenAI, but chat still retrieves from the bundled BM25 index. This avoids changing chat retrieval before measuring quality, but ingested documents are not yet used to answer chat questions.
- **Retain a mock LLM provider.** The built-in simulator makes the application runnable without external credentials and provides a predictable development and demo path. OpenAI-compatible, Azure OpenAI, and Anthropic providers are available when configured.
- **Ground generated answers in retrieved context.** The prompt instructs providers to answer only from supplied context, cite numbered sources, and acknowledge when the corpus lacks an answer. Prompt instructions reduce unsupported answers but are not a guarantee; model output still needs evaluation.

## Privacy and Operations

- **Keep requests same-origin and scope user data.** The frontend sends API requests through `/api`; backend data access is scoped to the authenticated user. Consent guards data-producing operations.
- **Redact free text before persistence and external model calls.** Structured logging also filters sensitive fields and includes request IDs. This is a defense-in-depth measure, not a substitute for restricting access to logs, reviewing redaction coverage, and avoiding unnecessary collection.
- **Encrypt stored LLM credentials.** Connection API keys are encrypted at rest, and the UI/API treat them as write-only. The encryption key must be kept outside source control and backed up securely by the deployment owner.
- **Use expiry timestamps and MongoDB TTL indexes for retention.** This avoids a separate cleanup worker and is compatible with the transaction-free MongoDB/DocumentDB approach. TTL cleanup is asynchronous, so expired records are not guaranteed to disappear at the exact expiry time.

## Development Workflow

- **Use a ticket-scoped, staged agent harness on one dedicated branch per task.** Each task has a handoff file under `.github/handoff/tasks/` that records its branch, status, context files, acceptance criteria, test commands, and fix-round count. The orchestrator asks for and creates a branch before dispatching; a standalone first agent does the same. Every stage reuses the recorded branch, making both task state and code changes durable across separate agent runs.
- **Separate planning, implementation, testing, and review.** The stages progress from planner to coder to tester to reviewer, with statuses controlling who may act and what each role may edit. The orchestrator can run the stages end to end; individual agents can also be invoked manually, and an existing task can resume from its recorded status.
- **Constrain context and edits per task.** The planner names the allowed context files; agents use the project file graph and task handoff to stay within that scope. This reduces unrelated changes and keeps implementation focused, though an incomplete or stale handoff can constrain an agent with missing context. Branch checks require a clean worktree before switching and stop rather than risk carrying unrelated edits onto another task's branch.
- **Require validation and cap repair loops.** The workflow carries backend test and frontend build commands in the handoff, routes failed checks or review findings back for fixes, and blocks after three fix rounds. This gives tasks an explicit completion path while leaving final quality dependent on the acceptance criteria and the checks actually run.
- **Route models by role.** The documented workflow uses Claude Sonnet 5.5 for planning and review, and Gemini 3.8 Flash for coding and testing. Keeping model routing in the handoff makes the intended assignment visible and repeatable in the agent picker.

## Current Status

- The admin document-ingestion pipeline and pipeline history are implemented. Local development and deployment are documented through Docker Compose.
- The latest recorded gate in the completed RSA-2 handoff passed: backend tests (64 passed, 1 skipped) and frontend production build. Browser end-to-end tests, live-provider evaluation, retrieval benchmarks, and production load tests have not been run.
- Cloudflare is the planned next deployment target; no production hosting or CI/CD is in place yet.

## Current Limitations

- The bundled knowledge base is small and indexed at startup. Admins can upload `.txt` and `.pdf` documents through an ingestion pipeline; pipeline status is kept in MongoDB and chunks and embeddings are stored in PostgreSQL with pgvector. Ingested documents are not yet part of chat retrieval, and there is no source-version tracking or reindex workflow.
- Ingestion runs as background asyncio tasks inside the API process. It is currently single-process: a process restart marks unfinished jobs as interrupted, and there is no durable queue or distributed worker coordination for horizontal scaling.
- Retrieval is lexical, English-oriented, and uses a fixed tokenizer and score threshold. It can miss synonyms, multilingual queries, and relevant passages with little word overlap; a score is not a calibrated confidence value.
- Bundled-document chunking follows Markdown headings without token-aware sizing or overlap. Uploaded-document chunking uses configured separators and character limits, not token-aware sizing; neither path has been evaluated for retrieval quality at scale.
- The prompt asks the model to cite sources, but there is no independent check that every citation is valid or that each answer claim is supported.
- The mock provider is a deterministic simulator, not a measure of production model quality. Results from it should not be presented as evidence of real-world answer accuracy.
- Deployment is currently documented for local Docker Compose only. Cloudflare is the planned next hosting target, but no production deployment, CI/CD workflow, infrastructure-as-code, or production operations runbook exists. The 1,000-active-user goal has not been load-tested, and platform/runtime and database compatibility still need to be validated.

## Ideas for Follow-up

1. Deploy to Cloudflare, targeting comfortable support for 1,000 active users. First define the workload and peak concurrency, verify runtime and database compatibility, and validate the capacity target with load tests; do not treat the target as established until measured.
2. Make ingestion safe to scale beyond one API process by moving background jobs to a durable queue and workers, with retry and idempotency behavior.
3. Add pull-request and release CI for backend tests, frontend build and end-to-end checks, dependency and deployment-artifact scanning, and staged deployment with rollback.
4. Create a small, versioned evaluation set of representative questions, expected source sections, answerability labels, and acceptable outcomes. Report retrieval recall/ranking, citation validity, groundedness, latency, and failure behavior separately for the mock provider and configured models.
5. Change chat to use newly ingested documents. Compare BM25 and embedding-based retrieval on the same evaluation set before changing the default; keep a lexical fallback and record which retrieval path produced each answer.
6. Improve ingestion with token-aware chunking, validation, source-version tracking, and an explicit reindex operation as the corpus grows.
7. Add citation and answer-grounding checks, plus tests for unanswerable and adversarial questions, before relying on generated answers in higher-risk support workflows.
8. Review redaction rules, retention settings, backups, and recovery procedures against the deployment's data policy and threat model.

### CI/CD and Deployment Sequence

Cloudflare is the planned production hosting target, but the deployment design and capacity are not yet validated. Confirm that the selected Cloudflare runtime can host the FastAPI service and support its long-running ingestion work, and that MongoDB and PostgreSQL with pgvector can be reached securely as durable managed services. Define what "1,000 active users" means for peak concurrency and workload, then prove the target with a representative load test. Complete the delivery path in this order:

1. **Validate the platform fit.** Select the Cloudflare runtime and deployment shape for the frontend and FastAPI backend. Verify support for the API's runtime needs, background ingestion workers, outbound model calls, and secure connectivity to durable MongoDB and PostgreSQL/pgvector services. Do not assume the current Compose topology maps directly to Cloudflare.
2. **Define environments and capacity.** Set up staging and production, domain/TLS ownership, data region, availability and recovery objectives, and secret management. Define representative user journeys, peak concurrency, request mix, and latency/error budgets for the 1,000-active-user target.
3. **Add pull-request CI and security gates.** Run backend tests (`python -m pytest -q -p no:warnings`), frontend install from the lockfile (`npm ci`) and production build, plus Cypress or integration tests against a disposable Compose stack where practical. Scan dependencies and deployment artifacts, detect committed secrets, validate configuration, and document accepted exceptions.
4. **Automate Cloudflare staging deployment.** Build and publish reviewed artifacts using the deployment mechanism supported by the selected runtime, configure secrets without exposing them in logs, and verify health checks, startup index creation, and database connectivity.
5. **Run staging acceptance and load tests.** Verify authentication/consent, grounded answers and source links, admin access control, data export/erasure, request IDs, and redacted logs. Load-test the defined workload and confirm the 1,000-active-user objective against agreed latency, error-rate, and resource limits.
6. **Promote with rollback and operations ready.** Require approval, deploy progressively where supported, and run post-deploy smoke checks. Document rollback, alerts, request-ID-based logs, encrypted backups and restore tests, retention behavior, key recovery, and incident procedures.
