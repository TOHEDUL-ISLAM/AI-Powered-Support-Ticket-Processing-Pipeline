# US-6 Live Updates Decision Log

This file records the planning decisions for the Epic 6 MVP realtime notification implementation.

## Source Of Truth

`Prd/document_pdf.pdf` is the real source of truth. The board stories for US-6.1 through US-6.3 refine the realtime implementation details.

## Story

As a support agent or manager, clients need live ticket updates over Socket.io so they can see pipeline progress and final results without refreshing or polling.

## Locked Decisions

| # | Question | Answer | Reason |
|---|---|---|---|
| Q1 | Should Epic 6 implement MVP only? | Yes, implement US-6.1 through US-6.3 only. | US-6.4 multi-server support and US-6.5 connection security are marked Post-MVP and require separate infrastructure/auth work. |
| Q2 | Should Socket.io use one event name or many? | Use one event name: `ticket:update`. | A single event with a typed payload is easier for clients, tests, and future event additions. |
| Q3 | What room names should be used? | `ticket:{ticketId}` and `tenant:{tenantId}`. | Matches existing ticket room convention and provides clear tenant-wide fanout. |
| Q4 | Should subscription events use acknowledgements? | Yes. | Clients and tests can confirm whether room join succeeded. |
| Q5 | What should the final completion payload contain? | Put the exact `GET /tickets/:id` response inside `data`. | US-6.3 requires the completion notification to match the ticket status endpoint. |
| Q6 | How should PDF "progress" map to events? | Use `step_started`, `step_completed`, and `step_failed` as progress lifecycle events. | The system has step lifecycle progress, not percentage progress. |
| Q7 | Should socket delivery create duplicate `ticket_events` rows? | No. | `ticket_events` stores business history; Pino logs socket connection/subscription/delivery observability. |
| Q8 | Should subscription validate ticket/tenant existence? | No, shape validation only for MVP. | Authorization and ownership checks belong to US-6.5 Post-MVP. |
| Q9 | Where should realtime payload types live? | Keep MVP realtime types and helpers in `server/src/realtime/index.ts`. | The module is still small; splitting now would add unnecessary abstraction. |
| Q10 | Should failed attempt notifications include raw error messages? | No, send sanitized reasons only. | Raw errors may expose provider, URL, credential, or internal details. |
| Q11 | When should `step_completed` be emitted? | Only after the step result is saved to the database. | The database is the source of truth; avoid false success notifications. |
| Q12 | When should `pipeline_completed` be emitted? | After Step 2 DB transaction completes and ticket status is read back. | Ensures final payload matches `GET /tickets/:id`. |
| Q13 | Should socket notification failure fail the worker? | No, log it only. | Socket delivery is best-effort; successful DB work should not be retried because a live emit failed. |
| Q14 | What notification service interface should be used? | Use one method: `publishTicketUpdate(payload)`. | One service method maps cleanly to the single `ticket:update` event. |
| Q15 | Should every update go to both ticket and tenant rooms? | Yes. | Satisfies per-ticket visibility and tenant-wide manager visibility. |
| Q16 | Where should workers get `tenantId` for notifications? | Read `tenant_id` from the ticket record in worker repository queries. | Keeps SQS messages minimal as `{ ticketId }`. |
| Q17 | Where should socket payload timestamps come from? | App time at emit moment using `new Date().toISOString()`. | Socket payload timestamps describe delivery events; DB stores persistent event timestamps. |
| Q18 | What Socket.io event naming style should be used? | Colon-based names: `subscribe:ticket`, `subscribe:tenant`, `ticket:update`. | Clear namespace convention and consistent with existing style. |
| Q19 | Should a manual socket test client be added? | Yes. | Curl cannot test Socket.io; a small terminal client makes demos and QA practical. |
| Q20 | Should `socket.io-client` be added? | Yes, as a dev dependency. | Needed for real client integration tests and the manual script. |
| Q21 | Should room tests use real Socket.io server/client? | Yes. | Room isolation is the core requirement and should be tested with real socket behavior. |
| Q22 | Should tests be dedicated realtime tests or worker tests? | Both, focused by responsibility. | Realtime tests prove rooms; worker/service tests prove event timing and payload content. |
| Q23 | Should `ticket:update` payload include ticket `status`? | Include it only when useful. | Avoid duplicate fields that can drift; final payloads already include full status data. |
| Q24 | Should subscription handlers log socket ID? | Yes. | Connection and subscription logs need enough context for debugging. |
| Q25 | Should tenant subscription use `tenantId` or `tenant_id`? | Use `tenantId`. | Realtime payloads follow frontend-friendly camelCase; REST create keeps `tenant_id`. |
| Q26 | Should ticket subscription use `ticketId` or `ticket_id`? | Use `ticketId`. | Matches existing API response shape and the `tenantId` realtime style. |
| Q27 | Should implementation start after final edge questions? | Continue briefly, then implement. | A few delivery/failure edges still affected the implementation. |
| Q28 | Should `publishTicketUpdate` catch its own errors? | Yes. | Socket delivery must not fail worker processing. |
| Q29 | What if final status readback fails? | Log and skip the final notification. | The DB work already succeeded; do not retry business processing for a delivery issue. |
| Q30 | What shape should permanent failure use? | Use `ticket_failed` with `failedStep`, sanitized `reason`, and full `data`. | Matches US-6.3 and keeps raw errors private. |
| Q31 | What shape should retryable failed attempts use? | Use `step_failed`; reserve `ticket_failed` for permanent failure. | Keeps attempt failure distinct from final ticket failure. |
| Q32 | When should `step_failed` emit? | After `markFailed()` succeeds. | Live state should reflect persisted state. |
| Q33 | When should `step_started` emit? | After `markRunning()` succeeds. | The DB provides the real attempt number and durable running state. |
| Q34 | Should `step_completed` include `providerUsed`? | Yes, for both steps. | Required by US-6.2 and useful for provider observability. |
| Q35 | Should `step_completed` include `fallback`? | Yes. | Aligns with fallback observability in the PDF source requirement. |
| Q36 | Should `step_completed` include `attempt` too? | Yes. | All step lifecycle events should show the attempt they belong to. |
| Q37 | Should Socket.io setup stay in `server.ts`? | Yes. | Socket.io attaches to the HTTP server owned by `server.ts`. |
| Q38 | Should room subscription setup live in `server/src/realtime/index.ts`? | Yes. | Realtime connection behavior belongs in the realtime module. |
| Q39 | Should there be a `registerRealtimeHandlers(io, logger)` helper? | Yes. | Keeps `server.ts` runtime wiring clean. |
| Q40 | Should successful publishes be logged? | Yes, lightly. | Log event type, ticket ID, tenant ID, and rooms; never log full final payload. |
| Q41 | Should socket step payloads include subject/body? | No, except final `data` mirrors `GET /tickets/:id`. | Step events should be compact and avoid unnecessary sensitive text. |
| Q42 | Should failed notifications include internal error text? | No. | Raw errors can leak provider, URL, credential, or internal details. |
| Q43 | Should tenant and ticket rooms receive identical payloads? | Yes. | Same event data across different subscription scopes is simpler and testable. |
| Q44 | Should the manual socket script support ticket and tenant mode? | Yes. | Both room types need terminal demo coverage. |
| Q45 | Should README include socket test instructions? | Yes. | The project needs a clear showcase path. |
| Q46 | Should invalid subscription payloads be tested? | Yes. | Ack errors are part of the room-management contract. |
| Q47 | Should realtime integration test ticket isolation? | Yes. | This is core US-6.1 behavior. |
| Q48 | Should realtime integration test tenant fanout? | Yes. | This proves tenant-wide subscriptions work. |
| Q49 | Should worker/service tests assert notification ordering? | Yes, focused ordering. | Verifies persisted-state timing without brittle full end-to-end socket tests. |
| Q50 | Should Epic 6 implementation begin after these decisions? | Yes. | The plan was decision-complete enough to implement. |
