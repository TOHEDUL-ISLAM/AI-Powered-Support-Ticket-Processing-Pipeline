# US-2.1 Step 1 Worker Decision Log

This file records the design questions and answers for US-2.1 — Step 1 Worker (Triage Processor). It is the source of truth for implementation decisions made during planning.

## Story

As the backend system, we need a dedicated Step 1 worker that monitors the phase1 SQS queue, processes ticket triage jobs, preserves completed work, and only removes messages after successful persistence.

## Locked Decisions

| # | Question | Answer | Reason |
|---|---|---|---|
| Q1 | Should US-2.1 implement the triage worker with a stub processor or real Portkey AI? | Stub processor for US-2.1; real Portkey comes later. | US-2.1 is about worker lifecycle, queue consumption, checkpointing, DB state, and message deletion. AI gateway/triage analysis belongs to later stories. |
| Q2 | Should the Step 1 worker follow the existing OOP constructor-injection style? | Yes, use OOP classes with constructor injection. | Matches the current project architecture and keeps dependencies explicit/testable. |
| Q3 | How should the worker receive/delete SQS messages? | Use a separate consumer adapter. | Producer and consumer responsibilities stay separate; `TicketQueue` remains focused on enqueueing. |
| Q4 | Should the Step 1 worker start automatically when the API server starts? | Yes, start automatically from `server.ts` after HTTP startup. | The checklist explicitly requires automatic startup on application startup. |
| Q5 | What should the worker do with malformed SQS messages? | Log and delete. | A malformed message has no valid `ticketId`, so it cannot be retried meaningfully. |
| Q6 | What should happen when a message has a valid-looking `ticketId`, but no ticket exists in DB? | Log and delete for MVP. | There is no ticket state to recover; DLQ is reserved for real processing failures on valid ticket messages. |
| Q7 | What should the worker do on real processing failure? | Do not delete the SQS message. | SQS should retry; after `maxReceiveCount=3`, LocalStack/SQS moves the message to `phase1DLQ`. |
| Q8 | What should the stub processor save as the triage result? | Save a real-shaped triage stub. | Keeps saved data close to the future AI output shape and makes tests more representative. |
| Q9 | When the stub processor starts processing a valid ticket, what should it set first? | Create/update the triage `ticket_phases` row to `running` before stub work, then set it to `success` after saving the result. | Matches the checklist: Step 1 must be marked in progress before work starts and success only after the result is saved. The DB status value is `running`. |
| Q10 | Should the worker update the main `tickets.status` during Step 1? | Update `tickets.status` to `processing` when Step 1 starts. | The main ticket record should show that background processing has begun; the phase row gives detailed step status. |
| Q11 | Should the worker insert `ticket_events` rows during Step 1? | Yes. Insert `step_started` when triage becomes `running`, and `step_completed` when triage becomes `success`. | The project already has an audit table; background processing should build the audit trail from the first worker story. |
| Q12 | Should Step 1 completion automatically enqueue Phase 2 now? | No. Do not enqueue Phase 2 in US-2.1. | US-2.1 is only the Step 1 worker story. Automatic handoff to Phase 2 belongs to US-2.3. |
| Q13 | How should graceful shutdown work? | Stop receiving new messages, wait for the current in-flight message to finish, then exit. | Satisfies the checklist and prevents half-finished work. MVP worker processes one message at a time. |
| Q14 | Should the worker process one message at a time or multiple messages in parallel? | One message at a time for US-2.1. | Correctness first: easier checkpointing, graceful shutdown, testing, and debugging. Configurable concurrency can come later. |
| Q15 | Should Step 1 worker tests use real LocalStack SQS or a fake in-memory queue adapter? | Use real LocalStack SQS for worker tests. | User selected real SQS behavior for higher production realism, accepting slower/more environment-dependent tests. |
| Q16 | How should integration tests avoid accidentally consuming real queued tickets from manual testing? | Purge `phase1Queue` before the worker integration test suite. | Clean queue state is easier to reason about. Purging once before the suite reduces SQS purge throttling risk. |
| Q17 | Should the Step 1 worker update `attempt_count` in US-2.1? | Yes. Increment `attempt_count` when setting triage to `running`. | Each real processing start is an attempt. Later retry behavior can build on this field. |
| Q18 | Should `started_at` be overwritten if a message is retried? | No. Keep original `started_at`; only set it if null. | `started_at` represents when the phase first started. Attempt timing can later be recorded in `ticket_events.metadata`. |
| Q19 | What should checkpoint skip do when triage is already `success`? | Delete the SQS message without changing DB or calling the processor. | Completed work must be preserved and not repeated. |
| Q20 | What should the worker log? | Log worker lifecycle and message outcomes. | Background work needs structured observability: started, received, malformed, not found, triage started/completed/already complete/failed, message deleted, stopped. |
| Q21 | Should US-2.1 include unit tests, integration tests, or both? | Both unit and integration tests. | Unit tests make edge cases precise; real Postgres + LocalStack SQS integration tests prove end-to-end worker behavior. |
| Q22 | How should the worker loop stop during tests? | Expose `start()` and `stop()`; tests start the worker, wait for expected DB state, then stop it. | Exercises the real worker loop and graceful shutdown behavior. |
| Q23 | Should `server.ts` close the HTTP server and DB pool during shutdown too? | Yes. On `SIGTERM`/`SIGINT`, stop the worker, close the HTTP server, then call `pool.end()`. | Professional graceful shutdown should clean up all major resources, not just the worker. |
| Q24 | Where should the worker start? | Start the worker only in `server.ts`, not inside `createApp()`. | `createApp()` is used by tests; automatic polling there would make tests flaky and could consume real queue messages. |
| Q25 | How should worker dependencies be wired? | Create a small `src/bootstrap.ts` or container-style module to wire worker dependencies. | Keeps `server.ts` focused as the entrypoint and leaves room for workers, AI, realtime, and replay wiring to grow cleanly. |
| Q26 | What should the worker polling settings be for MVP? | Long poll SQS with `waitSeconds=20`, `max=1`, `visibilityTimeout=90`. | Long polling is the normal SQS pattern and matches the current queue visibility timeout setup. |
| Q27 | What should happen if the worker receives a duplicate message while triage is already `running`? | Treat it as already in progress: do not process and do not delete; let SQS retry later. | Avoids duplicate processing if another process is already working on the same phase. |
| Q28 | Should the stub processor simulate a small delay? | Yes, add a short delay like `100ms`. | Makes graceful shutdown and in-flight processing tests meaningful. |
| Q29 | Should the worker validate `ticketId` as UUID? | Yes, require valid UUID format before DB lookup. | Bad IDs are malformed queue messages; validate early, log, and delete. |
| Q30 | Should malformed message logs include the raw message body? | Include a truncated raw body, max 500 chars. | Helps debug bad internal queue messages while avoiding huge logs. |
| Q31 | Should the worker update `finished_at` on success? | Yes, set `finished_at=now()` when triage becomes `success`. | Phase timing fields should prove when success was persisted. |
| Q32 | Should the worker clear `error_message` when success happens? | Yes, set `error_message=null` on success. | Prevents stale error text from remaining after a successful retry. |
| Q33 | Should the worker set `provider_used` for the stub result? | Yes, set `provider_used='stub'`. | Tests can verify stub processing; real Portkey later replaces this with the actual provider. |
| Q34 | Should Step 1 started/success DB writes use transactions? | Yes, use transactions for multi-table writes. | Updates to `ticket_phases`, `tickets`, and `ticket_events` must succeed or fail together. |
| Q35 | Should `step_started` event metadata include attempt count? | Yes, include `{ attempt }`. | Attempt count is important for debugging retries later. |
| Q36 | Should `step_completed` event metadata include provider and stub flag? | Yes, include `{ provider_used: "stub", stub: true }`. | Makes the audit trail clear that the result was produced by the temporary stub processor. |
| Q37 | Should the worker delete the SQS message after checkpoint skip success? | Yes, delete the duplicate message when triage is already `success`. | Completed work should not repeat; the duplicate message is no longer useful. |
| Q38 | Should the worker delete the SQS message after ticket-not-found? | Yes, log and delete. | No DB ticket means no recoverable state; retrying will not create the missing ticket. |
| Q39 | Should the worker create a new repository or extend `TicketRepository` for phase operations? | Create a `TriageRepository` or `PhaseRepository` for phase-specific DB operations. | Phase lifecycle data access is separate from ticket creation/status reading and will grow. |
| Q40 | What should the processor class be called? | `TriageStepService`. | Matches business language: triage is the domain step; Phase 1 is pipeline ordering. |
| Q41 | What should the worker class be called? | `Phase1Worker`. | Matches the queue/checklist wording and mirrors the future `Phase2Worker`. |
| Q42 | What should happen if worker receives a message for triage status `failed`? | Process it again and increment `attempt_count`. | `failed` is transient; retry should re-run the step. Later retry logic controls max attempts. |
| Q43 | What should happen if worker receives a message for triage status `permanently_failed`? | Delete the message and do not process. | Permanent failure is terminal for normal queue processing; replay later resets state intentionally. |
| Q44 | Should the worker check ticket existence before checking phase status? | Yes, first load ticket; if missing, log and delete. | The ticket is the parent record. No ticket means no valid job. |
| Q45 | Should `TriageStepService` fetch the ticket body/subject now? | Yes, fetch ticket details even though the stub does not use them yet. | Real Portkey triage later will need subject/body; shaping the service around full ticket data now avoids refactor later. |
| Q46 | Should the worker parse SQS message body in the worker or in the queue consumer adapter? | The worker parses the body. | The consumer adapter should stay generic SQS receive/delete; the worker owns job-specific validation like `ticketId`. |
| Q47 | Should the worker support `stop()` timeout? | Yes, wait up to 90 seconds for in-flight work, then return/log timeout. | Graceful shutdown should wait but not hang forever. 90 seconds matches visibility timeout. |
| Q48 | Should `stop()` delete the active message if timeout happens? | No, do not delete on timeout. | If shutdown timed out, processing is not proven complete. Leaving the message lets SQS retry. |

## Current Q8 Stub Result Shape

```json
{
  "category": "general",
  "priority": "medium",
  "sentiment": "neutral",
  "escalation_needed": false,
  "routing_target": "tier1",
  "summary": "Stub triage result for worker verification"
}
```

## Decision Logging Rule

From this point forward, every new planning question and answer for US-2.1 must be appended to this file before implementation proceeds.
