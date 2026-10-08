# Technical Decisions

This document records the main implementation trade-offs for the RAG Support Assistant, along with current limitations and possible follow-up work.

## Architecture and Retrieval

- **Keep the product small and self-contained.** The backend is a FastAPI application, the frontend is React with TypeScript, and MongoDB stores accounts, conversations, feedback, model connections, and audit events. This keeps the demo easy to run while retaining clear HTTP, service, and repository boundaries.
- **Use BM25 rather than a vector database for retrieval.** The knowledge base is small and local, so lexical ranking avoids an embedding service, vector-store operations, and extra infrastructure. Documents are split at Markdown `##` headings and indexed with their title, tags, section name, and body. Retrieval returns up to four sections and filters weak matches against the best score.
- **Keep the embedding path out of the initial implementation.** There is no embedding generation or vector search today. This reduces setup and makes retrieval reproducible, but queries that use different wording from the documents may not find relevant content.
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

## Current Limitations

- The supplied knowledge base is small and static; documents are loaded and indexed at startup. There is no document-ingestion UI, incremental reindexing, or source-version tracking.
- Retrieval is lexical, English-oriented, and uses a fixed tokenizer and score threshold. It can miss synonyms, multilingual queries, and relevant passages with little word overlap; a score is not a calibrated confidence value.
- Chunking follows Markdown headings without token-aware sizing or overlap. Long sections may be truncated in the answer context, while short sections can lack context available elsewhere in the document.
- The prompt asks the model to cite sources, but there is no independent check that every citation is valid or that each answer claim is supported.
- The mock provider is a deterministic simulator, not a measure of production model quality. Results from it should not be presented as evidence of real-world answer accuracy.
- Deployment is currently documented for local Docker Compose only. There is no CI/CD workflow, selected production hosting target, infrastructure-as-code, image registry, automated release, or production operations runbook.

## Ideas for Follow-up

1. Create a small, versioned evaluation set of representative questions, expected source sections, answerability labels, and acceptable outcomes. Report retrieval recall/ranking, citation validity, groundedness, latency, and failure behavior separately for the mock provider and configured models.
2. Add an optional embedding-based retriever and compare it with BM25 on the same evaluation set before changing the default. Keep a lexical fallback and record which retrieval path produced each answer.
3. Add ingestion validation, token-aware chunking, and an explicit reindex operation if the document corpus becomes user-managed or grows materially.
4. Add citation and answer-grounding checks, plus tests for unanswerable and adversarial questions, before relying on generated answers in higher-risk support workflows.
5. Review redaction rules and retention settings against the actual deployment's data policy and threat model.

### CI/CD and Deployment Sequence

The production target is not selected yet. Choose the hosting provider and runtime before implementing provider-specific workflows or infrastructure. Then complete the delivery path in this order:

1. **Choose the target and environments.** Decide cloud or self-hosted runtime, container registry, staging and production environments, domain/TLS ownership, data region, availability goals, and recovery objectives. Prefer managed MongoDB or a documented durable MongoDB deployment; do not treat an ephemeral container filesystem as production persistence.
2. **Define pull-request CI.** Run backend tests (`python -m pytest -q -p no:warnings`), frontend install from the lockfile (`npm ci`) and production build, plus Cypress or integration tests against a disposable Compose stack where practical. Require these checks before merge.
3. **Add security and supply-chain gates.** Scan dependencies and container images, detect committed secrets, validate configuration, and produce an SBOM/provenance record. Fail the release on actionable critical findings and document any accepted exceptions.
4. **Build release images.** Build backend and frontend images from the reviewed commit, tag them with the commit SHA and release version, and record build metadata. Pin base-image versions and deploy the same immutable image that passed CI.
5. **Publish to the registry.** Authenticate the pipeline using short-lived identity where supported, push the images to the selected registry, and restrict production deployment to approved commits and identities.
6. **Provision infrastructure and data services.** Create the application runtime, ingress/load balancer, TLS, network rules, MongoDB, persistent storage, backups, health checks, and access/monitoring integrations using reviewed infrastructure-as-code. Keep MongoDB reachable only by the backend and required operators.
7. **Configure environment and secrets.** Store `RAG_ENCRYPTION_KEY`, bootstrap admin credentials, and any provider credentials in the platform secret manager. Set production cookie security, MongoDB URI/database, retention, logging, and policy settings explicitly. Never print secrets in pipeline output. Preserve the encryption key across releases; rotation requires a deliberate key/data migration plan.
8. **Deploy to staging.** Apply infrastructure and application configuration, deploy the immutable images, wait for MongoDB health and application readiness, then verify startup index creation and the public health endpoint. Use the mock LLM for deterministic checks unless staging is explicitly configured for a real provider.
9. **Run staging acceptance checks.** Execute smoke and end-to-end flows for authentication/consent, grounded answers and source links, admin access control, data export/erasure, request IDs, and redacted logs. Confirm no question, answer, credential, or API-key values appear in logs.
10. **Promote to production with rollback ready.** Require an approval gate, deploy progressively where supported, and run a post-deploy smoke check. Keep the prior image and a documented rollback command; define how application rollback interacts with any database or index changes before release.
11. **Operate and recover.** Alert on availability, error rates, latency, resource saturation, and LLM failures; retain request-ID-based logs and audit events under the data policy. Schedule encrypted backups and test restoration, retention/TTL behavior, key recovery, and incident procedures on a regular cadence.
