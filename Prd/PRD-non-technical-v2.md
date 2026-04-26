# AI-Powered Support Ticket Processing Pipeline
### Product Requirements Document — Business Edition

---

| Field | Detail |
|---|---|
| **Document Version** | 2.0 — Final |
| **Methodology** | Kanban Agile — Continuous Flow Delivery |
| **Audience** | Product, Business, Operations, Leadership |
| **Status** | Approved |
| **Last Updated** | 2026-04-23 |
| **Delivery Model** | 1-Week MVP Flow + Ongoing Post-MVP Backlog |
| **Source** | Original PRD + Confirmed Decision Log + Project Overview |

> This document is written for a non-technical audience. It describes what the product does, who it serves, why it matters, and what gets built — without technical implementation details. For the full engineering specification, refer to the Technical PRD v3.0.

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [The Problem We Are Solving](#2-the-problem-we-are-solving)
3. [Who This Serves](#3-who-this-serves)
4. [How It Works — Plain English](#4-how-it-works--plain-english)
5. [Goals & Success Metrics](#5-goals--success-metrics)
6. [What Happens When Something Goes Wrong](#6-what-happens-when-something-goes-wrong)
7. [Kanban Board & Workflow](#7-kanban-board--workflow)
8. [Epics & User Stories](#8-epics--user-stories)
    - [Epic 1 — The Foundation](#epic-1--the-foundation)
    - [Epic 2 — The Processing Engine](#epic-2--the-processing-engine)
    - [Epic 3 — The AI Brain](#epic-3--the-ai-brain)
    - [Epic 4 — The AI Pipeline](#epic-4--the-ai-pipeline)
    - [Epic 5 — Reliability & Recovery](#epic-5--reliability--recovery)
    - [Epic 6 — Live Updates](#epic-6--live-updates)
    - [Epic 7 — Visibility & Quality Assurance](#epic-7--visibility--quality-assurance)
9. [MVP Summary](#9-mvp-summary)
10. [1-Week Kanban Delivery Flow](#10-1-week-kanban-delivery-flow)
11. [Risks & Dependencies](#11-risks--dependencies)
12. [Open Questions](#12-open-questions)
13. [Glossary of Key Terms](#13-glossary-of-key-terms)

---

## 1. What We Are Building

We are building an **automated support ticket processing service** — a backend system that receives customer support tickets and runs them through a two-step AI pipeline automatically, without any human involvement in the processing itself.

**Step 1 — Triage.** The system reads the ticket and produces a structured classification: what type of issue it is, how urgent it is, what the customer's emotional state appears to be, whether it needs immediate escalation, which team should handle it, and a concise plain-English summary.

**Step 2 — Resolution Draft.** Using the original ticket and the triage output from Step 1, the system generates a customer-facing reply draft, a short internal note for the agent, and a list of recommended next actions.

The entire process happens in the background. The moment results are ready — typically within a minute — they are delivered live to the support agent's screen without any refresh or manual action required.

No ticket is ever lost. If the system encounters a problem, it retries automatically. If it cannot recover on its own, the ticket is held safely and can be re-processed with a single action from the operations team.

---

## 2. The Problem We Are Solving

Support teams at growing SaaS companies face four consistent challenges as ticket volume increases:

**Slow triage.** Every ticket is read and classified manually before meaningful work begins. This adds minutes to every single ticket — time that compounds at scale.

**Inconsistency.** Different agents classify and respond to similar tickets differently depending on the day, the agent, and the workload. This creates uneven customer experiences that are hard to measure and harder to fix.

**Poor scalability.** As the customer base grows, ticket volume grows with it. The only solution without automation is hiring more agents — a linear cost response to a compounding problem.

**Slow first response.** Time-to-first-meaningful-response is one of the most important support metrics. Manual triage delays this unnecessarily on tickets where the category, priority, and appropriate response are predictable.

This service eliminates all four problems by automating triage and response drafting entirely — freeing support agents to focus on judgment, escalation, and relationship quality rather than mechanical classification.

---

## 3. Who This Serves

### Support Agent
The agent receives AI-generated triage data and a ready-to-review response draft the moment a ticket finishes processing. Instead of starting from a blank page, they review, refine, and approve.

**What changes for them:** Less cold-reading of tickets, faster first responses, more consistent quality across the team, less mental overhead on routine tickets.

### Support Team Lead / Manager
The manager sees tickets classified and escalated in real time. High-priority and escalation-flagged tickets surface immediately — before an agent would otherwise notice them in a manual queue.

**What changes for them:** Faster visibility into critical tickets, consistent classification standards team-wide, easier quality auditing.

### Operations / Platform Team
The operations team can monitor the health of the processing pipeline, see which tickets are stuck or failed, and replay failed tickets without any engineering involvement.

**What changes for them:** Self-service recovery tools, full audit trail on every ticket, no need to escalate routine failures to engineering.

### Product & Leadership
The business gets measurable improvement in time-to-triage and time-to-first-response, a consistent quality baseline at any ticket volume, and a foundation that scales without proportional headcount growth.

**What changes for them:** Improved support metrics, reduced cost per ticket, a platform that grows with the business.

---

## 4. How It Works — Plain English

Here is the complete journey of a support ticket through the system, from submission to result.

---

**A ticket arrives.**
A customer submits a support ticket through the existing platform. The system records it immediately and confirms receipt within half a second — it never makes the client wait for AI processing before acknowledging the submission.

---

**The ticket enters the processing queue.**
The ticket is placed into a managed waiting list for Step 1. Think of it like a numbered ticket at a deli counter. The system tracks every ticket's position, status, and history — and will not lose it even if something goes wrong mid-process.

---

**Step 1 — Triage runs automatically.**
A background process picks up the ticket and sends it to the AI gateway. The AI reads the ticket and returns six structured outputs:

| Output | What It Means |
|---|---|
| **Category** | Type of issue — billing, technical, account access, etc. |
| **Priority** | Urgency level — low, medium, high, or critical |
| **Sentiment** | Customer's apparent emotional state — positive, neutral, negative, or frustrated |
| **Escalation Needed** | Whether immediate escalation is required — yes or no |
| **Routing Target** | Which team or agent type should handle it |
| **Summary** | A plain-English summary of the customer's core need, max 200 characters |

Every output is checked for completeness and correct format before being saved. If anything is missing or malformed, the system retries — an agent never sees a broken or incomplete triage result.

---

**The ticket moves to Step 2.**
The moment Step 1 is confirmed as complete and saved, the ticket automatically moves into the Step 2 queue. No manual action. No waiting. No orchestration.

---

**Step 2 — Resolution Draft is generated.**
A second background process picks up the ticket. Using both the original ticket content and the Step 1 triage output as context, the AI produces:

- A **customer-facing reply draft** — professional tone, ready for agent review and sending
- An **internal agent note** — concise, action-oriented, not for customer visibility
- **Recommended next actions** — between one and five concrete steps the agent should consider

Again, all output is verified before saving.

---

**The agent receives everything live.**
The moment both steps are complete, the full result is pushed to every connected client watching that ticket or tenant — without refreshing. The triage data and resolution draft appear immediately.

---

**A complete record is kept.**
Every step, every retry, every provider used, every status change is permanently recorded. The team has a full audit trail for every ticket, every time.

---

## 5. Goals & Success Metrics

### What We Are Trying to Achieve

| Goal | Target |
|---|---|
| Ticket accepted and processing started | Under 2 seconds from submission |
| Step 1 (Triage) completed | Under 30 seconds |
| Step 2 (Resolution Draft) completed | Under 30 seconds |
| Full pipeline completed | Under 60 seconds for 90% of tickets |
| Automatic recovery from failures | 100% of transient failures recovered within 3 retries |
| Tickets permanently lost | Zero |
| Service availability | 99.9% uptime |

### What Good Looks Like in Practice

- A support agent opens their queue and sees triage data plus a draft response waiting on a ticket submitted 45 seconds ago.
- A team lead sees a "Critical — Escalation Required" ticket surface on their live dashboard within seconds of it being submitted.
- An operations engineer sees a failed ticket, clicks replay, and the ticket completes processing within the minute — no engineering involvement.

---

## 6. What Happens When Something Goes Wrong

### Automatic Retry

If Step 1 or Step 2 fails — AI service temporarily down, malformed response, network issue — the system waits a short, randomised delay and tries again automatically. This delay grows with each attempt to avoid overwhelming a recovering service. Each step is retried up to three times.

If Step 1 already succeeded and Step 2 fails, **only Step 2 is retried**. Step 1 is never repeated unnecessarily. Completed work is always preserved.

### AI Provider Fallback

The system routes all AI requests through an AI gateway (Portkey) that automatically switches providers if the primary one is unavailable. The order is: Claude first → OpenAI second → Gemini third. This happens transparently — the pipeline keeps running without any manual intervention or code change. Which provider handled each request is recorded on every ticket.

### Permanent Failure

If all three retry attempts fail, the ticket is marked as permanently failed and held safely in a dedicated recovery queue. No ticket data is lost. The operations team can:

1. **View** which tickets are in the recovery queue and why
2. **Replay** any failed ticket — the system re-processes from the failed step, preserving any work already done

### Nothing Is Ever Lost

Every ticket, every processing attempt, every retry, every status change, and every AI provider used is permanently recorded. Even in a complete failure scenario, the original ticket and its full history are preserved and recoverable.

---

## 7. Kanban Board & Workflow

This product is delivered using **Kanban Agile** — a continuous flow model where work is pulled through the board as capacity allows, rather than pushed through in fixed sprint cycles. User stories move through the board individually based on team capacity and priority.

### Board Columns

| Column | Purpose | Entry Rule | Exit Rule |
|---|---|---|---|
| **BACKLOG** | All defined work — both MVP and Post-MVP — waiting to be started. Post-MVP user stories stay here until a future cycle pulls them forward. | User story written with acceptance criteria, definition of done, and dependencies identified | PM or tech lead confirms it is next in priority and all blockers are cleared |
| **PRESTAGE** | User story is fully understood, all dependencies are resolved, and an engineer is ready to pick it up. | All blockers cleared, dependent stories reached COMPLETE | Engineer self-assigns and moves to IN PROGRESS |
| **IN PROGRESS** | User story is actively being built and self-tested by the engineer. | Engineer picks up the story | Story is built, self-tested, and pull request is raised and approved |
| **COMPLETE** | User story is fully built, reviewed, and confirmed against all acceptance criteria and the definition of done. | Pull request merged, definition of done signed off by a second team member | No further action required |

### Kanban Principles Applied to This Delivery

**Pull, do not push.** Engineers pull the next highest-priority story from PRESTAGE when they have capacity. Work is never assigned and pushed to an engineer.

**Limit work in progress.** No engineer works on more than two user stories simultaneously. No more than three stories sit in IN PROGRESS across the team at any time. Bottlenecks surface immediately.

**Flow over speed.** The goal is smooth, continuous flow from BACKLOG to COMPLETE — not the fastest possible individual story. A story stuck in PRESTAGE for more than one working day triggers a conversation.

**MVP stories flow first.** All 26 MVP user stories are prioritised above all Post-MVP stories. No Post-MVP story enters PRESTAGE until all MVP stories reach COMPLETE.

**Visualise blockers immediately.** Any story that cannot move forward is flagged the same day. In a 1-week delivery, blockers older than 4 hours are escalated immediately.

### Flow Metrics

| Metric | Target |
|---|---|
| Average cycle time per story (PRESTAGE → COMPLETE) | Under 8 hours |
| Stories completed per day (team of 2) | 5–6 MVP stories |
| Blocked stories at any one time | 0 — escalate immediately |
| MVP stories completed by end of Day 5 | 26 of 26 |

---

## 8. Epics & User Stories

Each epic is a self-contained capability area. User stories within each epic are labeled:
- ✅ **MVP** — must reach COMPLETE in Week 1
- 🔜 **Post-MVP** — defined, groomed, and sitting in BACKLOG for a future cycle

Every user story includes its **Acceptance Criteria**, **Definition of Done**, and **Delivery Checklist**.

---

### Epic 1 — The Foundation

**What this is:** Everything required before any other capability can exist — the project setup, data storage, environment configuration, processing queue provisioning, and the REST API endpoints that clients use to submit and query tickets.

**Why it matters:** Every other epic depends on this one. Completing it on Day 1 unlocks all parallel work and allows client-side integration to begin immediately.

**Epic Definition of Done:**
- [ ] Any engineer can clone the project and have a working local environment by following only the README — no verbal guidance needed
- [ ] A ticket can be submitted via the API and immediately receives a confirmation with a unique job ID
- [ ] The ticket status can be queried and returns accurate, correctly shaped information for every possible ticket state
- [ ] The health check endpoint correctly identifies and names any dependency that is unavailable
- [ ] The database is fully set up with all three required tables
- [ ] All four processing queues are provisioned and reachable
- [ ] The application refuses to start if any required setting is missing, naming the missing item clearly
- [ ] All MVP user stories (US-1.1 through US-1.7) have passed their acceptance criteria and been signed off by a second team member

---

#### US-1.1 — Project Setup and Structure ✅ MVP

**As an** engineering team
**We want** a fully initialised project with agreed tools, code organisation, and configuration standards
**So that** every engineer works from the same clean, consistent starting point from day one

**Why it matters:** Inconsistent project setup causes environment differences that produce bugs slow to diagnose. A clean agreed starting point eliminates an entire class of problems before they occur.

**Acceptance Criteria:**
- Any engineer can install the project on a clean machine, follow the README, and have a running local environment without additional help
- The code is organised according to the agreed folder structure — confirmed by inspection
- The project is ready to receive the first user story with no setup debt remaining

**Definition of Done:**
- [ ] Project installs and runs cleanly on a machine that has never seen it before
- [ ] The README verified by a second engineer following it step-by-step on their own machine
- [ ] Code structure matches the agreed layout — confirmed by tech lead
- [ ] No placeholder or incomplete configuration remains
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Project initialised with agreed language and framework settings
- [ ] Code quality tools (formatting, linting) installed and passing
- [ ] All required folders created with placeholder files
- [ ] `.env.example` created with every required variable name and a clear description
- [ ] README written covering prerequisites, installation, and how to run locally
- [ ] Second engineer verifies the README by following it on their own machine

---

#### US-1.2 — Local Environment Setup ✅ MVP

**As an** engineering team
**We want** a single command that sets up all local infrastructure identically on any machine
**So that** no engineer loses time debugging environment differences during the delivery week

**Why it matters:** In a 1-week Kanban delivery, there is no time for environment debugging. A single reproducible setup command eliminates this risk entirely.

**Acceptance Criteria:**
- Running one setup script provisions the database and all four processing queues without error
- The script works identically on any engineer's machine — confirmed by two engineers running it independently
- Running the script a second time does not break anything already set up

**Definition of Done:**
- [ ] Two engineers have each run the setup script on their own machines and confirmed it works
- [ ] Running the script twice produces no errors and no duplicate configuration
- [ ] All four queues — including failure queues — exist and are accessible after setup
- [ ] The README documents the setup command and expected output
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Setup script written covering database creation and all four queue provisions
- [ ] Failure queues configured with correct retention settings and retry limits
- [ ] Queue timeout settings configured to allow sufficient AI processing time
- [ ] Script tested on macOS and Linux
- [ ] Setup command and expected output documented in README

---

#### US-1.3 — Data Storage Structure ✅ MVP

**As a** product team
**We want** a structured database with three tables covering tickets, processing results, and event history
**So that** every piece of pipeline data is permanently and consistently stored from the first ticket onwards

**Why it matters:** This is the system of record. Every other user story reads from or writes to this structure. It must be correct and complete before any other story is built on top of it.

**Acceptance Criteria:**
- The database contains three tables: one for tickets, one for processing phase results, one for the event history log
- All tables are created through versioned scripts that can be tracked in version control and reversed if needed
- The structure correctly supports all data described in this document — confirmed by team review

**Definition of Done:**
- [ ] All three tables exist in the database with the correct columns, relationships, and constraints
- [ ] Setup scripts run cleanly on a fresh database
- [ ] Scripts can be reversed cleanly on an empty database
- [ ] Structure reviewed against the data requirements and confirmed correct by tech lead
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Tickets table created with all required fields and status options
- [ ] Processing phases table created with fields for step name, status, result, provider used, and attempt count
- [ ] Event log table created as append-only with all required event types supported
- [ ] Relationships between tables enforced so orphaned records cannot exist
- [ ] Indexes added on frequently queried fields for performance
- [ ] Scripts verified to run on a fresh database and reverse cleanly

---

#### US-1.4 — Configuration Management ✅ MVP

**As a** product team
**We want** the application to validate all required settings at startup and refuse to start if anything is missing
**So that** misconfiguration is caught immediately with a clear message rather than causing silent failures in production

**Why it matters:** Silent misconfiguration causes failures that are slow and expensive to diagnose. Catching missing configuration at startup is the simplest and most effective prevention available.

**Acceptance Criteria:**
- If any required setting is missing, the application exits immediately at startup with a message that names the missing setting
- Validation runs before any database, queue, or AI gateway connections are attempted
- No sensitive value — API keys, passwords, connection strings — ever appears in any log output

**Definition of Done:**
- [ ] Tested by deliberately removing each required setting one at a time — application fails clearly and names the setting each time
- [ ] Confirmed that no API key or password value appears in any log output under any circumstance
- [ ] `.env.example` reviewed and approved — every variable documented with a description and example value
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] All required settings defined with their expected types and allowed values
- [ ] Validation runs at the very start of the application lifecycle before any connections open
- [ ] AI gateway key, AI config ID, database connection, all four queue addresses, port, and log level covered
- [ ] Application tested with each required setting removed individually — clear failure confirmed each time
- [ ] `.env.example` updated with inline descriptions for every variable
- [ ] Log output inspected to confirm no secrets appear

---

#### US-1.5 — Submit Ticket Endpoint ✅ MVP

**As a** support platform client
**We want** to submit a support ticket and receive an immediate confirmation with a job ID
**So that** we know the ticket is received and processing has started — without waiting for AI results

**Why it matters:** This is the entry point for the entire system. Its three non-negotiable properties are: fast (never block on AI), reliable (always confirm receipt), and safe (never lose a ticket even if something fails downstream).

**Acceptance Criteria:**
- A valid ticket submission returns a confirmation with a unique ticket ID in under 500 milliseconds
- If the ticket information is missing required fields or incorrectly formatted, a clear error is returned identifying exactly what is wrong
- If the processing queue is unavailable at the moment of submission, the ticket is not saved — no incomplete records are created

**Definition of Done:**
- [ ] Submission confirmed to return within 500ms under normal conditions — tested and measured
- [ ] Invalid submissions return clear, specific error messages that identify the problem field
- [ ] Simulated queue failure during submission confirms no database record is created — rollback verified
- [ ] Every step of the submission — received, saved, queued — is recorded in the system log
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Request shape defined: subject, body, submitter, and tenant ID all required
- [ ] Ticket created in the database with status set to "queued"
- [ ] Message placed in the Step 1 processing queue
- [ ] If queue placement fails, database record is rolled back before responding
- [ ] Confirmation returned with ticket ID and queued status within 500ms
- [ ] Clear error returned for missing or incorrectly formatted fields
- [ ] All steps logged for observability

---

#### US-1.6 — Check Ticket Status Endpoint ✅ MVP

**As a** support platform client
**We want** to query the current status and results of any ticket by its ID at any point during processing
**So that** we can check progress or inspect a failure without requiring a live notification connection

**Why it matters:** Not every client maintains a live connection for real-time updates. This endpoint ensures any client or team member can check a ticket's state at any time.

**Acceptance Criteria:**
- A valid ticket ID returns the current status and all results available at the time of the query
- An unknown ticket ID returns a clear "not found" response
- For tickets still processing, completed step results are shown and pending steps appear as not yet available
- Responses are returned in under 200 milliseconds

**Definition of Done:**
- [ ] Tested for all four ticket states — queued, processing, completed, and failed — each returns correct information
- [ ] Unknown ticket ID returns a clear not-found response — confirmed
- [ ] Response time confirmed under 200ms in testing
- [ ] Response shape matches the format documented in the Technical PRD
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Query retrieves ticket status and all available phase results in a single operation
- [ ] Response shaped to show both phases, with null values for phases not yet complete
- [ ] Not-found response returned for unrecognised ticket IDs
- [ ] Response time measured and confirmed under 200ms
- [ ] Tested manually for all four ticket states

---

#### US-1.7 — Service Health Check ✅ MVP

**As a** platform infrastructure team
**We want** a dedicated endpoint reporting whether the service and all critical dependencies are healthy
**So that** monitoring systems and load balancers can detect service degradation immediately

**Why it matters:** Infrastructure monitoring, load balancers, and on-call alerts all depend on a reliable health signal. Without it, outages take longer to detect and impact response time.

**Acceptance Criteria:**
- When all dependencies are healthy, the endpoint returns "healthy" with each dependency's status listed
- When any dependency is unreachable, the endpoint returns "degraded" and identifies which one
- The response is returned in under 100 milliseconds
- No sensitive configuration or connection details are exposed in the response

**Definition of Done:**
- [ ] Tested with the database stopped — endpoint returns "degraded" and names the database — confirmed
- [ ] Tested with the queues unreachable — endpoint returns "degraded" and names the queues — confirmed
- [ ] Response time confirmed under 100ms
- [ ] No sensitive values appear in the response output — confirmed by inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Lightweight database connectivity check implemented
- [ ] Reachability check implemented for both main processing queues
- [ ] Healthy response returns "ok" status with individual dependency statuses listed
- [ ] Degraded response returns "degraded" status and identifies the affected dependency
- [ ] Response time measured and confirmed under 100ms

---

#### US-1.8 — Request Rate Limiting 🔜 Post-MVP

**As a** platform infrastructure team
**We want** a configurable limit on how many tickets a single client can submit in a given time window
**So that** the processing queues are protected from accidental or intentional overload

**Why it matters:** Without rate limiting, a misbehaving client or a traffic spike can flood the queues and degrade service for all users. Not needed at launch volume but required as the service scales.

**Acceptance Criteria:**
- Clients exceeding the submission rate receive a clear "too many requests" response with guidance on when to retry
- The rate limit thresholds are adjustable without a code deployment
- Ticket status and health check endpoints are unaffected by rate limiting

**Definition of Done:**
- [ ] Rate limiting verified — a client hitting the threshold receives the correct "too many requests" response
- [ ] Status and health endpoints confirmed unaffected
- [ ] Thresholds confirmed adjustable via configuration without code change
- [ ] Retry guidance included in the response — confirmed present and accurate
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Rate limiting applied to the submit ticket endpoint only
- [ ] Maximum requests and time window configurable via environment settings
- [ ] "Too many requests" response includes when the client may retry
- [ ] Status and health check endpoints excluded from rate limiting
- [ ] Tested — client hitting the limit gets correct response; client below limit is unaffected

---

#### US-1.9 — API Versioning (/v1/ Prefix) 🔜 Post-MVP

**As a** platform engineering team
**We want** all API routes prefixed with a version identifier
**So that** future breaking changes can be introduced without disrupting existing client integrations

**Why it matters:** APIs evolve. Without versioning, any breaking change forces all integrating clients to update immediately. Versioning gives integrators time to migrate at their own pace.

**Acceptance Criteria:**
- All ticket-related endpoints are accessible under the `/v1/` path prefix
- The health check endpoint remains unversioned
- Accessing routes without the version prefix returns a "not found" response

**Definition of Done:**
- [ ] All ticket endpoints confirmed accessible and working under `/v1/`
- [ ] Health check confirmed unversioned and still working
- [ ] Unversioned ticket routes return not-found responses
- [ ] README and documentation updated to reflect the new base paths
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Router updated to serve all ticket endpoints under `/v1/` prefix
- [ ] Health check endpoint left outside the versioned router
- [ ] Old unversioned routes removed or return 404
- [ ] README base URL updated
- [ ] All endpoint references in documentation updated

---

### Epic 2 — The Processing Engine

**What this is:** The background workers that continuously monitor the processing queues, pick up tickets, execute each processing step, and hand off automatically from Step 1 to Step 2. Each step has its own dedicated worker and its own queue.

**Why it matters:** Phase isolation ensures that a high volume of Step 2 jobs never delays Step 1 tickets, and a failure in one step has zero impact on the other. This is the reliability backbone of the entire pipeline.

**Epic Definition of Done:**
- [ ] A submitted ticket is picked up and begins Step 1 processing within 2 seconds — confirmed without any manual action
- [ ] After Step 1 completes, Step 2 begins automatically within 2 seconds — no manual trigger required
- [ ] A ticket whose Step 1 already completed is never re-triaged, even when re-processed — checkpointing confirmed by inspection
- [ ] If a worker is shut down mid-processing, the in-flight ticket is completed before the worker stops — confirmed by test
- [ ] Step 1 and Step 2 queues operate independently — a backlog in one does not slow down the other — confirmed by observation
- [ ] All MVP user stories (US-2.1 through US-2.3) have passed their acceptance criteria and been signed off by a second team member

---

#### US-2.1 — Step 1 Worker (Triage Processor) ✅ MVP

**As a** backend system
**We want** a dedicated background worker continuously monitoring the Step 1 queue
**So that** every submitted ticket is picked up and triaged automatically within 2 seconds

**Why it matters:** This is the engine that makes processing happen. Without it, tickets sit in the queue untouched. It must be reliable, self-correcting, and incapable of accidentally repeating completed work.

**Acceptance Criteria:**
- Tickets begin processing within 2 seconds of being placed in the Step 1 queue
- Before processing a ticket, the worker checks whether Step 1 has already been successfully completed — if it has, it skips without making any AI call
- If the worker is stopped while processing a ticket, that ticket completes before the worker shuts down
- A ticket is only marked as "Step 1 complete" after its result has been successfully saved to the database

**Definition of Done:**
- [ ] 10 tickets submitted simultaneously — all processed by the worker without manual action — confirmed
- [ ] A ticket manually set to "Step 1 complete" in the database is not re-processed when the job is replayed — confirmed
- [ ] Worker stopped mid-process — in-flight ticket completes before shutdown — confirmed
- [ ] A ticket's "Step 1 complete" status is only set after the result is confirmed saved — verified by inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Worker starts automatically on application startup and monitors the Step 1 queue
- [ ] Message received and dispatched within 2 seconds of being placed in the queue
- [ ] Database checked for existing Step 1 success before any AI call is made
- [ ] Step 1 status updated to "in progress" before the AI call is sent
- [ ] Step 1 status updated to "success" only after the result is saved
- [ ] Message removed from the queue only after a successful save
- [ ] Graceful shutdown registered — in-flight message completes before worker exits

---

#### US-2.2 — Step 2 Worker (Resolution Processor) ✅ MVP

**As a** backend system
**We want** a separate dedicated worker continuously monitoring the Step 2 queue
**So that** resolution drafts are generated independently of Step 1 volume and failures

**Why it matters:** Full queue isolation means Step 2 throughput is never affected by Step 1 volume, and a Step 2 failure never touches the Step 1 queue. This separation is what makes the pipeline resilient to uneven load.

**Acceptance Criteria:**
- Step 2 only begins processing a ticket after Step 1 is confirmed as successfully complete
- If Step 1 is not complete when Step 2 attempts to run, Step 2 fails gracefully without making any AI call
- All the same check-before-running and graceful shutdown behaviours from US-2.1 apply equally here

**Definition of Done:**
- [ ] Full pipeline tested end-to-end: ticket submitted → Step 1 completes → Step 2 picks up automatically — confirmed without manual action
- [ ] Step 2 triggered on a ticket whose Step 1 is not yet complete — fails gracefully, no AI call made — confirmed
- [ ] Graceful shutdown tested — in-flight Step 2 ticket completes before worker exits — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Worker starts automatically on application startup and monitors the Step 2 queue
- [ ] Step 1 success status confirmed in the database before any AI call is attempted
- [ ] Immediate graceful failure if Step 1 is not confirmed complete
- [ ] Same checkpointing and graceful shutdown logic as US-2.1 applied
- [ ] Message removed from the queue only after a successful save

---

#### US-2.3 — Automatic Handoff from Step 1 to Step 2 ✅ MVP

**As a** backend system
**We want** Step 1 to automatically place the ticket into the Step 2 queue after completing successfully
**So that** the pipeline flows from one step to the next without any external trigger or manual action

**Why it matters:** Any gap between steps introduces latency and failure points. Automatic direct handoff keeps the pipeline flowing at full speed and eliminates orchestration failures entirely.

**Acceptance Criteria:**
- Step 2 begins within 2 seconds of Step 1 completing and saving — confirmed without any manual action
- If placing the ticket into the Step 2 queue fails, Step 1 is not marked complete — it retries the handoff on the next cycle only, skipping the AI call via checkpointing

**Definition of Done:**
- [ ] Confirmed: Step 2 begins within 2 seconds of Step 1 completing, with no manual trigger
- [ ] Simulated Step 2 queue failure during handoff: Step 1 not marked complete, handoff retried — confirmed
- [ ] Handoff event recorded in the ticket's event log — confirmed by inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Step 2 queue message published after Step 1 result is confirmed saved
- [ ] Step 1 marked complete only after Step 2 queue placement succeeds
- [ ] If Step 2 queue placement fails, Step 1 message is not deleted — retried automatically
- [ ] Handoff event logged with ticket ID, from-step, to-step, and timestamp

---

#### US-2.4 — Parallel Ticket Processing Per Worker 🔜 Post-MVP

**As a** platform infrastructure team
**We want** each worker to process multiple tickets simultaneously up to a configurable limit
**So that** a slow AI response on one ticket does not delay all others behind it in the queue

**Why it matters:** At launch volume, single-ticket processing per worker is sufficient. As volume grows, single-threaded processing creates a throughput ceiling that parallel processing removes.

**Acceptance Criteria:**
- Each worker can process up to a configurable number of tickets simultaneously — default is three
- Parallel processing never causes a ticket to be processed more than once
- The worker shuts down cleanly even when multiple tickets are being processed simultaneously

**Definition of Done:**
- [ ] 20 tickets submitted simultaneously — all processed correctly with no duplicates — confirmed
- [ ] Graceful shutdown tested with three tickets in progress simultaneously — all complete before shutdown — confirmed
- [ ] Maximum concurrent tickets configurable without a code change — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Maximum concurrent tickets per worker made configurable via environment setting (default: 3)
- [ ] Concurrent processing logic prevents the same ticket from being processed twice
- [ ] Graceful shutdown updated to wait for all concurrent in-flight tickets before exiting
- [ ] Load tested: 20 tickets simultaneously, all complete correctly

---

### Epic 3 — The AI Brain

**What this is:** The integration layer that connects the system to its AI providers through a single AI gateway. All AI calls go through one standardised connection point. The gateway handles provider selection, fallback, and switching automatically.

**Why it matters:** AI provider availability fluctuates. A single gateway with automatic fallback means the pipeline keeps running through Claude outages, rate limiting, or any provider-level disruption — without code changes or manual intervention.

**Epic Definition of Done:**
- [ ] Both processing steps successfully send requests to the AI gateway and receive structured responses — confirmed on five different ticket types
- [ ] Simulated Claude outage: gateway automatically routes to OpenAI — confirmed in gateway logs, no code change needed
- [ ] Simulated Claude and OpenAI outage: gateway automatically routes to Gemini — confirmed
- [ ] All three providers unavailable: failure handled gracefully, retry system takes over — no crash, no data loss
- [ ] The provider used for each AI call is recorded on every ticket — confirmed by inspecting ticket records
- [ ] When a fallback to a non-primary provider occurs, this is recorded in the ticket's event history — confirmed
- [ ] All MVP user stories (US-3.1 through US-3.2) have passed their acceptance criteria and been signed off by a second team member

---

#### US-3.1 — AI Gateway Connection ✅ MVP

**As a** backend system
**We want** a single standardised connection point through which all AI calls are routed
**So that** the rest of the system is fully insulated from AI provider details and can never call a provider directly

**Why it matters:** A single connection point means swapping providers, adding providers, or changing routing rules requires only a gateway configuration change — zero code changes, zero deployments.

**Acceptance Criteria:**
- Both Step 1 and Step 2 route all AI requests through the same single connection interface
- No AI provider-specific code exists anywhere outside the connection layer — confirmed by codebase inspection
- If the gateway returns an error, it is clearly identified so the retry system knows how to respond

**Definition of Done:**
- [ ] Both steps confirmed to use the same connection interface for all AI calls
- [ ] Codebase inspected — no provider-specific code exists outside the designated connection layer — confirmed
- [ ] Gateway error causes clean, identifiable failure — retry system responds correctly — confirmed by test
- [ ] Gateway API key and configuration ID confirmed loaded from environment settings, not hardcoded
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Standardised connection interface defined — both steps use it, neither imports provider tools directly
- [ ] AI gateway SDK installed and configured
- [ ] Gateway API key and configuration ID loaded from validated environment settings
- [ ] Response from gateway normalised into a standard shape including which provider handled the request
- [ ] Gateway errors throw a typed, identifiable error the retry system can act on
- [ ] Tested: both steps make successful calls through the gateway

---

#### US-3.2 — Automatic AI Provider Fallback ✅ MVP

**As a** backend system
**We want** the AI gateway configured to switch providers automatically when the primary one is unavailable
**So that** ticket processing continues through any single-provider outage without code changes or manual intervention

**Why it matters:** No AI provider guarantees 100% uptime. Without fallback, a Claude outage causes every in-flight ticket to fail. With this configuration, the pipeline continues through provider disruptions transparently.

**Acceptance Criteria:**
- If Claude is unavailable or rate-limited, the gateway routes to OpenAI automatically — confirmed in gateway logs
- If OpenAI is also unavailable, the gateway routes to Gemini — confirmed
- If all three providers are unavailable, the gateway returns a failure and the retry system handles it — confirmed with no crash
- Which provider handled each request is recorded on the ticket — confirmed by inspection
- When a fallback to a non-primary provider occurs, this is recorded in the ticket's event history

**Definition of Done:**
- [ ] Claude disabled in gateway: OpenAI used automatically — confirmed, no code change required
- [ ] Claude and OpenAI disabled: Gemini used automatically — confirmed
- [ ] All three providers disabled: failure returned cleanly, retry system activates — no crash or data loss
- [ ] Provider used recorded on every ticket phase record — confirmed by database inspection
- [ ] Fallback event recorded in the ticket event log — confirmed
- [ ] Gateway setup steps documented in README — reviewed and accurate
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Gateway configured with provider priority: Claude → OpenAI → Gemini
- [ ] Fallback triggers set: rate limit responses, server errors, and timeouts all trigger fallback
- [ ] Access credentials for all three providers set up in the gateway dashboard
- [ ] Gateway configuration ID stored as an environment variable and documented
- [ ] Provider used extracted from gateway response and stored on the ticket phase record
- [ ] Fallback event written to the ticket event log when a non-primary provider handles the request
- [ ] Fallback tested in gateway sandbox for all three provider failure scenarios
- [ ] Gateway setup steps documented in README

---

#### US-3.3 — Separate AI Configurations Per Step 🔜 Post-MVP

**As a** product team
**We want** Step 1 and Step 2 to each use a separate AI gateway configuration
**So that** each step can be independently optimised for cost and quality without affecting the other

**Why it matters:** Triage is a classification task where speed matters most. Resolution drafting is a generation task where quality matters most. Independent configuration enables cost and quality optimisation per step.

**Acceptance Criteria:**
- Step 1 and Step 2 can each be pointed at different gateway configurations independently
- Updating one step's configuration does not affect the other step
- Both configurations can be updated without a code deployment

**Definition of Done:**
- [ ] Step 1 and Step 2 confirmed using different configuration IDs — verified in gateway logs
- [ ] Changing Step 1's configuration has no effect on Step 2's behaviour — confirmed by test
- [ ] Configuration update in the gateway dashboard takes effect without any code change — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Two separate gateway configuration IDs created — one per step
- [ ] Step 1 and Step 2 environment settings updated to reference their own configuration IDs
- [ ] Both configurations tested independently
- [ ] Tested: change Step 1 config, confirm Step 2 is unaffected

---

#### US-3.4 — AI Usage and Cost Tracking Per Ticket 🔜 Post-MVP

**As a** product and operations team
**We want** AI processing unit usage and estimated cost recorded for every AI call per ticket
**So that** we can track cost per ticket, identify outliers, and make informed provider decisions as volume grows

**Why it matters:** As ticket volume grows, AI processing cost becomes a meaningful expense. Tracking cost per ticket enables data-driven optimisation decisions.

**Acceptance Criteria:**
- Processing unit usage (input and output) is recorded for every AI call
- An estimated cost in USD is calculated and stored per call, per step, per ticket
- Cost information is visible when querying a ticket's status

**Definition of Done:**
- [ ] Full pipeline run confirms usage and estimated cost stored in the database for both steps — verified by inspection
- [ ] Cost estimation confirmed accurate for all three providers
- [ ] Cost data visible in the ticket status response — confirmed by API query
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Usage data extracted from gateway response on every AI call
- [ ] Cost estimation logic implemented using configurable per-provider rates
- [ ] Per-provider rates stored as environment configuration
- [ ] Usage and cost fields added to the processing phase database record
- [ ] Cost data included in the ticket status API response
- [ ] Tested for all three providers

---

### Epic 4 — The AI Pipeline

**What this is:** The actual processing logic for both steps — the instructions given to the AI, the format outputs must follow, and the validation rules that determine whether a result is acceptable before it is saved.

**Why it matters:** The quality and consistency of the AI output is what support agents see and act on. Strict output validation ensures agents always receive complete, correctly structured information — never a partial or garbled result.

**Epic Definition of Done:**
- [ ] A submitted ticket flows through both steps automatically and produces a complete, correctly structured result — confirmed on five different ticket types
- [ ] Step 1 always produces all six required fields — any response missing a field is rejected and retried, never saved — confirmed by test
- [ ] Step 2 always produces a customer reply, an internal note, and at least one next action — any incomplete response rejected and retried — confirmed
- [ ] The customer-facing reply produced by Step 2 is written in professional language appropriate for a customer — confirmed by a non-engineer reviewer
- [ ] Step 2 is blocked and fails immediately if Step 1 has not completed successfully — no AI call made in this scenario — confirmed
- [ ] The full pipeline result is visible via the ticket status endpoint immediately after both steps complete
- [ ] All MVP user stories (US-4.1 through US-4.4) have passed their acceptance criteria and been signed off by a second team member

---

#### US-4.1 — Step 1: Triage Analysis ✅ MVP

**As a** support operations team
**We want** every incoming ticket to be automatically analysed and classified into six structured fields
**So that** agents receive complete, consistently formatted triage data for every ticket without manual classification

**Why it matters:** The triage result is the foundation for everything that follows. If it is incomplete or incorrectly structured, Step 2 cannot run well and agents receive poor-quality information.

**Acceptance Criteria:**
- Every successful triage result contains all six fields: category, priority, sentiment, escalation flag, routing target, and summary
- The summary is always 200 characters or fewer — enforced at the validation level, not just the prompt
- Priority is always one of four values: low, medium, high, or critical
- If the AI returns an incomplete or incorrectly structured response, it is treated as a failure and retried — never saved or shown to anyone

**Definition of Done:**
- [ ] Five different ticket types tested — all produce complete, correctly structured triage results — confirmed
- [ ] AI response with a missing field deliberately tested — treated as failure, retried, never saved — confirmed
- [ ] AI response with an invalid priority value deliberately tested — treated as failure — confirmed
- [ ] Summary length enforced — responses over 200 characters are rejected — confirmed
- [ ] Provider used stored on the triage result record — confirmed by database inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Triage output schema defined: all six fields with allowed values specified
- [ ] System instructions written for the AI, including support domain context
- [ ] AI call made through the standardised gateway connection
- [ ] All six required fields validated for presence and correct format before saving
- [ ] Summary length validated to maximum 200 characters
- [ ] Invalid or incomplete responses treated as failures — not saved
- [ ] Provider used stored on the triage result record
- [ ] Tested on five different ticket types

---

#### US-4.2 — Step 1 Result Saving ✅ MVP

**As a** backend system
**We want** the validated triage result saved to the database as a single all-or-nothing operation
**So that** the database is always in a consistent state — never partially updated

**Why it matters:** Until the result is saved, it exists only in memory. If anything fails before saving, the work is lost and must be repeated. Saving all updates together ensures the database is never left in a partial state.

**Acceptance Criteria:**
- The triage result, updated ticket status, and event log entry are all saved in a single operation — either all succeed or none do
- The triage result is immediately visible when querying the ticket status after saving
- The provider used for the AI call is recorded alongside the triage result

**Definition of Done:**
- [ ] Database inspected directly after a Step 1 run — all three tables updated correctly and completely — confirmed
- [ ] Triage result immediately visible via the ticket status endpoint after saving — confirmed
- [ ] Simulated database failure mid-save — database not left in a partially updated state — confirmed
- [ ] Provider used confirmed stored on the triage result record
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Database save operation covers all three updates as a single transaction
- [ ] Result stored in the correct structured format — not as plain text
- [ ] Provider used stored alongside the result
- [ ] Transaction rolled back cleanly if any part of the save fails
- [ ] Ticket status endpoint tested after save — result visible

---

#### US-4.3 — Step 2: Resolution Draft Generation ✅ MVP

**As a** support agent
**We want** a structured resolution draft — customer reply, internal note, and next actions — generated automatically using the ticket and triage data as context
**So that** we have a professional, ready-to-review starting point for every ticket instead of starting from scratch

**Why it matters:** Step 2 is the primary deliverable agents act on. The quality of the customer reply and the accuracy of the next actions directly affect customer satisfaction and agent efficiency.

**Acceptance Criteria:**
- Step 2 fetches the Step 1 result before making any AI call — if Step 1 is not confirmed complete, Step 2 fails immediately without calling the AI
- Every result contains a customer reply, an internal note, and between one and five next actions
- The customer reply is written in professional, customer-facing language — no internal jargon
- If the AI returns an incomplete or incorrectly structured response, it is treated as a failure and retried

**Definition of Done:**
- [ ] Step 1 not yet complete scenario tested — Step 2 fails immediately, no AI call made — confirmed
- [ ] Five different ticket types tested — all produce customer reply, internal note, and at least one next action — confirmed
- [ ] Customer reply reviewed by a non-engineer — confirmed to contain no internal jargon
- [ ] AI response with a missing field tested — treated as failure, retried — confirmed
- [ ] Provider used recorded on the resolution result — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Step 1 result retrieved from the database at the start of every Step 2 execution
- [ ] Immediate failure with no AI call if Step 1 result is absent or not marked complete
- [ ] Resolution output schema defined: customer reply, internal note, next actions (1–5 items)
- [ ] System instructions written for the AI including customer tone and internal note guidance
- [ ] Original ticket content and Step 1 triage result both included as context in the AI request
- [ ] Response validated: all three fields present, next actions count within range
- [ ] Invalid or incomplete responses treated as failures — not saved
- [ ] Tested on five different ticket types

---

#### US-4.4 — Step 2 Result Saving and Pipeline Completion ✅ MVP

**As a** support agent
**We want** the resolution draft saved and the ticket marked complete the moment Step 2 finishes
**So that** the full result is immediately available via both the status endpoint and the live notification

**Why it matters:** This is the final step of the pipeline. The live notification must fire only after all data is safely saved — never before — to ensure clients always receive accurate, complete information.

**Acceptance Criteria:**
- The resolution result, final ticket status update, and event log entry are all saved in a single operation
- The live completion notification is sent only after all data has been successfully saved
- The full result — triage and resolution — is visible via the ticket status endpoint after completion

**Definition of Done:**
- [ ] Full end-to-end pipeline tested: ticket submitted → both steps complete → ticket status shows completed with both results — confirmed
- [ ] Live completion notification received by a connected client immediately after pipeline completes — confirmed
- [ ] Notification confirmed to contain the same data as the ticket status endpoint — no discrepancy
- [ ] Simulated database failure mid-save: no notification sent, database not partially updated — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Database save covers all three updates — resolution result, ticket status, event log — as a single transaction
- [ ] Live completion notification assembled from the saved results
- [ ] Notification sent only after successful database save
- [ ] Notification payload reviewed against ticket status response — confirmed to match
- [ ] Ticket status endpoint tested after completion — both step results visible

---

#### US-4.5 — Editable AI Instructions Without Code Changes 🔜 Post-MVP

**As a** product team
**We want** the AI instructions for both steps stored in the database and editable without a code deployment
**So that** prompt quality can be improved in real time without going through a release cycle

**Why it matters:** AI instruction quality directly affects output quality. A database-stored approach reduces improvement cycles from days to minutes.

**Acceptance Criteria:**
- The AI instructions for both Step 1 and Step 2 can be updated in the database by the product team
- Updated instructions take effect on the next processing cycle — no deployment required
- If no custom instructions are stored, the system uses built-in default instructions automatically

**Definition of Done:**
- [ ] Step 1 instructions updated in the database — next ticket processed uses the new instructions — confirmed, no deployment made
- [ ] Same confirmed for Step 2 instructions
- [ ] Instructions table emptied — both steps fall back to built-in defaults — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Instructions table created in the database (separate migration)
- [ ] Instruction loader reads the latest active instruction per step at startup
- [ ] Both steps updated to use loaded instructions
- [ ] Fallback to built-in defaults when no database instruction exists
- [ ] Tested: update instruction in database, confirm next ticket uses it without redeployment

---

#### US-4.6 — Failed AI Response Archiving 🔜 Post-MVP

**As an** engineering team
**We want** raw AI responses that fail validation saved separately in the database
**So that** we can diagnose validation failures without re-running the AI call

**Why it matters:** When a validation failure occurs, the team has no visibility into what the AI actually returned. Archiving failed responses enables faster diagnosis of prompt issues and AI behaviour changes.

**Acceptance Criteria:**
- When an AI response fails validation, the raw response is saved alongside the failure record
- The raw failed response is never included in any API response visible to agents or clients
- Successfully validated responses are not archived — no unnecessary storage cost

**Definition of Done:**
- [ ] Validation failure deliberately triggered — raw response confirmed saved in database — confirmed by inspection
- [ ] Raw response confirmed absent from the ticket status API response — confirmed
- [ ] Successful validation run — no raw response stored — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Raw response saved to a separate field on the processing phase record when validation fails
- [ ] Field left empty on successful validation
- [ ] Raw response field excluded from all API response queries
- [ ] Tested: validation failure saves raw response; validation success does not

---

### Epic 5 — Reliability & Recovery

**What this is:** All capabilities that ensure the pipeline keeps working when things go wrong — automatic retries with intelligent timing, safe permanent failure handling, and a self-service recovery tool the operations team can use without engineering involvement.

**Why it matters:** In production, failures happen. The difference between a reliable service and an unreliable one is not whether failures occur — it is how quickly and safely the system recovers from them.

**Epic Definition of Done:**
- [ ] A ticket that fails processing is automatically retried — attempt count increases without manual action — confirmed
- [ ] Each retry waits longer than the previous one with non-uniform timing — confirmed across multiple simultaneous failures
- [ ] A ticket where Step 1 succeeded but Step 2 failed is retried on Step 2 only — Step 1 not repeated — confirmed by database inspection
- [ ] A ticket that fails all three retry attempts is marked permanently failed and held safely — no data lost — confirmed
- [ ] A permanently failed ticket replayed via the replay action completes successfully without repeating already-completed steps — confirmed
- [ ] A live failure notification is received by a connected client when a ticket is permanently failed — confirmed
- [ ] All MVP user stories (US-5.1 through US-5.3) have passed their acceptance criteria and been signed off by a second team member

---

#### US-5.1 — Smart Retry Timing ✅ MVP

**As a** backend system
**We want** retry delays that grow with each attempt and include a small random variation
**So that** many tickets failing simultaneously do not all retry at exactly the same moment and overwhelm a recovering service

**Why it matters:** Fixed immediate retries can make a struggling AI provider worse. Increasing, randomised delays spread the retry load and give providers time to recover.

**Acceptance Criteria:**
- Each retry attempt waits longer than the previous one
- The wait time includes a random variation — confirmed across 100 samples, no two at the same attempt number are identical
- The maximum wait time is capped so no ticket is delayed indefinitely

**Definition of Done:**
- [ ] Timing logic tested across 100 samples per attempt — all values within the defined range — confirmed
- [ ] No two consecutive samples at the same attempt number are identical — non-determinism confirmed
- [ ] Maximum wait time cap confirmed — no value exceeds the defined limit
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Retry timing utility implemented with increasing base and full randomisation
- [ ] Minimum wait time: 1 second for the first retry
- [ ] Maximum wait time capped at 30 seconds
- [ ] Tested: 100 samples per attempt number — range and non-determinism confirmed
- [ ] Utility exported for use by both workers

---

#### US-5.2 — Automatic Retry with Step Preservation ✅ MVP

**As a** backend system
**We want** failed processing steps automatically retried up to three times, preserving any steps already completed
**So that** transient failures recover without human intervention and without repeating work unnecessarily

**Why it matters:** Retrying without preserving completed work wastes AI calls and increases cost. The three-attempt ceiling ensures permanently broken tickets do not loop indefinitely.

**Acceptance Criteria:**
- A failing step is retried automatically up to three times using increasing wait times
- Successfully completed steps are never repeated, even during a retry cycle
- After three failed attempts, the ticket is marked as permanently failed and moved to the recovery queue
- A live failure notification is sent to any connected client when a ticket is permanently failed

**Definition of Done:**
- [ ] Step failure forced three times — attempt count reaches three and stops, ticket marked permanently failed — confirmed, no fourth attempt
- [ ] Ticket status confirmed as "failed" via the status endpoint after permanent failure
- [ ] Step 1 succeeded, Step 2 failed repeatedly — Step 1 confirmed not retried, only Step 2 — confirmed by database inspection
- [ ] Live failure notification received by a connected client upon permanent failure — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Attempt count checked before processing — if at three, mark permanently failed without AI call
- [ ] Attempt count and last-attempted timestamp updated on each failure
- [ ] Smart retry timing applied via US-5.1 between each attempt
- [ ] On third failure: processing phase marked permanently failed, ticket status set to failed, event log updated
- [ ] Live failure notification triggered after permanent failure status is saved
- [ ] Processing queue message not deleted on failure — routes to recovery queue naturally

---

#### US-5.3 — Ticket Replay (Manual Recovery) ✅ MVP

**As an** operations engineer
**We want** to replay any permanently failed ticket from the step that failed with a single action
**So that** tickets lost to transient failures are recoverable without resubmitting the original ticket or repeating completed work

**Why it matters:** Permanent failures are often caused by temporary conditions. Replay allows full recovery without losing completed work and without any engineering involvement.

**Acceptance Criteria:**
- Any permanently failed ticket can be replayed via a single action and re-enters the processing queue
- The replay starts from the failed step only — previously completed steps are preserved and not repeated
- Attempting to replay a ticket that is not in a permanently failed state returns a clear explanation
- Every replay action is recorded in the ticket's event history

**Definition of Done:**
- [ ] Step 1 failed permanently, replayed — Step 1 re-runs, completes, Step 2 runs — confirmed with no manual steps between
- [ ] Step 1 succeeded, Step 2 failed permanently, replayed — Step 1 not repeated, only Step 2 re-runs — confirmed by database inspection
- [ ] Replay attempted on a non-failed ticket — clear error returned — confirmed
- [ ] Replay attempted on an unknown ticket ID — not-found response returned — confirmed
- [ ] Replay event recorded in the ticket event log — confirmed by inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Replay action checks that the ticket is in permanently failed state before proceeding
- [ ] Failed step identified from the processing phase record
- [ ] Only the failed step's attempt count reset to zero — successful steps untouched
- [ ] Ticket status updated to "queued"
- [ ] Message published to the correct step queue based on which step failed
- [ ] Replay event written to the event log
- [ ] Clear error returned for non-failed tickets and unknown ticket IDs
- [ ] Tested: Step 1 replay and Step 2 replay both work correctly with step preservation confirmed

---

#### US-5.4 — Failed Ticket Queue Inspector 🔜 Post-MVP

**As an** operations engineer
**We want** to view which tickets are currently in the recovery queue via an API call
**So that** we can identify permanently failed tickets for review or replay without requiring infrastructure access

**Why it matters:** Without this, identifying permanently failed tickets requires cloud console access or engineering escalation. A self-service inspector reduces dependency and speeds up operational response.

**Acceptance Criteria:**
- The inspector shows up to 10 failed tickets per step queue
- Each entry shows: ticket ID, which step failed, how many attempts were made, when the last attempt was, and the failure reason
- Viewing the inspector does not remove tickets from the recovery queue — read-only
- An empty recovery queue returns a clear "no failed tickets" response

**Definition of Done:**
- [ ] Three tickets placed in the recovery queue — inspector called twice — three tickets returned both times, queue unchanged — confirmed
- [ ] Each entry contains all five required data points — confirmed
- [ ] Empty queue returns clear "no failed tickets" response — confirmed
- [ ] Invalid step parameter returns a clear error — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Inspector endpoint implemented for both Step 1 and Step 2 recovery queues
- [ ] Read-only queue access — messages not consumed during inspection
- [ ] Response includes ticket ID, failed step, attempt count, last attempt time, and failure reason
- [ ] Empty queue handled — returns clear message
- [ ] Invalid step path parameter returns a clear error
- [ ] Tested: call twice on a queue with three entries, confirm identical responses

---

#### US-5.5 — Automatic Replay for Recoverable Failures 🔜 Post-MVP

**As an** operations team
**We want** tickets in the recovery queue to be automatically replayed after a configurable delay
**So that** off-hours failures recover without requiring manual attention

**Why it matters:** Failures overnight or on weekends currently require manual action before recovery begins. Automatic replay reduces the recovery window for time-sensitive tickets.

**Acceptance Criteria:**
- Tickets in the recovery queue are automatically replayed after a configurable waiting period
- The maximum number of automatic replay attempts per ticket is configurable — default is one — to prevent infinite loops
- Automatic replay can be fully disabled via a configuration setting
- Every automatic replay is recorded in the ticket's event history

**Definition of Done:**
- [ ] Ticket permanently failed — automatically replayed after configured delay without manual action — confirmed
- [ ] Automatic replay limit reached — ticket not replayed again — confirmed, no infinite loop
- [ ] Automatic replay disabled via configuration — no replays occur — confirmed
- [ ] Automatic replay event recorded in event log — confirmed by inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Scheduled background job implemented to poll the recovery queue at configured intervals
- [ ] Delay before auto-replay configurable via environment setting
- [ ] Maximum automatic attempts per ticket configurable (default: 1)
- [ ] Auto-replay on/off toggle configurable via environment setting
- [ ] Auto-replay event written to ticket event log with source identified as automatic
- [ ] Tested: permanent failure auto-replayed after delay; limit reached, no further replay

---

### Epic 6 — Live Updates

**What this is:** The real-time notification layer that pushes status updates to connected clients as the pipeline progresses — without requiring any page refresh or manual polling.

**Why it matters:** A minute of silent processing feels like a long time to a support agent waiting for results. Real-time updates make the pipeline feel immediate and allow agents to act on results the moment they are ready.

**Epic Definition of Done:**
- [ ] A client connected to a ticket's channel receives all five expected notifications in correct order during a full pipeline run — Step 1 started, Step 1 complete, Step 2 started, Step 2 complete, pipeline complete — confirmed
- [ ] A client subscribed to a different ticket's channel receives none of the above — isolation confirmed
- [ ] The final pipeline-complete notification payload matches what the ticket status endpoint returns — no discrepancy — confirmed
- [ ] A live failure notification is delivered when a ticket is permanently failed — confirmed
- [ ] All MVP user stories (US-6.1 through US-6.3) have passed their acceptance criteria and been signed off by a second team member

---

#### US-6.1 — Real-Time Connection and Room Management ✅ MVP

**As a** support agent or manager
**We want** to subscribe to live updates for a specific ticket or for all tickets under our tenant
**So that** we only receive updates relevant to us without any noise from other tickets or tenants

**Why it matters:** Without scoped subscriptions, every connected client would receive updates for every ticket system-wide — a basic privacy and performance issue.

**Acceptance Criteria:**
- A client can subscribe to a specific ticket and receives only that ticket's updates
- A client can subscribe to a tenant and receives updates for all of that tenant's tickets
- A client subscribed to Ticket A never receives updates for Ticket B — isolation confirmed by test

**Definition of Done:**
- [ ] Two clients connected to different ticket channels: notifications sent to one — only the correct client receives them — confirmed
- [ ] Tenant channel tested: client receives updates for all tickets under that tenant — confirmed
- [ ] Connection and subscription events recorded in the system log — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Live notification server started on application startup
- [ ] "Subscribe to ticket" event handler implemented
- [ ] "Subscribe to tenant" event handler implemented
- [ ] Helper functions created for sending notifications to a ticket channel and a tenant channel
- [ ] Connection, disconnection, and subscription events logged
- [ ] Channel isolation tested with two clients on different ticket channels

---

#### US-6.2 — Step Progress Notifications ✅ MVP

**As a** support agent or manager
**We want** a live notification each time a processing step starts, completes, or fails
**So that** we can see real-time progress without polling and act immediately on escalation-flagged tickets

**Why it matters:** Intermediate progress notifications make the pipeline feel responsive and give managers early visibility on high-priority tickets before the final result arrives.

**Acceptance Criteria:**
- A "started" notification is sent when each step begins processing
- A "completed" notification is sent when each step finishes successfully, including which AI provider handled it
- A "failed" notification is sent each time a step attempt fails — including during retries
- All notifications are sent to both the per-ticket and per-tenant channels

**Definition of Done:**
- [ ] Full pipeline run with a connected client: all four phase notifications received in correct order — confirmed
- [ ] Forced step failure: "failed" notification received for the failed attempt — confirmed
- [ ] All notifications confirmed sent to both the ticket channel and the tenant channel
- [ ] "Completed" notification includes which AI provider handled the step — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] "Started" notification sent at the beginning of each step handler
- [ ] "Completed" notification sent after each step's result is saved to the database
- [ ] "Failed" notification sent in the error handler for each failed attempt
- [ ] All notifications sent to both the ticket channel and the tenant channel
- [ ] "Completed" notification includes the active provider field
- [ ] Tested: full pipeline run, all four phase notifications received in order

---

#### US-6.3 — Final Result Notification ✅ MVP

**As a** support agent
**We want** a single comprehensive live notification the moment the full pipeline completes
**So that** the complete triage and resolution draft appear on screen instantly without any additional request

**Why it matters:** The final result notification is the primary deliverable of the live update system. It allows agents to act on the full result immediately — no additional load, no delay.

**Acceptance Criteria:**
- The completion notification contains the complete triage result and the complete resolution draft in a single message
- The notification is sent only after all results are saved to the database — never before
- The notification's contents match what the ticket status endpoint returns for the same ticket
- A failure notification is sent when a ticket is permanently failed, identifying which step failed and the reason

**Definition of Done:**
- [ ] Full pipeline completed — completion notification received by a connected client — confirmed
- [ ] Notification payload compared to the ticket status endpoint response — contents match exactly — confirmed
- [ ] Notification confirmed to arrive only after database save is complete — confirmed by sequence testing
- [ ] Permanent failure scenario: failure notification received by a connected client — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Completion notification assembled from both step results after the final database save
- [ ] Notification payload shaped to match the ticket status endpoint response format
- [ ] Notification sent to both the ticket channel and the tenant channel
- [ ] Notification sent only after the database transaction is confirmed complete
- [ ] Failure notification sent from the permanent failure path in US-5.2
- [ ] Failure notification includes ticket ID, failed step, and reason
- [ ] Tested: completion notification payload compared directly to ticket status endpoint response

---

#### US-6.4 — Multi-Server Live Update Support 🔜 Post-MVP

**As a** platform infrastructure team
**We want** live notifications to work correctly when the service runs on multiple servers simultaneously
**So that** clients connected to any server instance receive all their notifications regardless of which server sends them

**Why it matters:** At launch, a single server is sufficient. As load grows and the service scales, notifications sent by one server instance will not reach clients on another without this coordination layer.

**Acceptance Criteria:**
- Notifications sent by any server instance are received by clients connected to any other instance
- If the coordination service is unavailable, the service degrades gracefully — local notifications still work, cross-server do not
- The health check endpoint includes the status of the coordination service

**Definition of Done:**
- [ ] Two server instances running: notification sent via Instance A received by client on Instance B — confirmed
- [ ] Coordination service stopped: graceful degradation confirmed — local notifications still work
- [ ] Health check endpoint updated to include coordination service status — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Cross-server coordination service installed and configured
- [ ] Connection URL for coordination service added to environment configuration
- [ ] Coordination service health check integrated into the health check endpoint
- [ ] Graceful degradation confirmed when coordination is unavailable
- [ ] Tested with two server instances running simultaneously

---

#### US-6.5 — Real-Time Connection Security 🔜 Post-MVP

**As a** platform security team
**We want** every client connection to the live notification system validated before any channel subscription is granted
**So that** clients can only receive updates for tickets and tenants they are authorised to access

**Why it matters:** Without authorisation checks, any client that knows a ticket ID could subscribe to its live updates — a privacy and compliance risk for customer data.

**Acceptance Criteria:**
- Clients must provide a valid token to establish a live connection
- Clients can only subscribe to channels their token authorises them to access
- Unauthorised connection attempts are rejected immediately with a descriptive reason

**Definition of Done:**
- [ ] Valid token: connection accepted and subscription granted — confirmed
- [ ] Invalid or missing token: connection rejected immediately — confirmed
- [ ] Valid token for wrong ticket channel: subscription rejected — confirmed
- [ ] Rejection response includes a clear, descriptive reason — confirmed
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Token validation added as a connection-level check before any channel is joined
- [ ] Token validated against the upstream authorisation service
- [ ] Channel subscription checked against the permissions in the token
- [ ] Authorisation service URL configurable via environment setting
- [ ] Unauthorised attempts rejected with descriptive response
- [ ] Tested: valid token, invalid token, valid token for wrong channel

---

### Epic 7 — Visibility & Quality Assurance

**What this is:** Structured logging across every pipeline component and a comprehensive testing suite — unit, integration, and end-to-end — that validates every layer of the system from API submission to live notification delivery.

**Why it matters:** You cannot improve what you cannot see, and you cannot ship safely without tests. These capabilities are what transform a working system into a production-ready one.

**Epic Definition of Done:**
- [ ] Every log entry across the entire system is valid structured data — parseable by any log tool — confirmed by parsing all logs with a JSON parser
- [ ] All eight defined pipeline event types produce a log entry when triggered — confirmed by running the full pipeline and inspecting logs
- [ ] A complete pipeline run can be reconstructed from log entries alone — confirmed without accessing the database
- [ ] All unit tests pass — coverage of at least 80% on core business logic
- [ ] All integration tests pass on three consecutive runs — no flakiness
- [ ] No sensitive values appear in any log entry — confirmed by inspection
- [ ] All MVP user stories (US-7.1 through US-7.4) have passed their acceptance criteria and been signed off by a second team member

---

#### US-7.1 — Structured System Logs ✅ MVP

**As an** engineering and operations team
**We want** every log entry written as structured, machine-readable data with sensitive values excluded
**So that** any log tool can parse, search, and alert on the log stream without manual cleaning or interpretation

**Why it matters:** Unstructured logs are slow to search and impossible to build reliable monitoring on. Structured logs enable the team to answer operational questions in seconds.

**Acceptance Criteria:**
- Every log entry is structured data — readable and searchable by any standard log tool
- The log detail level is configurable without a code deployment — default is "info" in production
- No sensitive values — API keys, passwords, connection strings — ever appear in any log entry
- All log output in the codebase comes through the central logger — no ad-hoc output anywhere

**Definition of Done:**
- [ ] Every log line confirmed to be valid structured data — parsed with a JSON tool, no failures
- [ ] Log detail level changed via configuration setting — confirmed to take effect without code change
- [ ] API key deliberately included in a test scenario — confirmed absent from all log output
- [ ] Entire codebase inspected — no ad-hoc output calls found
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Logging library installed and configured with structured output format
- [ ] Base context fields added to every log entry: service name, environment, application version
- [ ] Log detail level controlled by an environment setting (default: "info")
- [ ] Sensitive fields added to the automatic exclusion list
- [ ] Human-readable format enabled in local development environment only
- [ ] Code quality rule added to prevent ad-hoc output calls anywhere in the codebase
- [ ] All remaining ad-hoc output calls replaced with the central logger

---

#### US-7.2 — Complete Pipeline Event Logging ✅ MVP

**As an** engineering and operations team
**We want** a structured log entry at every significant pipeline event with all relevant context fields
**So that** any failure, retry, or provider fallback can be fully reconstructed from logs alone — without database access

**Why it matters:** Complete event logging is the operational nervous system. When something goes wrong in production, the log trail is often the only way to understand what happened, in what order, and why.

**Acceptance Criteria:**
- All eight pipeline event types produce a structured log entry when triggered
- Each entry includes all relevant context: ticket ID, event type, step name, duration, AI provider used, attempt number, and retry wait time where applicable
- A complete pipeline run can be reconstructed from log entries alone — without accessing the database

**Definition of Done:**
- [ ] Full pipeline run executed — logs inspected — all eight event types present — confirmed
- [ ] Forced failure scenario: retry events, fallback events, and permanent failure event all present — confirmed
- [ ] Pipeline run reconstructed from log entries alone — sequence is accurate — confirmed
- [ ] All context fields present on every log entry type — confirmed by inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] "Step started" log added at the beginning of each step handler
- [ ] "Step completed" log added after each successful save — includes duration and provider
- [ ] "Step failed" log added in each error handler — includes attempt number and error description
- [ ] "Retry" log added before each retry wait — includes wait duration
- [ ] "Provider fallback" log added when a non-primary provider handles the request
- [ ] "Permanently failed" log added when maximum retries are reached
- [ ] "Pipeline complete" log added after final save — includes total duration
- [ ] "Replay initiated" log added when a replay action is taken
- [ ] Duration measured using timestamps at start and end of each step

---

#### US-7.3 — Unit Tests ✅ MVP

**As an** engineering team
**We want** automated tests for all core business logic that run in seconds without requiring infrastructure
**So that** we can catch logic errors immediately and refactor with confidence throughout the delivery week

**Why it matters:** Unit tests are the fastest feedback loop available. In a 1-week Kanban delivery, they are the primary safety net as each story is built.

**Acceptance Criteria:**
- Retry timing logic fully tested — range constraints and non-determinism confirmed across 100 samples per attempt number
- Output validation rules for both Step 1 and Step 2 tested — valid input, missing fields, wrong values, length limits
- AI gateway connection layer tested using simulated responses — no real AI calls made in unit tests
- Step status transition logic tested for all transitions, including the skip-if-already-complete behaviour
- At least 80% of core business logic is covered by tests

**Definition of Done:**
- [ ] All unit tests pass — zero failures
- [ ] Coverage report generated — 80% or above on core business logic — confirmed
- [ ] Retry timing tests confirm range and non-determinism across 100 samples
- [ ] Validation tests confirm all rejection scenarios
- [ ] Status transition tests confirm the skip-if-complete behaviour
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Testing framework installed and configured
- [ ] Retry timing tests: range constraints and non-determinism
- [ ] Step 1 output validation tests: valid input, missing each required field, invalid priority value, summary over 200 characters
- [ ] Step 2 output validation tests: valid input, missing customer reply, missing internal note, zero next actions, six next actions
- [ ] Gateway connection tests: simulated successful response, simulated timeout, simulated error
- [ ] Phase status transition tests: pending → running, running → success, running → failed, skip if already success
- [ ] Coverage report configuration added
- [ ] Coverage confirmed at 80% or above on target files

---

#### US-7.4 — Integration Tests ✅ MVP

**As an** engineering team
**We want** automated tests running against real local infrastructure that verify the full request lifecycle
**So that** we can confirm everything works together before merging any change

**Why it matters:** Unit tests verify logic in isolation. Integration tests verify that the pieces work correctly together against real dependencies — catching issues that only appear when real systems interact.

**Acceptance Criteria:**
- Ticket submission integration test confirms a database record and a queue message are both created correctly
- Ticket status query tests cover all four states: queued, processing, completed, and failed
- Worker processing test confirms all status transitions in the database happen in the correct sequence
- Retry test confirms the attempt count increments correctly over multiple failures
- Replay test confirms the correct step re-runs and the already-completed step is preserved
- All tests pass consistently on three consecutive runs with no failures

**Definition of Done:**
- [ ] All integration tests pass on three consecutive runs — zero failures across all three runs
- [ ] Ticket submission test confirms both database record and queue message — both verified directly
- [ ] All four ticket state scenarios tested and confirmed
- [ ] Retry test: attempt count confirmed to increment correctly — verified by database inspection
- [ ] Replay test: Step 1 preserved, Step 2 re-run — confirmed by database inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Integration test environment configured with real database and real queues
- [ ] Each test creates its own unique ticket ID and cleans up after itself
- [ ] Ticket submission test: submit ticket, confirm database record created, confirm queue message present
- [ ] Ticket status tests: one test per state (queued, processing, completed, failed)
- [ ] Worker processing test: enqueue message, worker processes it, confirm database status transitions
- [ ] Retry test: cause two failures, confirm attempt count is two, third attempt succeeds
- [ ] Replay test: permanently fail Step 2, replay, confirm Step 1 not retried, Step 2 re-runs and completes
- [ ] All tests confirmed to pass on three consecutive runs

---

#### US-7.5 — Full End-to-End Tests 🔜 Post-MVP

**As a** QA team
**We want** automated tests that simulate the complete user journey from ticket submission to live notification receipt
**So that** we can validate the entire system works together before every release

**Why it matters:** End-to-end tests are the highest-confidence safety net — they validate every layer of the system together. Their complexity makes them better suited to a post-MVP cycle when the system is stable.

**Acceptance Criteria:**
- A ticket is submitted, the full pipeline runs, and the final completion notification is received — all in a single automated test
- All intermediate notifications are received in the correct order
- The final notification's content matches the ticket status endpoint response
- Tests pass consistently on three consecutive runs

**Definition of Done:**
- [ ] Full end-to-end test: all five notifications received in correct order — Step 1 started, Step 1 completed, Step 2 started, Step 2 completed, pipeline complete — confirmed
- [ ] Notification payload compared to ticket status response — contents match — confirmed
- [ ] Three consecutive end-to-end test runs — all pass, no flakiness
- [ ] End-to-end tests confirmed to run independently without triggering unit or integration tests
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] End-to-end test environment set up with a live notification client
- [ ] Test: submit ticket, subscribe to ticket channel, wait for all five notifications in order
- [ ] All five notifications asserted in sequence
- [ ] Final notification payload compared against ticket status endpoint for the same ticket
- [ ] Tests tagged separately — excluded from unit and integration test runs
- [ ] Three consecutive runs confirmed passing

---

#### US-7.6 — Distributed Request Tracing 🔜 Post-MVP

**As an** engineering team
**We want** every ticket's full journey traced as a connected visual timeline across all pipeline stages
**So that** latency bottlenecks and failures can be pinpointed instantly without manual log investigation

**Why it matters:** When processing is slow or errors occur at scale, finding where in the pipeline the issue happened is time-consuming. Distributed tracing makes this visible instantly in a single visual view.

**Acceptance Criteria:**
- A single connected trace is created for each ticket covering the full pipeline
- Each AI call appears as a segment in the trace showing its duration and which provider handled it
- Retry attempts appear as sub-segments under their parent step
- The trace ID appears in all log entries for the same ticket, linking logs and traces

**Definition of Done:**
- [ ] Full pipeline run: single connected trace visible in the trace viewer covering all stages — confirmed
- [ ] AI calls appear as named segments with duration and provider — confirmed
- [ ] Retry attempt appears as a sub-segment under the relevant step — confirmed
- [ ] Trace ID appears in all log entries for the same ticket — confirmed by log inspection
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Distributed tracing library installed and configured
- [ ] Trace exporter endpoint configurable via environment setting
- [ ] Parent trace span created at API submission
- [ ] Child spans created for each step handler, each AI call, and each retry attempt
- [ ] Trace ID injected into the log context for every log entry for the same ticket
- [ ] Tested: full pipeline run visible as a single connected trace in the trace viewer

---

#### US-7.7 — Load and Performance Testing 🔜 Post-MVP

**As a** platform infrastructure team
**We want** a load test suite that simulates peak ticket volumes and verifies all performance targets are met
**So that** we have evidence-based confidence before making scaling decisions or onboarding new customer segments

**Why it matters:** A system that works at 10 tickets per minute may fail at 100. Performance under realistic load must be verified with data before scaling decisions are made.

**Acceptance Criteria:**
- The load test simulates the expected peak submission rate for at least five minutes
- All performance targets from Section 5 are measured and reported
- The test report clearly shows whether each target was met or missed
- No tickets are lost or corrupted during the load test

**Definition of Done:**
- [ ] Load test run against the staging environment at target peak volume for five minutes — confirmed
- [ ] Report generated covering all metrics from Section 5 — all targets met — confirmed
- [ ] Zero tickets lost or corrupted — confirmed by comparing submitted count to completed count
- [ ] Load test report archived for future reference
- [ ] Story moved to COMPLETE on the board

**Checklist:**
- [ ] Load testing tool installed and configured
- [ ] Test scenario written to simulate ticket submission at target peak rate with a ramp-up period
- [ ] Pass/fail thresholds configured to match the targets in Section 5
- [ ] Test run against the staging environment
- [ ] Report generated and reviewed — all targets confirmed met
- [ ] Zero data loss confirmed: submitted ticket count matches completed ticket count

---

## 9. MVP Summary

### MVP User Stories — Must Reach COMPLETE in Week 1

| Story ID | Epic | Title | Priority |
|---|---|---|---|
| US-1.1 | The Foundation | Project Setup and Structure | Critical |
| US-1.2 | The Foundation | Local Environment Setup | Critical |
| US-1.3 | The Foundation | Data Storage Structure | Critical |
| US-1.4 | The Foundation | Configuration Management | Critical |
| US-1.5 | The Foundation | Submit Ticket Endpoint | Critical |
| US-1.6 | The Foundation | Check Ticket Status Endpoint | High |
| US-1.7 | The Foundation | Service Health Check | High |
| US-2.1 | The Processing Engine | Step 1 Worker | Critical |
| US-2.2 | The Processing Engine | Step 2 Worker | Critical |
| US-2.3 | The Processing Engine | Automatic Step Handoff | Critical |
| US-3.1 | The AI Brain | AI Gateway Connection | Critical |
| US-3.2 | The AI Brain | Automatic AI Provider Fallback | High |
| US-4.1 | The AI Pipeline | Step 1: Triage Analysis | Critical |
| US-4.2 | The AI Pipeline | Step 1 Result Saving | Critical |
| US-4.3 | The AI Pipeline | Step 2: Resolution Draft Generation | Critical |
| US-4.4 | The AI Pipeline | Step 2 Result Saving and Completion | Critical |
| US-5.1 | Reliability & Recovery | Smart Retry Timing | High |
| US-5.2 | Reliability & Recovery | Automatic Retry with Step Preservation | Critical |
| US-5.3 | Reliability & Recovery | Ticket Replay (Manual Recovery) | High |
| US-6.1 | Live Updates | Real-Time Connection and Room Management | High |
| US-6.2 | Live Updates | Step Progress Notifications | High |
| US-6.3 | Live Updates | Final Result Notification | High |
| US-7.1 | Visibility & QA | Structured System Logs | High |
| US-7.2 | Visibility & QA | Complete Pipeline Event Logging | High |
| US-7.3 | Visibility & QA | Unit Tests | High |
| US-7.4 | Visibility & QA | Integration Tests | High |

**Total MVP User Stories: 26**

### Post-MVP User Stories — Remain in BACKLOG

| Story ID | Epic | Title | Why Deferred |
|---|---|---|---|
| US-1.8 | The Foundation | Request Rate Limiting | Not needed at launch volume |
| US-1.9 | The Foundation | API Versioning | Relevant when breaking changes are introduced |
| US-2.4 | The Processing Engine | Parallel Ticket Processing | Needed at scale; single-ticket is sufficient at launch |
| US-3.3 | The AI Brain | Separate AI Configurations Per Step | Optimisation; one config works for both at launch |
| US-3.4 | The AI Brain | AI Usage and Cost Tracking | Useful once volume justifies cost analysis |
| US-4.5 | The AI Pipeline | Editable AI Instructions | Improves iteration speed; not launch-blocking |
| US-4.6 | The AI Pipeline | Failed AI Response Archiving | Debugging aid; patterns emerge post-launch |
| US-5.4 | Reliability & Recovery | Failed Ticket Queue Inspector | Self-service ops; replay API covers launch needs |
| US-5.5 | Reliability & Recovery | Automatic Replay | Off-hours automation; manual replay sufficient at launch |
| US-6.4 | Live Updates | Multi-Server Live Update Support | Required only when running multiple servers |
| US-6.5 | Live Updates | Real-Time Connection Security | Required before live updates reach external clients |
| US-7.5 | Visibility & QA | Full End-to-End Tests | Built when system is stable — after MVP |
| US-7.6 | Visibility & QA | Distributed Request Tracing | Valuable at scale; overkill at launch |
| US-7.7 | Visibility & QA | Load and Performance Testing | Required before scaling decisions; not launch-blocking |

**Total Post-MVP User Stories: 14**

---

## 10. 1-Week Kanban Delivery Flow

### Team

2 engineers working in parallel across 5 working days, each pulling work from the board as capacity allows.

### Daily Flow Targets

| Day | Primary Focus | Epics in Flow | End-of-Day Exit Condition |
|---|---|---|---|
| **Day 1** | The Foundation | Epic 1 | All 7 MVP foundation user stories reach COMPLETE. Ticket can be submitted and queried. Health check is green. Database and all four queues are operational. |
| **Day 2** | The Processing Engine + The AI Brain | Epics 2, 3 | Both workers running and consuming messages. AI gateway connected and tested. Provider fallback confirmed working in gateway sandbox. |
| **Day 3** | The AI Pipeline | Epic 4 | Full pipeline runs end-to-end: ticket submitted → Step 1 triage → Step 2 resolution draft → ticket status shows "completed". |
| **Day 4** | Reliability & Recovery + Live Updates | Epics 5, 6 | Retry behaviour confirmed with correct step preservation. Permanently failed ticket confirmed replayable. Connected client receives all five live notifications on a full pipeline run. |
| **Day 5** | Visibility & Quality Assurance | Epic 7 | All logs are structured JSON. All eight event types confirmed in logs. Unit tests pass with 80%+ coverage. Integration tests pass on three consecutive runs. |

### Board Management Rules

- All 26 MVP user stories start the week in **BACKLOG**
- Stories move to **PRESTAGE** as engineers become available — one at a time, in priority order
- Stories move to **IN PROGRESS** when an engineer actively starts building
- Stories move to **COMPLETE** only when all acceptance criteria are met, definition of done is checked off, and a second team member has confirmed them
- All 14 Post-MVP stories remain in **BACKLOG** throughout the week — no Post-MVP story enters PRESTAGE until all MVP stories are COMPLETE
- Any story in IN PROGRESS for more than 4 hours without progress is flagged as a blocker immediately

---

## 11. Risks & Dependencies

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Portkey provider credentials not ready before Day 2 | Medium | High — blocks all AI pipeline work | Confirm all three provider credentials set up in Portkey before Day 1 ends |
| AI provider rate limits triggered during integration testing | Medium | Medium — test failures, not production failures | Use gateway sandbox; fallback chain handles rate limits automatically in production |
| Scope additions requested during the week | Medium | High — no slack in a 5-day Kanban cycle | All new requests go directly to Post-MVP BACKLOG; no mid-week additions |
| Database schema changes discovered after Day 1 | Low | High — requires changes and re-testing across multiple stories | Schema reviewed and finalised in the Technical PRD before Day 1 begins |
| Two engineers blocked on the same dependency simultaneously | Low | Medium — loses a day of parallel capacity | Dependencies sequenced so Day 1 unblocks both engineers independently from Day 2 |

### External Dependencies

| Dependency | Owner | Required By |
|---|---|---|
| Portkey account with provider credentials for Claude, OpenAI, and Gemini | Platform / Operations | Start of Day 2 |
| Local development environment (Node.js, database, AWS CLI) set up on all machines | Each engineer | Start of Day 1 |
| Portkey sandbox environment accessible for integration testing | Platform / Operations | End of Day 2 |
| Second team member available to sign off completed stories throughout the week | Team Lead / PM | Throughout the week |

---

## 12. Open Questions

| # | Question | Who Decides | Impact if Unanswered |
|---|---|---|---|
| 1 | Are all three Portkey provider credentials provisioned and confirmed working before Day 2? | Platform / Operations | Blocks all AI pipeline work from Day 2 |
| 2 | What is the expected peak ticket submission volume per minute at launch? | Product / Business | Affects worker concurrency configuration and initial capacity planning |
| 3 | Should permanently failed ticket notifications be sent to the tenant live channel as well as the ticket channel? | Product | Affects US-6.3 scope |
| 4 | Is any access restriction required on the Failed Ticket Queue Inspector (US-5.4) for internal use? | Security / Operations | Affects Post-MVP scope definition |
| 5 | Are there data retention requirements for ticket content — deletion timelines for compliance? | Legal / Compliance | May require additional database design post-MVP |
| 6 | Should AI usage and cost information (US-3.4) be visible to agents, managers only, or engineering only? | Product | Affects Post-MVP access control design |

---

## 13. Glossary of Key Terms

| Term | Plain Language Explanation |
|---|---|
| **Triage** | Step 1 of the AI pipeline — the automated process of reading a ticket and producing a structured classification: category, priority, sentiment, escalation flag, routing target, and summary |
| **Resolution Draft** | Step 2 of the AI pipeline — the AI-generated customer reply, internal agent note, and recommended next actions |
| **Processing Queue** | A managed, durable waiting list for tickets. After submission, tickets are placed here and picked up by workers in order. Nothing in the queue is lost, even if the system restarts. |
| **Worker** | A background process that runs continuously, picks up tickets from a queue, processes them, and saves the results — without any manual trigger |
| **Recovery Queue (DLQ)** | A separate, safe holding area for tickets that have failed all three processing attempts. Nothing is deleted — tickets wait here until manually or automatically replayed. |
| **Retry** | Automatically trying to process a step again after a failure, with an increasing waiting period between each attempt |
| **Replay** | Manually re-processing a permanently failed ticket from the step that failed — without repeating any steps that already succeeded |
| **Step Preservation (Checkpointing)** | The system's built-in memory of which steps have already succeeded. Completed steps are never repeated — even during retries or replays. |
| **AI Gateway (Portkey)** | A service that sits between the application and AI providers. It receives AI requests and routes them to the best available provider — handling fallback automatically. |
| **Provider Fallback** | Automatic switching to the next AI provider when the current one is unavailable. Order: Claude → OpenAI → Gemini. |
| **Claude / OpenAI / Gemini** | The three AI providers used by the system. Claude is the primary. OpenAI and Gemini are used automatically if Claude is unavailable. |
| **Real-Time Notification** | A message delivered instantly to a connected client when something happens — no page refresh or manual check required |
| **Subscription Channel** | A named channel a client joins to receive live updates, scoped per-ticket or per-tenant |
| **Structured Logs** | Log entries in a consistent, machine-readable format — searchable, filterable, and usable for automated alerting |
| **Unit Test** | An automated check verifying a single piece of logic works correctly in isolation — no database, no queue, no AI provider required |
| **Integration Test** | An automated check verifying multiple pieces work correctly together against real local dependencies |
| **End-to-End Test** | An automated check simulating the complete user journey from API submission to live notification receipt |
| **Health Check** | A dedicated endpoint reporting in real time whether the service and all critical dependencies are operational |
| **MVP** | Minimum Viable Product — the smallest set of user stories that makes the service production-ready and useful |
| **Post-MVP** | User stories that are fully defined and backlogged but intentionally deferred to a future Kanban cycle |
| **PRESTAGE** | The Kanban board column for stories that are fully defined, all blockers cleared, and ready to be picked up |
| **Kanban** | A delivery methodology where work flows continuously through defined board columns based on team capacity — no fixed sprint cycles, work is pulled by engineers when ready |
| **Cycle Time** | The time a single user story takes to move from PRESTAGE to COMPLETE — the primary flow metric in Kanban |
| **WIP Limit** | Work-in-Progress Limit — the maximum stories allowed in IN PROGRESS at any time. Enforcing WIP limits prevents overload and makes bottlenecks visible. |
| **Definition of Done** | A checklist of conditions that must all be confirmed before a user story or epic can be marked COMPLETE |
| **Acceptance Criteria** | The specific, testable conditions that define whether a user story delivers what was intended |
| **User Story (US)** | A single unit of deliverable work written from a user's perspective — the building block of Kanban delivery |
