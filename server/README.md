# AI-Powered Support Ticket Processing Pipeline

A production-grade Node.js microservice that processes customer support tickets through a
2-phase AI pipeline: **Phase 1** triages the ticket (category, priority, sentiment, summary),
**Phase 2** generates a resolution draft (customer reply, internal note, recommended actions).
Processing is fully asynchronous via AWS SQS queues, with real-time Socket.io updates and
structured Pino logging at every step.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS | `node --version` to verify |
| PostgreSQL | 16 | local install or remote |
| AWS CLI | v2 | queue provisioning via LocalStack |
| uv | latest | Python package manager — manages LocalStack |

---

## First-time setup

```bash
# 1. Clone repo
git clone <repo-url>
cd ticket

# 2. Start LocalStack (separate terminal — keep it open)
uv run localstack start

# 3. Enter service directory and install dependencies
cd server && npm install

# 4. Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, PORTKEY_API_KEY, PORTKEY_CONFIG_ID, PORTKEY_PRIMARY_PROVIDER

# 5. Provision SQS queues + Postgres
npm run setup

# 6. Start dev server
npm run dev
```

**Expected output from `npm run setup`:**
```
[setup] Waiting for LocalStack to be ready...
[setup] (Start it with: uv run localstack start — from the repo root)
[setup] LocalStack is ready.
[setup] Provisioning SQS queues...
[setup]   ✓ phase1DLQ
[setup]   ✓ phase2DLQ
[setup]   ✓ phase1Queue  (VisibilityTimeout=90s, redrive → phase1DLQ, maxReceiveCount=3)
[setup]   ✓ phase2Queue  (VisibilityTimeout=90s, redrive → phase2DLQ, maxReceiveCount=3)

  Paste these into your .env:
  SQS_PHASE1_QUEUE_URL=http://localhost:4566/000000000000/phase1Queue
  SQS_PHASE2_QUEUE_URL=http://localhost:4566/000000000000/phase2Queue
  SQS_PHASE1_DLQ_URL=http://localhost:4566/000000000000/phase1DLQ
  SQS_PHASE2_DLQ_URL=http://localhost:4566/000000000000/phase2DLQ

[setup] Setting up PostgreSQL database...
[setup]   ✓ Database 'ai_ticket_pipeline' created.
[setup] Done. Local environment is ready.
[setup] Next: npm run dev
```

Running `npm run setup` a second time is safe — all operations are idempotent.

---

## AI Gateway Setup

All AI calls go through Portkey via `src/ai/`. Do not import Anthropic, OpenAI,
Gemini, or other provider SDKs anywhere else in the codebase.

Required environment variables:

```bash
PORTKEY_API_KEY=<portkey-api-key>
PORTKEY_CONFIG_ID=<portkey-config-id>
PORTKEY_PRIMARY_PROVIDER=<primary-provider-name>
```

Configure `PORTKEY_CONFIG_ID` in the Portkey dashboard with:

- Provider priority matching your production route, for example OpenRouter → Groq → backend
- Fallback triggers: rate limits, 5xx provider errors, and request timeouts
- Credentials/virtual keys for every provider used by that route
- JSON response mode or equivalent response validation support

`PORTKEY_PRIMARY_PROVIDER` must match the first provider in the active Portkey
route. The app uses it only to decide whether `fallback` should be true and to
write accurate `primary_provider` metadata. You can switch providers in Portkey
without changing source code.

Manual fallback smoke checks:

1. Disable the primary provider in the Portkey dashboard config. Submit a ticket
   and confirm the phase record stores the next provider in `provider_used`.
2. Disable the first two providers. Submit a ticket and confirm the third
   provider is stored in `provider_used`.
3. Disable all providers. Submit a ticket and confirm the worker logs a typed
   AI gateway failure and the SQS message remains retryable.
4. Inspect `ticket_events` for `provider_fallback` when any non-primary provider
   handles a phase.

Automated tests inject fake AI gateway responses, so normal local test runs do
not require live Portkey network access.

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start with hot-reload via tsx |
| `build` | `npm run build` | Compile TypeScript → dist/ |
| `start` | `npm start` | Run compiled output |
| `setup` | `npm run setup` | Provision SQS queues + Postgres (LocalStack must be running) |
| `test` | `npm test` | Run all tests (vitest) |
| `test:unit` | `npm run test:unit` | Unit tests only |
| `test:integration` | `npm run test:integration` | Integration tests (sequential) |
| `test:e2e` | `npm run test:e2e` | End-to-end tests |
| `test:coverage` | `npm run test:coverage` | Tests with v8 coverage report |
| `lint` | `npm run lint` | ESLint across src/ and tests/ |
| `format` | `npm run format` | Prettier write |
| `migrate` | `npm run migrate` | Run pending DB migrations |
| `socket:client` | `npm run socket:client -- ticket <ticketId>` | Subscribe to live ticket or tenant updates |

---

## Quality and Observability Checks

Run these before calling a story complete:

```bash
npm run build
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
```

Integration and coverage runs use real Postgres and LocalStack queues. Stop
`npm run dev` before running them, because the dev workers also consume SQS
messages and can race the tests.

Structured logs are emitted as JSON in non-development environments and include
standard service metadata:

```json
{
  "service": "ai-ticket-pipeline",
  "environment": "test",
  "version": "0.1.0",
  "event": "phase1.triage.completed",
  "pipelineEvent": "step_completed",
  "ticketId": "..."
}
```

Pipeline lifecycle logs use stable `pipelineEvent` values such as
`step_started`, `step_completed`, `step_failed`, `retry_scheduled`,
`provider_fallback`, `permanently_failed`, `pipeline_complete`, and
`replay_initiated`. Sensitive values such as passwords, API keys,
authorization headers, Portkey keys, and database URLs are redacted by Pino.

Coverage is enforced at 80% for lines, statements, branches, and functions
across the core `src/` modules. Server boot files and type-only files are
excluded from the threshold because they are covered by smoke/manual checks
rather than unit behavior.

---

## Live Update Demo

Socket.io clients subscribe to rooms and receive one event name:

```txt
ticket:update
```

Subscribe to one ticket:

```bash
npm run socket:client -- ticket <ticketId>
```

Subscribe to every ticket under a tenant:

```bash
npm run socket:client -- tenant <tenantId>
```

Typical terminal demo:

```bash
# Terminal 1: start LocalStack from the repo root
uv run localstack start

# Terminal 2: start the app and workers from server/
npm run dev

# Terminal 3: subscribe to all updates for tenant demo before submitting
npm run socket:client -- tenant demo

# Terminal 4: submit a ticket and capture the ID
TICKET_ID=$(curl -s -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{"subject":"Login broken","body":"I cannot log in","submitter":"alice@example.com","tenant_id":"demo"}' \
  | jq -r '.ticketId')
```

For a full pipeline run, the client receives lifecycle updates such as:

```txt
step_started
step_completed
pipeline_completed
ticket_failed
```

The final `pipeline_completed.data` payload is shaped to match `GET /tickets/:id`.

---

## Folder Structure

```
ticket/
├── pyproject.toml          # uv project — LocalStack installed here
└── server/
    ├── src/
    │   ├── config/         # zod-validated env config (single source of truth)
    │   ├── db/             # pg Pool, query helpers
    │   ├── migrations/     # node-pg-migrate SQL files
    │   ├── routes/         # Express route definitions (thin)
    │   ├── controllers/    # req/res handling + zod input validation
    │   ├── services/       # business logic — pure functions where possible
    │   ├── workers/        # SQS consumer loops (phase1Worker, phase2Worker)
    │   ├── queue/          # SQS send/receive/delete helpers
    │   ├── ai/             # Portkey client wrapper + prompt templates + schemas
    │   ├── realtime/       # Socket.io server init + emit helpers
    │   ├── logger/         # pino instance + context helpers
    │   └── utils/          # retry backoff, custom errors, misc
    ├── tests/
    │   ├── unit/           # pure function tests
    │   ├── integration/    # DB + SQS integration tests
    │   └── e2e/            # full pipeline tests
    └── scripts/
        └── setup.sh        # idempotent infra provisioning
```
