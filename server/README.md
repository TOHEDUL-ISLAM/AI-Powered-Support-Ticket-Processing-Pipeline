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
| Docker | latest | LocalStack runs in Docker |
| PostgreSQL | 16 | local install or remote |
| AWS CLI | v2 | queue provisioning via LocalStack |

---

## First-time setup

```bash
# 1. Clone and enter the service directory
git clone <repo-url>
cd ticket/server

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, PORTKEY_API_KEY, PORTKEY_CONFIG_ID

# 4. Provision LocalStack (SQS) + Postgres in one command
npm run setup

# 5. Start dev server
npm run dev
```

**Expected output from `npm run setup`:**
```
[setup] Starting LocalStack via Docker Compose...
[setup] LocalStack container started.
[setup] Waiting for LocalStack SQS to be ready...
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

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start with hot-reload via tsx |
| `build` | `npm run build` | Compile TypeScript → dist/ |
| `start` | `npm start` | Run compiled output |
| `setup` | `npm run setup` | First-time infra provisioning (LocalStack + Postgres) |
| `localstack:start` | `npm run localstack:start` | Start LocalStack container only |
| `localstack:stop` | `npm run localstack:stop` | Stop LocalStack container |
| `test` | `npm test` | Run all tests (vitest) |
| `test:unit` | `npm run test:unit` | Unit tests only |
| `test:integration` | `npm run test:integration` | Integration tests (sequential) |
| `test:e2e` | `npm run test:e2e` | End-to-end tests |
| `test:coverage` | `npm run test:coverage` | Tests with v8 coverage report |
| `lint` | `npm run lint` | ESLint across src/ and tests/ |
| `format` | `npm run format` | Prettier write |
| `migrate` | `npm run migrate` | Run pending DB migrations |

---

## Folder Structure

```
ticket/
├── docker-compose.yml      # LocalStack service definition
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
