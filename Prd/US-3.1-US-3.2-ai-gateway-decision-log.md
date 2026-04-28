# US-3.1 + US-3.2 AI Gateway Decision Log

This file records the planning decisions for the combined AI gateway connection and provider fallback implementation.

## Story

As a backend system, all AI calls must go through one standardized Portkey gateway boundary so worker code is insulated from provider details and fallback routing can happen without code changes.

## Locked Decisions

| # | Question | Answer | Reason |
|---|---|---|---|
| Q1 | Should US-3.1 and US-3.2 be implemented together? | Yes, combine them. | User provided both stories together and requested one implementation plan. |
| Q2 | Should Step 1 and Step 2 call the gateway now? | Yes. | Acceptance criteria requires both steps use the same AI interface. |
| Q3 | What should the gateway return? | Typed phase results plus provider metadata. | Workers should not parse raw SDK responses or provider-specific details. |
| Q4 | What if provider metadata is missing? | Throw a typed gateway contract error. | Provider recording is required and should remain truthful. |
| Q5 | How should gateway failures be exposed? | Throw `AiGatewayError` with `code`, `retryable`, and optional `status`. | The retry system can identify failures without knowing SDK internals. |
| Q6 | Where is fallback configured? | Portkey dashboard, documented in README. | Fallback is dashboard configuration, not application code. |
| Q7 | Should automated tests call live Portkey? | No, inject fake gateway responses. | Keeps local tests deterministic while README covers manual sandbox checks. |
| Q8 | Should the primary provider be hardcoded? | No, use `PORTKEY_PRIMARY_PROVIDER`. | The Portkey route can use OpenRouter, Groq, backend, or any other provider without source changes. |

## Implementation Notes

- Only `server/src/ai/**` may import `portkey-ai`.
- `PORTKEY_API_KEY`, `PORTKEY_CONFIG_ID`, and `PORTKEY_PRIMARY_PROVIDER` come from validated config.
- Non-primary providers write `provider_fallback` events.
