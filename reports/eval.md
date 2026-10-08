# Self-Evaluation

Date: 2026-10-08

## Summary

The application builds successfully in both layers and the backend test suite passes. This verifies the automated checks listed below, but does not establish production answer quality: no live LLM, production-like corpus, or end-to-end browser session was evaluated here.

## Verification Results

| Check | Result | Evidence |
| --- | --- | --- |
| Backend automated tests | Pass | `cd backend && python -m pytest -q -p no:warnings` — 38 passed in 1.76s |
| Frontend production build | Pass | `cd frontend && npm run build` — TypeScript build and Vite production build completed successfully |
| Live provider evaluation | Not run | No external provider request was made |
| Browser end-to-end evaluation | Not run | This evaluation did not start the full application stack or execute Cypress |
| Retrieval quality benchmark | Not run | No labeled question-to-source evaluation set or retrieval metrics were collected |

## Qualitative Assessment

- **Runnable baseline:** the mock provider and local BM25 corpus support development without external model credentials.
- **Traceability:** request IDs are returned to clients and included in structured request logs. Chat event logs record model, status, latency, and source count without logging question or answer text.
- **Grounding:** retrieved sections are included in the model prompt and the prompt requests numbered citations and abstention when context is insufficient. Citation correctness and claim-level support are not independently validated.
- **Retrieval limits:** BM25 is a reasonable low-infrastructure choice for the current small corpus, but lexical matching, the fixed tokenizer, and the score cutoff have not been measured against a labeled set. Recall, ranking quality, and multilingual performance remain unknown.
- **Privacy and retention:** the application includes redaction, consent, user-scoped data, encrypted LLM keys, and expiry/TTL behavior. This run did not constitute a security audit or verify retention against a live MongoDB deployment.

## Sanitized Log Examples

These are illustrative examples of the application's JSON log shape, not captured production records. Values are synthetic; no prompt, answer, credential, or API key is included.

```json
{"timestamp":"2026-10-08T12:00:00Z","level":"INFO","logger":"app.access","message":"request","request_id":"eval-7f31","user":"demo-user","method":"POST","path":"/api/chat/sessions/example/messages","status":200,"duration_ms":184,"ip":"127.0.0.1"}
{"timestamp":"2026-10-08T12:00:00Z","level":"INFO","logger":"app.chat","message":"answer generated","request_id":"eval-7f31","user":"demo-user","connection":"Built-in simulator","model":"extractive-simulator","status":"ok","latency_ms":2,"source_count":2}
```

## Recommended Next Evaluation

Build a small, versioned set of answerable and unanswerable support questions with expected source sections. Measure retrieval recall/ranking and citation validity separately from answer groundedness; run the same cases against the mock and each configured provider. Add latency and failure behavior, and record the corpus and model configuration with each report so results can be reproduced.
