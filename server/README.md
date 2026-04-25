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
| PostgreSQL | 16 | running locally or via connection string |
| AWS CLI | v2 | for queue provisioning |
| LocalStack | 2026.3+ | installed in the repo-root Python venv via `uv` |

---

## Installation

1. **Clone the repo and enter the service directory**
   ```bash
   git clone <repo-url>
   cd ticket/server
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Copy the environment template and fill in values**
   ```bash
   cp .env.example .env
   # edit .env — DATABASE_URL and the SQS URLs are required
   ```

4. **Start LocalStack** (from the repo root, not /server — leave this terminal open)
   ```bash
   cd ..                    # repo root
   uv run localstack start  # uses the Python venv; runs LocalStack in Docker mode
   cd server
   ```

5. **Provision the database and SQS queues**
   ```bash
   npm run setup:infra
   ```

6. **Start the dev server**
   ```bash
   npm run dev
   ```

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start with hot-reload via tsx |
| `build` | `npm run build` | Compile TypeScript → dist/ |
| `start` | `npm start` | Run compiled output |
| `test` | `npm test` | Run all tests (vitest) |
| `test:unit` | `npm run test:unit` | Unit tests only |
| `test:integration` | `npm run test:integration` | Integration tests (sequential) |
| `test:e2e` | `npm run test:e2e` | End-to-end tests |
| `test:coverage` | `npm run test:coverage` | Tests with v8 coverage report |
| `lint` | `npm run lint` | ESLint across src/ and tests/ |
| `format` | `npm run format` | Prettier write |
| `migrate` | `npm run migrate` | Run pending DB migrations |
| `setup:infra` | `npm run setup:infra` | Provision Postgres DB + SQS queues |

---

## Infrastructure Setup

Ensure LocalStack is running first (`localstack start` from repo root), then:

```bash
npm run setup:infra
```

**Expected output:**
```
[setup] Waiting for LocalStack to be ready...
[setup] LocalStack is ready.
[setup] Creating SQS queues...
[setup]   ✓ phase1DLQ
[setup]   ✓ phase2DLQ
[setup]   ✓ phase1Queue  (redrive → phase1DLQ, maxReceiveCount=3)
[setup]   ✓ phase2Queue  (redrive → phase2DLQ, maxReceiveCount=3)
[setup] Creating PostgreSQL database...
[setup]   ✓ Database 'ai_ticket_pipeline' ready.
[setup] Done. Infrastructure is ready.
```

Running the script a second time is safe — all operations are idempotent.

---

## Folder Structure

```
server/
├── src/
│   ├── config/         # zod-validated env config
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
├── scripts/
│   └── setup-infra.sh  # one-shot infra provisioning
├── .env.example
├── tsconfig.json
└── vitest.config.ts
```
