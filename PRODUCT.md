# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Employees and IT support staff are co-primary users. They ask IT troubleshooting questions and use cited support guidance to resolve issues. Admins manage user roles and plans, model connections, feedback, audit events, and document-ingestion runs.

## Product Purpose

The RAG Support Assistant provides IT troubleshooting answers grounded in a bundled support knowledge base. Users can inspect linked sources and rate answers. Admins configure the model connections and operate a separate document-ingestion workflow. Success means users can get useful, source-visible guidance and admins can manage the service and its supporting workflows.

## Positioning

Keep positioning descriptive: the product generates answers from bundled IT troubleshooting documents and presents source links and answer feedback. No category-unique differentiator or verified answer-accuracy claim has been established.

## Operating Context

The product is a browser-based application. Users create accounts, choose a `basic`, `standard`, or `premium` plan, accept the current data policy, and ask questions in chat. Each plan maps to one configured LLM connection. Admin-only workflows manage connections, users, feedback, audit events, and uploaded documents. Plan selection is not a paid subscription.

## Capabilities and Constraints

- Chat searches ten bundled IT troubleshooting Markdown documents with BM25 and, when PostgreSQL/pgvector and an existing embedding provider are available, searches active ingested chunks too. It uses retrieved passages and recent conversation history, and returns source attribution with answers. BM25 remains the fallback when vector retrieval is unavailable.
- Admins can ingest `.txt` and `.pdf` files up to 500 KB. Extracted, redacted, chunked documents and embeddings are stored in PostgreSQL with pgvector and can ground chat answers while active.
- Supported model connections include a built-in mock provider, OpenAI-compatible APIs, Azure OpenAI, and Anthropic. Embeddings can use Cloudflare Workers AI, local FastEmbed, or OpenAI.
- Users see only their own conversations and can export their data, delete conversations and feedback, or delete their account. Admin functions require the admin role.
- Users must accept the current versioned data policy before chat or feedback. Free text is redacted before persistence or external model calls. Retention defaults are 90 days for conversations, feedback, and ingestion; 365 days for audit events; and 8 hours for login sessions.
- The application is documented for local use and Docker Compose. Cloudflare is a planned deployment target, not a validated production deployment. Retrieval quality, citation validity, production capacity, and real-world model answer quality have not been established.

## Brand Commitments

The existing product name is RAG Support Assistant. No other identity constraints or brand commitments were provided.

## Evidence on Hand

The repository contains ten troubleshooting documents covering VPN, account lockout, Outlook, printers, Wi-Fi, Kubernetes, databases, API gateway, disk space, and laptop performance. The product can display source links and collect answer feedback. No customer testimonials, external outcome evidence, retrieval benchmarks, or validated production answer-quality results are established.

## Product Principles

- Ground troubleshooting guidance in the available support documents and expose its sources.
- Keep user support workflows and privileged administration distinct.
- Minimize and protect user data through consent, redaction, ownership checks, retention, and data-rights controls.
- Do not present unmeasured answer quality, capacity, or deployment readiness as proven.