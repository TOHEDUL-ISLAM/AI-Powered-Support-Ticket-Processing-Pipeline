# Codex Instructions

This file gives Codex repo-specific context for working in this project. It is derived from `CLAUDE.md` plus the current repository files.

## Repository Shape

The repo root is Python/uv tooling used only to run LocalStack. All application code lives in `server/`.

```text
/                         # repo root: Python venv + LocalStack only
├── pyproject.toml         # LocalStack dependency for uv
├── CLAUDE.md              # original agent guidance
├── codex.md               # Codex guidance
└── server/                # Node.js microservice; work here for app changes
    ├── src/               # TypeScript source, CommonJS output
    ├── tests/             # Vitest suites
    └── scripts/           # infrastructure provisioning
```

Use `server/` as the working directory for Node.js tasks. Use the repo root only when starting LocalStack with `uv`.

## Local Development

Start services in this order:

```bash
# repo root, separate terminal, keep it running
uv run localstack start

# server/, provision infra once; safe to rerun
npm run setup

# server/, start hot-reload app
npm run dev
```

Important: `localstack start` is not expected to be in `PATH`. Use `uv run localstack start` from the repo root.

## Commands

Run these from `server/` unless noted otherwise.

```bash
npm run dev                # hot reload via tsx watch
npm run build              # compile TypeScript to dist/
npm start                  # run dist/server.js

npm test                   # all Vitest tests
npm run test:watch         # Vitest watch mode
npm run test:unit          # unit tests
npm run test:integration   # integration tests, sequential single fork
npm run test:e2e           # e2e tests, sequential single fork
npm run test:coverage      # Vitest with v8 coverage

npx vitest run tests/unit/config.test.ts
npx vitest run --reporter=verbose -t "DATABASE_URL"

npm run lint               # eslint src tests
npm run format             # prettier write for src/**/*.ts and tests/**/*.ts
npm run migrate            # node-pg-migrate up
npm run setup              # Docker Postgres + LocalStack SQS provisioning
npm run postgres:start     # start Postgres container
npm run postgres:stop      # stop Postgres container
npm run localstack:start   # start LocalStack from repo root via uv
npm run localstack:stop    # stop LocalStack from repo root via uv
```

Root Python tooling:

```bash
uv run localstack start
```

## Service Overview

This is an AI-powered support ticket pipeline. The current implementation has the foundation, health endpoint, and ticket submission endpoint. The workers, AI pipeline, replay, status endpoint, and realtime delivery are still planned.

Current implemented request flow:

```text
POST /tickets
  -> routes/tickets.ts
  -> TicketController validates request with CreateTicketSchema
  -> TicketService opens withTransaction()
  -> TicketRepository INSERTs tickets row with status=queued
  -> TicketQueue sends SQS message { ticketId } to phase1Queue
  -> transaction COMMITs only if both DB insert and queue send succeed
  -> response 202 { ticketId, status, createdAt }
```

If queue placement fails during `POST /tickets`, the transaction rolls back and no ticket row is left behind.

Current health flow:

```text
GET /health
  -> routes/health.ts
  -> HealthController
  -> HealthService builds sanitized ok/degraded response
  -> HealthRepository checks SELECT 1 and SQS GetQueueAttributes for phase1/phase2
```

Target full pipeline flow:

```text
POST /tickets
  -> ticketController validates input with zod
  -> ticketsService.create()
  -> insert tickets row with status=queued
  -> enqueue phase1Queue
  -> phase1Worker calls Portkey for triage
  -> insert ticket_phases phase=1
  -> update ticket status=processing
  -> enqueue phase2Queue
  -> phase2Worker calls Portkey for resolution draft
  -> insert ticket_phases phase=2
  -> update ticket status=completed
  -> emit Socket.io event to ticket:{id}
```

Every ticket status transition should emit a Socket.io event to `ticket:{id}`. Clients join the room after receiving the `202` from `POST /tickets`.

## Task Requirements From PDF

The source assignment is `Backend Engineering Task: AI-Powered Support Ticket Processing Pipeline` from `/home/nirzon/Downloads/document_pdf.pdf`.

Business goal: build a Node.js backend service for a SaaS support platform that uses AI to process support tickets faster and more consistently.

Phase 1 must analyze the original ticket and produce structured triage metadata:

- Category
- Priority
- Sentiment
- Escalation need
- Routing target
- Concise summary

Phase 2 must use both the original ticket and Phase 1 output to generate:

- Customer-facing response draft
- Internal support note
- Recommended next actions

The required processing behavior is:

- Client starts ticket processing through an API.
- Backend responds immediately that processing is in progress.
- Backend processes asynchronously through queue-based workers.
- Backend sends real-time socket updates for started, progress, success, and failure states.
- Failed phases retry through the queue.
- Retries are phase-level only; do not repeat successful phases.

Production-like requirements from the assignment:

- Async queue-based processing.
- Fallback handling for AI failures.
- Persistent task state tracking.
- Real-time notifications.
- Structured logging for every step, including phase execution, retries, fallback decisions, and final outcome.

## Source Layout And Architecture

```text
server/src/
├── app.ts        # Express app factory; wires singletons via constructor injection
├── server.ts     # HTTP entrypoint
├── config/       # zod-validated environment config; only place process.env is read
├── db/           # raw pg Pool and transaction helper only
├── migrations/   # node-pg-migrate SQL files
├── routes/       # thin Express route wiring only
├── controllers/  # HTTP req/res handling and validation
├── services/     # business orchestration and response shaping
├── repositories/ # data access layer; only layer that imports db/pool for queries
├── schemas/      # Zod runtime validation schemas
├── workers/      # SQS consumer loops
├── queue/        # SQS producer/consumer adapters
├── ai/           # Portkey wrapper, prompts, schemas
├── realtime/     # Socket.io setup and emit helpers
├── logger/       # Pino logger
└── utils/        # retry, errors, misc helpers
```

Layering rule for domain features:

```text
routes -> controllers -> services -> repositories -> db
```

Use object-oriented classes with constructor injection. Create one instance per app startup for stateless services/controllers/repositories/queues. Define interfaces for boundaries that tests need to replace, e.g. `IHealthRepository`, `ITicketQueue`, `ITicketService`.

Current implemented OOP chains:

```text
HealthRepository(pool, sqsClient, phase1Url, phase2Url)
  -> HealthService(repository)
  -> HealthController(service)
  -> createHealthRouter(controller)

TicketRepository()
  + TicketQueue(sqsClient, phase1QueueUrl)
  + Logger
  -> TicketService(repository, queue, logger)
  -> TicketController(service, logger)
  -> createTicketsRouter(controller)
```

Tests live under:

```text
server/tests/unit/
server/tests/integration/
server/tests/e2e/
```

## Database Model

The database has three tables:

| Table | Purpose |
| --- | --- |
| `tickets` | Core ticket record: id, tenant_id, submitter, subject, body, status, timestamps |
| `ticket_phases` | One row per ticket step: triage/resolution status, attempt_count, JSONB result, provider_used, error/timing |
| `ticket_events` | Append-only audit log: ticket_id, event_type, step_name, metadata, created_at |

Current ticket status values are `queued`, `processing`, `completed`, and `failed`.

Current phase status values are `pending`, `running`, `success`, `failed`, and `permanently_failed`.

Migrations live in `server/src/migrations/` and run through `npm run migrate`.

## Configuration Rules

`server/src/config/index.ts` is the only module that reads `process.env`. It loads `.env` outside production, validates with Zod, prints only failing field names to stderr, and exits with status 1 on invalid config.

Current validated env keys:

```text
PORT
NODE_ENV
LOG_LEVEL
DATABASE_URL
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
LOCALSTACK_ENDPOINT
SQS_PHASE1_QUEUE_URL
SQS_PHASE2_QUEUE_URL
SQS_PHASE1_DLQ_URL
SQS_PHASE2_DLQ_URL
PORTKEY_API_KEY
PORTKEY_CONFIG_ID
```

Do not read `process.env` directly outside `src/config/index.ts`. Import the frozen `config` object instead.

Verification:

```bash
grep -rn "process\.env" src/ | grep -v "src/config/"
```

This should return no application usage outside config.

## AI Gateway

All AI calls go through Portkey under `server/src/ai/`. The fallback chain is configured in the Portkey dashboard, not in application code.

Do not import provider SDKs such as Anthropic, OpenAI, or Gemini outside `src/ai/`.

## Implemented Endpoints

### `GET /health`

Returns `200` with `status: "ok"` when all checks pass. Returns `503` with `status: "degraded"` when any dependency is down.

Checks:

- PostgreSQL via `SELECT 1`
- SQS phase1 queue via `GetQueueAttributes`
- SQS phase2 queue via `GetQueueAttributes`

Response must not expose queue URLs, ARNs, credentials, connection strings, passwords, or raw dependency errors.

### `POST /tickets`

Request body:

```json
{
  "subject": "Login broken",
  "body": "Cannot log in since yesterday",
  "submitter": "alice",
  "tenant_id": "acme"
}
```

Validation is in `src/schemas/ticket.schema.ts`. Invalid requests return:

```json
{
  "error": "validation_error",
  "issues": [{ "field": "subject", "message": "subject is required" }]
}
```

Successful requests return `202`:

```json
{
  "ticketId": "<uuid>",
  "status": "queued",
  "createdAt": "<timestamp>"
}
```

Queue message shape is intentionally minimal:

```json
{ "ticketId": "<uuid>" }
```

The queue message points workers back to the database. Do not duplicate subject/body/tenant payload in SQS messages.

## Logging Rules

Use Pino through `src/logger/index.ts`.

Current ticket submission log events:

- `ticket.received` in the controller after validation
- `ticket.saved` in the service after DB insert
- `ticket.queued` in the service after SQS enqueue
- `ticket.queue_failed` in the service when enqueue/transaction fails

Do not log `subject` or `body`; those can contain customer-sensitive text. Log IDs, tenant ID, submitter, request ID, event names, and safe errors only.

## Retry And Replay

Workers use exponential backoff with jitter and a maximum of three attempts. SQS redrive policies use `maxReceiveCount=3`.

After three failures, messages go to the phase-specific DLQ:

```text
phase1DLQ
phase2DLQ
```

`POST /tickets/:id/replay` should re-enqueue from the failed phase only. Already successful phases should not be repeated.

## Hard Rules

- New source files must start with a story header comment: `// US-X.Y: <description>`.
- Multi-table database writes must use a single transaction with `BEGIN`, `COMMIT`, and `ROLLBACK`.
- Pino redaction must cover `password`, `apiKey`, `authorization`, `PORTKEY_API_KEY`, and `DATABASE_URL`.
- `process.exit` is allowed at startup/config validation and scripts only. Do not use it inside request handlers or worker loops.
- HTTP status codes: `202` async accept, `200` reads, `400` validation, `404` missing, `409` state conflict, `500` unexpected.
- Routes are unversioned: use `/tickets` and `/health`, not `/v1/tickets`.
- Integration and e2e tests should use real LocalStack and Postgres. Do not mock the SQS client at the module level for those suites.
- For ticket submission, DB insert and SQS enqueue must remain all-or-nothing: queue failure rolls back the ticket insert.
- Keep SQS ticket submission messages as `{ ticketId }` only.

## Testing Notes

Unit tests that need to verify `process.exit` behavior should spawn a subprocess using the absolute path to `tsx`.

```ts
const TSX_BIN = path.join(ROOT, 'node_modules/.bin/tsx');
spawnSync(TSX_BIN, [scriptPath], { env: customEnv, encoding: 'utf8' });
```

Integration and e2e tests run sequentially to avoid database and queue races:

```bash
vitest run tests/integration --pool=forks --poolOptions.forks.singleFork=true
vitest run tests/e2e --pool=forks --poolOptions.forks.singleFork=true
```

## Dependencies And Tooling

- Node.js `>=20`
- TypeScript `^5.9`
- Express `^4.22`
- Vitest `^3.2`
- Socket.io `^4.8`
- Pino `^9.14`
- Portkey `^1.10`
- AWS SDK SQS client `^3.1037`
- PostgreSQL client `pg`
- `node-pg-migrate`
- LocalStack via root `pyproject.toml` and `uv`

## Working Guidance For Codex

- Read `CLAUDE.md` and this file before making broad architectural changes.
- Keep app edits in `server/`.
- Preserve the existing TypeScript, ESLint, Prettier, Vitest, Express, SQS, Pino, and Portkey patterns.
- Prefer small, focused changes with matching tests.
- When changing config, routes, workers, queues, AI calls, database writes, or retry behavior, check the hard rules above before finishing.
