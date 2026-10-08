# RAG Support Assistant

A RAG (Retrieval-Augmented Generation) simulation: an AI chat that answers IT troubleshooting questions from a small knowledge base, with sources and answer feedback. Users sign in, and each user's plan decides which LLM answers them.

| Part | Stack |
| --- | --- |
| Backend | Python 3.13, FastAPI, PyMongo (async), BM25 retrieval |
| Frontend | React 19, TypeScript, Vite |
| Database | MongoDB 7 |

## Features

- **Accounts and RBAC**: users sign up with a username, password, and plan, then sign in. There are two roles, `user` and `admin`. Admin pages and endpoints require the `admin` role. Each user sees only their own conversations.
- **Plan-based model assignment**: the plan chosen at sign-up (`basic`, `standard`, or `premium`) decides which LLM connection answers that user. Each plan is served by exactly one connection, and admins can reassign plans or change a user's plan at any time.
- **Knowledge base**: 10 troubleshooting documents in `backend/app/data/documents` (VPN, lockout, Outlook, printers, Wi-Fi, Kubernetes, databases, API gateway, disk space...). They are chunked by `##` section and indexed with BM25 at startup.
- **AI chat**: each question retrieves the top sections, builds a grounded prompt (with the last 3 exchanges as history), and calls the model assigned to the user's plan. Answers show clickable sources.
- **LLM connections (admin)**: add, edit, test, and delete connections, and choose which plans each one serves:
  - `mock`: built-in simulator. It needs no network or key and serves all plans by default.
  - `openai`: OpenAI or any OpenAI-compatible API (ollama `http://localhost:11434/v1`, Mistral, vLLM, LM Studio...).
  - `azure_openai`: Azure OpenAI (model = deployment name, API version required).
  - `anthropic`: Anthropic Messages API.
- **Feedback**: rate each answer as *Helpful* or *Not helpful* (with reasons and a comment). Admins can review feedback with satisfaction stats.
- **Logs and audit trail**: structured JSON logs with a request ID on every line, plus a MongoDB audit trail of security and admin events that admins can search.
- **Data policy**: a versioned policy users must accept, data notices next to the chat and feedback, automatic redaction of secrets, retention limits, and self-service export and erasure.

## MongoDB collections

| Collection | Content |
| --- | --- |
| `users` | Username (unique, lowercase), role, plan, `policy_consent` (version and date accepted), and `password` = `{algorithm: scrypt, n, r, p, salt, hash}` with a random 16-byte salt per user |
| `auth_sessions` | Login sessions keyed by the SHA-256 of the cookie token, purged by a TTL index on `expires_at` |
| `chat_sessions` | One document per conversation, owned by `user_id`; `messages[]` holds the redacted question and answer, sources, model used, latency, and status. `expires_at` moves forward with each message |
| `chat_feedback` | One document per rated answer (unique on `session_id` + `message_id`), with the user and a redacted snapshot of the question, answer, and comment |
| `llm_connections` | LLM connection settings and the `plans` each one serves. API keys are stored encrypted (`api_key_encrypted`) |
| `audit_logs` | Security and admin events: event, outcome, actor, target, details, request ID, IP address, user agent |

Every collection that holds personal data has an `expires_at` field and a TTL index (`expireAfterSeconds: 0`), so MongoDB deletes expired documents automatically. This works the same way on AWS DocumentDB.

## Run with Docker

```bash
cp .env.example .env
# Set a strong RAG_BOOTSTRAP_ADMIN_PASSWORD and replace RAG_ENCRYPTION_KEY with:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
docker compose up --build
```

Open http://localhost:8080 (API docs: http://localhost:8080/docs).

## Run locally (Windows)

Start MongoDB 7 (Docker Desktop is sufficient):

```powershell
docker run -d --name rag-mongo -p 27017:27017 mongo:7
```

Create `backend/.env` from the root `.env.example`. For local runs, set `RAG_MONGO_URI=mongodb://localhost:27017`; also set a strong bootstrap admin password and a generated Fernet key. Generate one with `py -3.13 -m pip install cryptography` followed by `py -3.13 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.

```powershell
Set-Location backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --reload
```

In another terminal:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q -p no:warnings
Set-Location ..\frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8000`.

## Run locally (macOS/Linux)

```bash
docker run -d --name rag-mongo -p 27017:27017 mongo:7

cd backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp ../.env.example .env  # set RAG_MONGO_URI=mongodb://localhost:27017 and secrets
.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
.venv/bin/uvicorn app.main:create_app --factory --reload

cd ../frontend
npm install
npm run dev
```

Run tests with `.venv/bin/python -m pytest -q -p no:warnings` from `backend` and `npm run build` from `frontend`.

### End-to-end tests

Cypress specs in `frontend/cypress/e2e/` cover one screen each (login, header/policy, chat, documents, privacy, admin) plus access control. They run against the full stack, so start it first with `docker compose up --build`.

```bash
cd frontend
npm install
npm run e2e        # headless
npm run cy:open    # interactive runner
```

The admin spec signs in as the bootstrap admin and is skipped when the credentials are not provided. Pass them as environment variables (the values from your `.env`):

```powershell
$env:CYPRESS_ADMIN_USERNAME = '<RAG_BOOTSTRAP_ADMIN_USERNAME>'
$env:CYPRESS_ADMIN_PASSWORD = '<RAG_BOOTSTRAP_ADMIN_PASSWORD>'
```

Set `CYPRESS_BASE_URL` to test another origin, for example `http://localhost:5173` with `npm run dev`. Each spec creates its own `e2e_*` users and removes them afterwards.

## Development workflow (agents)

Four custom agents in `.github/agents/` split each task into independent stages. Each task (ticket) has its own handoff file `.github/handoff/tasks/<TASK-ID>.md`, for example `PROJ-123.md`, created by the planner from [.github/handoff/TEMPLATE.md](.github/handoff/TEMPLATE.md). Agents share state only through that file, so each stage can run in a fresh chat session and several tasks can be in flight at once. Every development task uses one new branch shared by all stages: the orchestrator asks for its name and creates it before planning; when agents are run manually, the first agent asks for a name and creates it. The branch is recorded in the handoff and reused on resume. Agents require a clean worktree before creating or switching branches and do not commit or push.

| Agent | Acts when Status is | Can edit | Sets Status to |
| --- | --- | --- | --- |
| `planner` | task file is new, or `BLOCKED` | Task handoff file only | `READY_FOR_CODE` |
| `coder` | `READY_FOR_CODE`, `CHANGES_REQUESTED` | Application code and tests | `READY_FOR_TEST` or `BLOCKED` |
| `tester` | `READY_FOR_TEST` | Tests and the task handoff file | `READY_FOR_REVIEW` or `CHANGES_REQUESTED` |
| `reviewer` | `READY_FOR_REVIEW` | Task handoff file only | `DONE` or `CHANGES_REQUESTED` |

Pick `orchestrator` in the agent dropdown and give the ticket, for example `PROJ-123: add a password strength meter`, to run planner, coder, tester, and reviewer automatically until `DONE` or `BLOCKED`. Running it again with an existing ID resumes that task from its current status. To run stages by hand instead, pick `planner` and give the ID and description, then each next agent with the same ID. After 3 fix rounds the task goes to `BLOCKED` and back to the planner. Finished task files stay in `.github/handoff/tasks/` as the record. Shared project rules for all agents live in [.github/copilot-instructions.md](.github/copilot-instructions.md).

**Models.** The planner and reviewer use Claude Sonnet 5.5; the coder and tester use Gemini 3.8 Flash. Each task file carries the routing table copied from the template.

**Context budget.** [.github/context/FILE_GRAPH.md](.github/context/FILE_GRAPH.md) maps modules, endpoints, collections, features, and tests. The planner uses it to list the *Context files* for each task, and the other agents read only those files instead of scanning the whole source tree. The coder keeps the graph up to date and the reviewer checks it.

## Logs and audit trail

- **Application logs** go to stdout, one JSON object per line (`RAG_LOG_FORMAT=text` for local reading). Each line carries the `request_id` and, when signed in, the `user`. Every request produces one `app.access` line with method, path, status, duration, and IP. Chat answers log the connection, model, status, latency, and number of sources, but never the question or answer text.
- **Request IDs**: the backend reuses a valid incoming `X-Request-ID` header or generates one, and returns it on every response. Unhandled errors return a generic message with the `request_id`, so a user-reported error can be matched to the logs.
- **Audit trail** (`audit_logs`, also written to the `app.audit` log):

| Event | When |
| --- | --- |
| `auth.register`, `auth.login`, `auth.logout` | Account creation and sign-in/out, including failed sign-ins with the attempted username |
| `auth.access_denied` | A non-admin calls an admin endpoint |
| `admin.connection.created` / `updated` / `deleted` / `tested` | LLM connection changes. Field names only, never API key values |
| `admin.user.updated` | Role or plan changes, with before and after values |
| `privacy.policy_accepted`, `privacy.data_exported`, `privacy.data_erased`, `privacy.account_deleted` | Data policy and data-rights actions |

Admins can filter the trail by category, outcome, and username under **Admin → Audit log**, or with `GET /api/admin/audit`.

## Data policy

- The policy is served by `GET /api/privacy/policy` and shown in the **Privacy** page. Its retention figures come from the configuration, so the published text always matches what is enforced.
- Users must accept the current `RAG_DATA_POLICY_VERSION` at sign-up. When you change the version, every user must accept it again before chatting or giving feedback; the backend enforces this, not only the UI.
- **Redaction** (`app/redaction.py`, same rules as the TSDL chat feedback): passwords, tokens, Authorization headers, API keys, AWS keys, private keys, and connection strings are replaced by `[REDACTED]` before a question is sent to the model or stored. Answers, feedback comments, and audit details are redacted too.
- **Retention** defaults: conversations 90 days after the last message, feedback 90 days, audit trail 365 days, login sessions 8 hours. A changed retention setting applies to documents written after the change.
- **User rights** (Privacy page): export all my data as JSON, delete my conversations and feedback, or delete my account (password required). The audit trail is kept until its retention ends, for incident investigation.

## Accounts

At the first startup, an `admin` account is created from `RAG_BOOTSTRAP_ADMIN_USERNAME` / `RAG_BOOTSTRAP_ADMIN_PASSWORD`. Sign in with it to manage connections, users, and feedback. Everyone else creates an account from the sign-in page and picks a plan.

Authentication uses an opaque session token in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api`. The server stores only the token's hash, so logging out revokes the session immediately.

## Security notes (simulation scope)

- Passwords are hashed with scrypt and a per-user random salt; plaintext is never stored or logged. There is no login rate limiting or account lockout yet.
- Plan selection at sign-up is free (no payment), so anyone can pick `premium`.
- API keys are encrypted at rest with Fernet (`RAG_ENCRYPTION_KEY`). They are write-only through the API, which returns only a hint such as `****abcd`. If you change the encryption key, stored API keys become unreadable and must be re-entered. A Vault integration should replace this before production use.
- Set `RAG_COOKIE_SECURE=true` when serving over HTTPS.
- Admins can point a connection at any URL, so the admin role must be treated as privileged.