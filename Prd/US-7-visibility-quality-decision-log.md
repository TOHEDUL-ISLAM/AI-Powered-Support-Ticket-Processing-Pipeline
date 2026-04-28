# US-7 Visibility and Quality Assurance Decision Log

This file records the planning decisions for the Epic 7 MVP implementation.

## Story

As an engineering and operations team, we need structured logs and reliable automated tests so the AI ticket pipeline can be observed, debugged, and verified before release.

## Locked Decisions

| # | Question | Answer | Reason |
|---|---|---|---|
| Q1 | What does the 80% coverage target apply to? | Core business logic only. | The PRD says core business logic, so startup wiring, migrations, and type-only files are excluded. |
| Q2 | How should base logger context be added? | Use Pino `base` fields for `service`, `environment`, and `version`. | Every log gets consistent context without repeating fields manually. |
| Q3 | Should local logs be human-readable? | Use `pino-pretty` only when `NODE_ENV=development`. | Local development is readable; test/production remain structured JSON. |
| Q4 | How should ad-hoc output be prevented? | Replace runtime `console.*` and make ESLint `no-console` an error. | Enforces central logger usage automatically. |
| Q5 | How should pipeline event names be standardized? | Keep detailed `event`, add `pipelineEvent` for the eight Epic 7 categories. | Preserves useful detail while making logs easy to reconstruct. |
| Q6 | How should durations be measured? | Use `Date.now()` inside Step 1 and Step 2 services. | Good enough for MVP without introducing tracing infrastructure. |
| Q7 | Where should provider fallback be logged? | In Step 1 and Step 2 services when gateway response has `fallback: true`. | The services have provider metadata before persistence. |
| Q8 | Where should retry scheduling be logged? | In workers. | Workers own SQS visibility timeout and retry delay decisions. |
| Q9 | Where should permanent failure be logged? | In Step 1 and Step 2 services after permanent failure is saved. | The service owns the state transition. |
| Q10 | Where should pipeline completion be logged? | In Step 2 service after final status readback succeeds. | Completion means DB state is saved and readable. |
| Q11 | Where should replay be logged? | In `TicketService.replay()` after DB reset and queue enqueue both succeed. | Replay is only real after durable reset plus queue placement. |
| Q12 | Should detailed errors appear in logs? | Yes, but still pass through logger redaction. | Logs are for engineering; API/socket payloads stay sanitized. |
| Q13 | Should redaction be tested? | Yes. | Proves sensitive values do not appear in log output. |
| Q14 | Should logs be JSON-parse tested? | Yes. | Directly proves machine-readable structured logs. |
| Q15 | Should base fields be tested? | Yes. | Directly proves US-7.1 checklist fields. |
| Q16 | Should log level be tested? | Yes. | Confirms logging can be controlled without code changes. |
| Q17 | Should console use be lint-enforced? | Yes. | Prevents future drift away from the central logger. |
| Q18 | Should pipeline event constants be centralized? | Yes, in the logger module. | Avoids string drift without a large abstraction. |
| Q19 | Should a big logging helper abstraction be created? | No. | Direct logger calls with shared constants are simpler and fit the existing code. |
| Q20 | What field name should durations use? | `durationMs`. | Clear unit and common camelCase style. |
| Q21 | What field name should retry delay use? | `retryDelayMs`. | Clear unit and matches `durationMs`. |
| Q22 | What field name should AI provider use? | `providerUsed`. | Matches existing API/socket response naming. |
| Q23 | What step names should be used? | `triage` and `resolution`. | Matches current domain language. |
| Q24 | What attempt field name should be used? | `attempt`. | Matches current worker/service code. |
| Q25 | How should pipeline logs be tested? | Focused unit tests with fake loggers. | Fast and deterministic. |
| Q26 | Should full log reconstruction be automated in integration tests now? | No, document it as manual QA. | Avoids brittle log capture across real SQS workers. |
| Q27 | Should coverage thresholds be enforced? | Yes, 80% for core business logic. | Makes US-7.3 measurable. |
| Q28 | What is the official coverage command? | `npm run test:coverage`. | Already present in package scripts. |
| Q29 | Should integration tests run three times by script? | No, document manual three-run QA. | Keeps default local commands practical. |
| Q30 | Should README be updated? | Yes. | Developers need a clear Epic 7 verification checklist. |
| Q31 | Should this decision log be created? | Yes. | Keeps future planning traceable. |
| Q32 | Is US-7.5 to US-7.7 in MVP scope? | No. | PRD marks E2E, tracing, and load testing as Post-MVP. |
| Q33 | What implementation style should be used? | Existing OOP/layered style; no major framework/refactor. | Pragmatic and consistent with the current architecture. |

