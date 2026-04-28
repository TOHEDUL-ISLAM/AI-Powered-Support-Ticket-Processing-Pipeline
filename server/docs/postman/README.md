<!-- US-DOCS: Postman collection and curl guide for the current API surface -->

# Postman And Curl Guide

This folder documents every current HTTP route in the backend.

Import this file into Postman:

```txt
server/docs/postman/ai-ticket-pipeline.postman_collection.json
```

Default collection variables:

```txt
ticketId = c1d6d148-4183-432a-8b6a-07233af725a5
```

If you run `POST /tickets - Create ticket success`, Postman automatically saves
the returned `ticketId` into the `ticketId` collection variable.

The collection uses literal URLs such as `http://localhost:3000/health`, not a
`{{baseUrl}}` variable.

## Routes

| Command | Route | Code path |
|---|---|---|
| Health check | `GET /health` | `src/routes/health.ts` -> `src/controllers/health.controller.ts` |
| Create ticket | `POST /tickets` | `src/routes/tickets.ts` -> `src/controllers/ticket.controller.ts#create` |
| Get ticket | `GET /tickets/:id` | `src/routes/tickets.ts` -> `src/controllers/ticket.controller.ts#get` |
| Replay ticket | `POST /tickets/:id/replay` | `src/routes/tickets.ts` -> `src/controllers/ticket.controller.ts#replay` |

## Start The Service

From the repo root:

```bash
uv run localstack start
```

From `server/` in another terminal:

```bash
npm run setup
npm run dev
```

## Curl Theory

`curl` sends HTTP requests from the terminal.

Common flags used here:

| Flag | Meaning |
|---|---|
| `-s` | Silent mode. Hides progress meter. Good for clean JSON output. |
| `-X POST` | Sets the HTTP method to `POST`. |
| `-H "Content-Type: application/json"` | Adds a request header. This tells Express the body is JSON. |
| `-d '{...}'` | Sends a request body. With `curl`, using `-d` usually implies `POST`. |
| `-w "\nHTTP %{http_code}\n"` | Prints metadata after the response, such as status code. |
| `-o /dev/null` | Discards the response body. Useful when measuring time. |

## 1. Health Check

```bash
curl -s http://localhost:3000/health | jq
```

Expected healthy shape:

```json
{
  "status": "ok",
  "service": "ai-ticket-pipeline",
  "version": "0.1.0",
  "dependencies": {
    "database": { "status": "ok", "latency_ms": 3 },
    "sqs_phase1": { "status": "ok", "latency_ms": 12 },
    "sqs_phase2": { "status": "ok", "latency_ms": 11 }
  },
  "checked_at": "2026-04-29T00:00:00.000Z"
}
```

What this proves:

- Express app is running.
- Postgres is reachable.
- Phase 1 SQS queue is reachable.
- Phase 2 SQS queue is reachable.
- No secrets or queue URLs are exposed.

## 2. Create Ticket - Success

```bash
curl -s -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{"subject":"Login broken","body":"I cannot log in to my account since yesterday.","submitter":"alice@example.com","tenant_id":"demo"}' \
  | jq
```

Expected response:

```json
{
  "ticketId": "c1d6d148-4183-432a-8b6a-07233af725a5",
  "status": "queued",
  "createdAt": "2026-04-29T00:00:00.000Z"
}
```

What this proves:

- Request validation passed.
- Ticket was inserted into Postgres.
- Ticket status started as `queued`.
- Ticket ID was placed into the Step 1 queue.
- API responded immediately with `202 Accepted`.

## 3. Create Ticket - Validation Error

```bash
curl -s -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{"subject":"","body":"","submitter":"","tenant_id":""}' \
  | jq
```

Expected response:

```json
{
  "error": "validation_error",
  "issues": [
    { "field": "subject", "message": "subject is required" },
    { "field": "body", "message": "body is required" },
    { "field": "submitter", "message": "submitter is required" },
    { "field": "tenant_id", "message": "tenant_id is required" }
  ]
}
```

What this proves:

- Bad input is rejected before DB or queue work.
- The client gets clear field-level errors.

## 4. Get Ticket By ID

Use your successful ticket ID:

```bash
curl -s http://localhost:3000/tickets/c1d6d148-4183-432a-8b6a-07233af725a5 | jq
```

Expected response shape:

```json
{
  "ticketId": "c1d6d148-4183-432a-8b6a-07233af725a5",
  "tenantId": "demo",
  "submitter": "alice@example.com",
  "subject": "Login broken",
  "status": "completed",
  "createdAt": "2026-04-29T00:00:00.000Z",
  "updatedAt": "2026-04-29T00:00:05.000Z",
  "phases": {
    "triage": {
      "status": "success",
      "attemptCount": 1,
      "result": {}
    },
    "resolution": {
      "status": "success",
      "attemptCount": 1,
      "result": {}
    }
  }
}
```

What this proves:

- Ticket can be read from the database.
- Step 1 and Step 2 phase results are returned together.
- Internal DB column names are shaped into API-friendly camelCase fields.

## 5. Get Ticket - Invalid UUID

```bash
curl -s http://localhost:3000/tickets/not-a-uuid | jq
```

Expected response:

```json
{
  "error": "invalid_ticket_id"
}
```

What this proves:

- Route parameter validation is active.
- Invalid IDs do not reach the database query layer.

## 6. Get Ticket - Not Found

```bash
curl -s http://localhost:3000/tickets/00000000-0000-0000-0000-000000000000 | jq
```

Expected response:

```json
{
  "error": "ticket_not_found"
}
```

What this proves:

- A valid UUID with no DB row returns `404`.

## 7. Replay Permanently Failed Ticket

This only succeeds for a ticket whose main status is `failed` and whose failed
phase has status `permanently_failed`.

```bash
curl -s -X POST http://localhost:3000/tickets/<failed-ticket-id>/replay | jq
```

Expected success:

```json
{
  "ticketId": "<failed-ticket-id>"
}
```

What this proves:

- Manual recovery works.
- Only the failed phase is reset.
- Successful previous phases are not repeated.
- The ticket ID is requeued into the correct queue.

## 8. Replay Ticket - Not Failed

Use a queued, processing, or completed ticket:

```bash
curl -s -X POST http://localhost:3000/tickets/c1d6d148-4183-432a-8b6a-07233af725a5/replay | jq
```

Expected response:

```json
{
  "error": "ticket_not_permanently_failed"
}
```

What this proves:

- Replay cannot be used on tickets that are not permanently failed.
- The service protects successful or in-progress work from accidental replay.

## 9. Replay Ticket - Invalid UUID

```bash
curl -s -X POST http://localhost:3000/tickets/not-a-uuid/replay | jq
```

Expected response:

```json
{
  "error": "invalid_ticket_id"
}
```

## 10. Replay Ticket - Not Found

```bash
curl -s -X POST http://localhost:3000/tickets/00000000-0000-0000-0000-000000000000/replay | jq
```

Expected response:

```json
{
  "error": "ticket_not_found"
}
```

## Database Check For Saved Tickets

From the repo root:

```bash
docker compose exec postgres psql -U ticket_user -d ai_ticket_pipeline -c \
"SELECT id, subject, status, created_at
 FROM tickets
 ORDER BY created_at DESC
 LIMIT 10;"
```

Only completed tickets:

```bash
docker compose exec postgres psql -U ticket_user -d ai_ticket_pipeline -c \
"SELECT id, subject, status, created_at
 FROM tickets
 WHERE status = 'completed'
 ORDER BY created_at DESC
 LIMIT 10;"
```

Tickets with phase status:

```bash
docker compose exec postgres psql -U ticket_user -d ai_ticket_pipeline -c \
"SELECT
   t.id,
   t.status AS ticket_status,
   p.step_name,
   p.status AS phase_status,
   p.provider_used,
   p.created_at
 FROM tickets t
 LEFT JOIN ticket_phases p ON p.ticket_id = t.id
 ORDER BY t.created_at DESC, p.step_name;"
```
