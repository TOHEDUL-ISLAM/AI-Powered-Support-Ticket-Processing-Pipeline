# US-2.2 + US-2.3 Resolution Worker and Handoff Decision Log

This file records the planning decisions for the combined US-2.2 Step 2 Worker and US-2.3 Automatic Handoff implementation.

## Story

As a backend system, we need a dedicated Step 2 worker monitoring the Step 2 queue, and Step 1 must automatically place tickets into that queue after successful triage so the pipeline continues without a manual trigger.

## Locked Decisions

| # | Question | Answer | Reason |
|---|---|---|---|
| Q1 | Should US-2.2 and US-2.3 be implemented together? | Yes, combine them. | User explicitly provided both stories and requested combined work. |
| Q2 | Should Step 2 call real AI now? | No, use a realistic stub resolution result. | Epic 2 covers processing mechanics; AI gateway and prompt work are separate PRD epics. |
| Q3 | What if Step 2 receives a message before Step 1 is successful? | Log graceful failure and do not delete the message. | Queue messages are deleted only after durable successful work. |
| Q4 | What if resolution is already successful? | Delete the duplicate message and skip processing. | Completed work must not be repeated. |
| Q5 | What should happen after resolution success? | Update `tickets.status` to `completed`. | Step 2 is the final current pipeline phase. |
| Q6 | How should Step 1 handoff be coordinated? | Enqueue Step 2 before marking triage `success`; if enqueue fails, leave Step 1 message retryable. | Satisfies US-2.3: Step 1 success only after Step 2 queue placement succeeds. |
| Q7 | Should handoff be stored in the audit log? | Yes, insert `step_handoff` into `ticket_events`. | The checklist requires a persisted handoff event. |
| Q8 | Where should Step 2 logic live? | Separate `ResolutionRepository`, `ResolutionStepService`, and `Phase2Worker`. | Keeps Step 2 rules separate and easy to test. |
| Q9 | What if the Step 2 ticket is missing? | Log and delete the message. | Retrying cannot recover a missing parent record. |

## Stub Resolution Result

```json
{
  "customer_reply": "Thanks for contacting support. We are reviewing your request and will follow up with next steps.",
  "internal_note": "Stub resolution draft generated after successful triage.",
  "recommended_actions": ["Review triage metadata", "Assign to the suggested support queue"]
}
```
