# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repo layout

The repo root holds Python/uv tooling used **only** to run LocalStack. All application code lives under `server/`. Work in `server/` for every Node.js task.

```
/                         ← repo root (Python venv + LocalStack only)
└── server/               ← Node.js microservice (work here)
    ├── src/              ← TypeScript source (CommonJS)
    ├── tests/            ← vitest suites (unit / integration / e2e)
    └── scripts/          ← infra provisioning
```

---

## Local dev startup sequence

```bash
# 1 — Start LocalStack (repo root, separate terminal, keep it open)
uv run localstack start

# 2 — Provision infra once (idempotent)
cd server && npm run setup:infra

# 3 — Dev server with hot-reload
npm run dev
```

`localstack start` (without `uv run`) is NOT in PATH — always use `uv run localstack start`.

---

## Commands (all run from `server/`)

```bash
npm run dev                # hot-reload via tsx watch
npm run build              # tsc → dist/
npm start                  # run compiled dist/server.js

npm test                   # all tests
npm run test:unit          # unit only
npm run test:integration   # integration (sequential, single fork)
npm run test:e2e           # e2e (sequential, single fork)
npm run test:coverage      # vitest + v8 coverage

# Run a single test file
npx vitest run tests/unit/config.test.ts

# Run tests matching a name pattern
npx vitest run --reporter=verbose -t "DATABASE_URL"

npm run lint               # eslint src/ tests/
npm run format             # prettier write
npm run migrate            # node-pg-migrate up
npm run setup:infra        # provision Postgres DB + 4 SQS queues via LocalStack
```

---

## Architecture

### Request → async pipeline flow

```
POST /tickets
  └─► ticketController (zod validate) → ticketsService.create()
        └─► INSERT tickets (status=pending) → enqueue phase1Queue
              └─► phase1Worker (SQS consumer loop)
                    └─► AI triage (Portkey) → INSERT ticket_phases (phase=1)
                          → UPDATE tickets (status=phase2_processing)
                          → enqueue phase2Queue
                                └─► phase2Worker (SQS consumer loop)
                                      └─► AI draft (Portkey) → INSERT ticket_phases (phase=2)
                                            → UPDATE tickets (status=completed)
                                            → socket.io emit to ticket:{id} room
```

Every status transition emits a Socket.io event to the per-ticket room `ticket:{id}`. Clients join the room after receiving the 202 from `POST /tickets`.

### Database — 3 tables

| Table | Purpose |
|---|---|
| `tickets` | Core record: id, subject, body, status, retry_count, error, timestamps |
| `ticket_phases` | One row per phase per ticket: phase (1 or 2), result JSONB, created_at |
| `ticket_events` | Audit log: every status transition with ticketId, from_status, to_status, timestamp |

Migrations live in `src/migrations/` and run via `node-pg-migrate`.

### AI gateway

All AI calls go through Portkey (`src/ai/`). The fallback chain (Claude → OpenAI → Gemini) is wired in the Portkey dashboard, not in code. The code only calls the Portkey client — never imports provider SDKs directly outside `src/ai/`.

### Retry strategy

Exponential backoff + jitter in the worker loop, max 3 attempts. SQS `maxReceiveCount=3` on redrive policies. After 3 failures, the message lands in the phase DLQ (`phase1DLQ` or `phase2DLQ`). `POST /tickets/:id/replay` re-enqueues from the failed phase only — successful phases are not repeated.

---

## Hard rules

- **`process.env` is banned everywhere except `src/config/index.ts`**. Import `config` from there. Verify with: `grep -rn "process\.env" src/ | grep -v "src/config/"` — must return nothing.
- **No provider AI SDK imports outside `src/ai/`** (no `import Anthropic`, `import OpenAI`, etc. anywhere else).
- **Every new file gets a header comment** with its story ID: `// US-X.Y: <description>`.
- **Multi-table DB writes use a single transaction** (BEGIN / COMMIT / ROLLBACK).
- **Pino redaction** must cover: `password`, `apiKey`, `authorization`, `PORTKEY_API_KEY`, `DATABASE_URL`.
- **`process.exit` is banned inside request handlers and worker loops** — only at startup (config validation) and in scripts.
- **HTTP status codes**: 202 async-accept, 200 reads, 400 validation, 404 missing, 409 state conflict, 500 unexpected.
- **No API version prefix** — routes are `/tickets`, `/health`, not `/v1/tickets`.

---

## Config module

`src/config/index.ts` is the only module that reads `process.env`. It validates all 14 vars with Zod and crashes fast (`process.exit(1)`) on the first parse failure, printing only the **field name** (never the value) to stderr. Import the frozen `config` object everywhere else.

---

## Testing patterns

Unit tests that need to test `process.exit` behaviour spawn a subprocess using the absolute path to `tsx`:

```ts
const TSX_BIN = path.join(ROOT, 'node_modules/.bin/tsx');
spawnSync(TSX_BIN, [scriptPath], { env: customEnv, encoding: 'utf8' });
```

Integration and e2e tests run sequentially (`--pool=forks --poolOptions.forks.singleFork=true`) to avoid DB/queue race conditions. They target a real LocalStack instance and a real Postgres DB — do not mock the SQS client at the module level.
