// US-2.2 + US-2.3 + US-3.1 + US-3.2: integration tests for Step 2 worker, handoff, and AI gateway use
import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import pino from 'pino';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AiGatewayResponse, AiResolutionInput, AiTicketInput, IAiGateway } from '../../src/ai';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { pool } from '../../src/db';
import { SqsQueueConsumer } from '../../src/queue/sqs.consumer';
import { TicketQueue } from '../../src/queue/ticket.queue';
import type { INotificationService } from '../../src/realtime';
import {
  ResolutionRepository,
  type ResolutionResult,
} from '../../src/repositories/resolution.repository';
import { TriageRepository, type TriageResult } from '../../src/repositories/triage.repository';
import { ResolutionStepService } from '../../src/services/resolution-step.service';
import { TriageStepService } from '../../src/services/triage-step.service';
import type { ITicketStatusReader } from '../../src/services/ticket.service';
import { Phase1Worker } from '../../src/workers/phase1.worker';
import { Phase2Worker } from '../../src/workers/phase2.worker';

const logger = pino({ level: 'silent' });
const sqsClient = new SQSClient({
  region: config.AWS_REGION,
  endpoint: config.LOCALSTACK_ENDPOINT,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const phase1QueueUrl = config.SQS_PHASE1_QUEUE_URL;
const phase2QueueUrl = config.SQS_PHASE2_QUEUE_URL;
const createdTicketIds: string[] = [];
const activeWorkers: Array<Phase1Worker | Phase2Worker> = [];

beforeAll(async () => {
  await clearQueue(phase1QueueUrl);
  await clearQueue(phase2QueueUrl);
});

afterEach(async () => {
  await stopActiveWorkers();
  await drainQueueUntilEmpty(phase1QueueUrl);
  await drainQueueUntilEmpty(phase2QueueUrl);

  if (createdTicketIds.length > 0) {
    await pool.query('DELETE FROM tickets WHERE id = ANY($1::uuid[])', [createdTicketIds]);
    createdTicketIds.length = 0;
  }
});

afterAll(async () => {
  sqsClient.destroy();
});

describe('Phase2Worker', () => {
  it('processes a Step 2 message after triage success and marks the ticket completed', async () => {
    const ticketId = await insertTicket('manual-step2');
    await insertSuccessfulTriage(ticketId);
    await sendMessage(phase2QueueUrl, { ticketId });

    const phase2Worker = createPhase2Worker();
    activeWorkers.push(phase2Worker);
    phase2Worker.start();

    await waitFor(async () => {
      const phase = await getPhase(ticketId, 'resolution');
      return phase?.status === 'success';
    });

    const phase = await getPhase(ticketId, 'resolution');
    expect(phase).toMatchObject({
      status: 'success',
      attempt_count: 1,
      provider_used: 'openrouter',
      error_message: null,
    });
    expect(phase?.result).toMatchObject({
      customer_reply:
        'Thanks for contacting support. We are reviewing your request and will follow up with next steps.',
      internal_note: 'Stub resolution draft generated after successful triage.',
      recommended_actions: ['Review triage metadata', 'Assign to the suggested support queue'],
    });

    const ticket = await pool.query<{ status: string }>('SELECT status FROM tickets WHERE id = $1', [
      ticketId,
    ]);
    expect(ticket.rows[0].status).toBe('completed');
  });

  it('does not delete the Step 2 message when triage is not successful', async () => {
    const ticketId = await insertTicket('triage-not-ready');
    await sendMessage(phase2QueueUrl, { ticketId });

    const phase2Worker = createPhase2Worker(1, 1);
    activeWorkers.push(phase2Worker);
    phase2Worker.start();

    await sleep(500);
    await phase2Worker.stop(5000);
    activeWorkers.length = 0;

    expect(await getPhase(ticketId, 'resolution')).toBeNull();
    expect(await getApproximateQueueMessageCount(phase2QueueUrl)).toBeGreaterThanOrEqual(1);
    await sleep(1200);
    await drainQueue(phase2QueueUrl);
  }, 10_000);

  it('deletes a duplicate Step 2 message when resolution is already successful', async () => {
    const ticketId = await insertTicket('duplicate-resolution');
    await insertSuccessfulTriage(ticketId);
    await insertSuccessfulResolution(ticketId);
    await sendMessage(phase2QueueUrl, { ticketId });

    const phase2Worker = createPhase2Worker();
    activeWorkers.push(phase2Worker);
    phase2Worker.start();

    await sleep(500);
    await phase2Worker.stop(5000);
    activeWorkers.length = 0;

    const phase = await getPhase(ticketId, 'resolution');
    expect(phase).toMatchObject({
      status: 'success',
      attempt_count: 1,
      provider_used: 'manual',
    });
    expect(await receiveOneMessage(phase2QueueUrl)).toBeNull();
  });

  it('finishes the in-flight Step 2 ticket before graceful shutdown completes', async () => {
    const ticketId = await insertTicket('shutdown');
    await insertSuccessfulTriage(ticketId);
    await sendMessage(phase2QueueUrl, { ticketId });

    const phase2Worker = createPhase2Worker(1, 500);
    activeWorkers.push(phase2Worker);
    phase2Worker.start();

    await waitFor(async () => {
      const phase = await getPhase(ticketId, 'resolution');
      return phase?.status === 'running';
    });

    await phase2Worker.stop(5000);
    activeWorkers.length = 0;

    const phase = await getPhase(ticketId, 'resolution');
    expect(phase?.status).toBe('success');
  });

  it('records provider fallback when a non-primary provider handles Step 2', async () => {
    const ticketId = await insertTicket('fallback-resolution');
    await insertSuccessfulTriage(ticketId);
    await sendMessage(phase2QueueUrl, { ticketId });

    const phase2Worker = createPhase2Worker(5, 50, new FakeAiGateway('openai'));
    activeWorkers.push(phase2Worker);
    phase2Worker.start();

    await waitFor(async () => {
      const phase = await getPhase(ticketId, 'resolution');
      return phase?.status === 'success';
    });

    const phase = await getPhase(ticketId, 'resolution');
    expect(phase?.provider_used).toBe('openai');

    const events = await pool.query<{ event_type: string; metadata: Record<string, unknown> }>(
      `SELECT event_type, metadata
       FROM ticket_events
       WHERE ticket_id = $1 AND step_name = 'resolution'
       ORDER BY created_at ASC`,
      [ticketId],
    );

    expect(events.rows.some((row) => row.event_type === 'provider_fallback')).toBe(true);
    expect(events.rows.find((row) => row.event_type === 'provider_fallback')?.metadata).toMatchObject({
      primary_provider: 'openrouter',
      provider_used: 'openai',
    });
  });

  it('runs the full pipeline automatically from ticket submission to completion', async () => {
    await drainQueueUntilEmpty(phase1QueueUrl);
    await drainQueueUntilEmpty(phase2QueueUrl);

    const app = createApp();
    const phase1Worker = createPhase1Worker(20);
    const phase2Worker = createPhase2Worker(1, 20);
    activeWorkers.push(phase1Worker, phase2Worker);
    phase1Worker.start();
    phase2Worker.start();

    const response = await request(app)
      .post('/tickets')
      .send({
        subject: 'Login broken',
        body: 'I cannot log in since this morning.',
        submitter: 'alice@example.com',
        tenant_id: `pipeline-${Date.now()}`,
      })
      .expect(202);

    createdTicketIds.push(response.body.ticketId);

    await waitFor(async () => {
      const ticket = await pool.query<{ status: string }>('SELECT status FROM tickets WHERE id = $1', [
        response.body.ticketId,
      ]);
      return ticket.rows[0]?.status === 'completed';
    }, 8000);

    const triage = await getPhase(response.body.ticketId, 'triage');
    const resolution = await getPhase(response.body.ticketId, 'resolution');
    const events = await pool.query<{ event_type: string }>(
      `SELECT event_type
       FROM ticket_events
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [response.body.ticketId],
    );

    expect(triage?.status).toBe('success');
    expect(resolution?.status).toBe('success');
    expect(events.rows.map((row) => row.event_type)).toContain('step_handoff');
  }, 12_000);
});

function createPhase1Worker(delayMs = 50): Phase1Worker {
  const consumer = new SqsQueueConsumer(sqsClient, phase1QueueUrl);
  const service = new TriageStepService(
    new TriageRepository(),
    new TicketQueue(sqsClient, phase2QueueUrl),
    new FakeAiGateway(),
    makeNotifier(),
    makeStatusReader(),
    logger,
    delayMs,
  );

  return new Phase1Worker(consumer, service, logger, {
    waitSeconds: 1,
    maxMessages: 1,
    visibilityTimeout: 5,
  });
}

function createPhase2Worker(
  visibilityTimeout = 5,
  delayMs = 50,
  aiGateway: IAiGateway = new FakeAiGateway(),
): Phase2Worker {
  const consumer = new SqsQueueConsumer(sqsClient, phase2QueueUrl);
  const service = new ResolutionStepService(
    new ResolutionRepository(),
    aiGateway,
    makeNotifier(),
    makeStatusReader(),
    logger,
    delayMs,
  );

  return new Phase2Worker(consumer, service, logger, {
    waitSeconds: 1,
    maxMessages: 1,
    visibilityTimeout,
  });
}

function makeNotifier(): INotificationService {
  return { publishTicketUpdate: () => undefined };
}

function makeStatusReader(): ITicketStatusReader {
  return { getById: async () => null };
}

class FakeAiGateway implements IAiGateway {
  readonly primaryProvider = 'openrouter';

  constructor(private readonly provider = 'openrouter') {}

  async triageTicket(input: AiTicketInput): Promise<AiGatewayResponse<TriageResult>> {
    void input;
    return {
      provider: this.provider,
      primaryProvider: this.primaryProvider,
      fallback: this.provider !== this.primaryProvider,
      result: {
        category: 'general',
        priority: 'medium',
        sentiment: 'neutral',
        escalation_needed: false,
        routing_target: 'tier1',
        summary: 'Stub triage result for worker verification',
      },
    };
  }

  async draftResolution(
    input: AiResolutionInput,
  ): Promise<AiGatewayResponse<ResolutionResult>> {
    void input;
    return {
      provider: this.provider,
      primaryProvider: this.primaryProvider,
      fallback: this.provider !== this.primaryProvider,
      result: {
        customer_reply:
          'Thanks for contacting support. We are reviewing your request and will follow up with next steps.',
        internal_note: 'Stub resolution draft generated after successful triage.',
        recommended_actions: ['Review triage metadata', 'Assign to the suggested support queue'],
      },
    };
  }
}

async function insertTicket(label: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO tickets (tenant_id, submitter, subject, body, status)
     VALUES ($1, 'alice', $2, 'Cannot log in', 'processing')
     RETURNING id`,
    [`resolution-${label}-${Date.now()}`, `Resolution test ${label}`],
  );
  createdTicketIds.push(result.rows[0].id);
  return result.rows[0].id;
}

async function insertSuccessfulTriage(ticketId: string): Promise<void> {
  await pool.query(
    `INSERT INTO ticket_phases (
       ticket_id,
       step_name,
       status,
       attempt_count,
       result,
       provider_used,
       started_at,
       finished_at
     )
     VALUES ($1, 'triage', 'success', 1, $2::jsonb, 'stub', now(), now())`,
    [
      ticketId,
      JSON.stringify({
        category: 'general',
        priority: 'medium',
        sentiment: 'neutral',
        escalation_needed: false,
        routing_target: 'tier1',
        summary: 'Stub triage result for worker verification',
      }),
    ],
  );
}

async function insertSuccessfulResolution(ticketId: string): Promise<void> {
  await pool.query(
    `INSERT INTO ticket_phases (
       ticket_id,
       step_name,
       status,
       attempt_count,
       result,
       provider_used,
       started_at,
       finished_at
     )
     VALUES ($1, 'resolution', 'success', 1, $2::jsonb, 'manual', now(), now())`,
    [ticketId, JSON.stringify({ customer_reply: 'Already done' })],
  );
}

async function sendMessage(targetQueueUrl: string, message: object | string): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: targetQueueUrl,
      MessageBody: typeof message === 'string' ? message : JSON.stringify(message),
    }),
  );
}

async function receiveOneMessage(targetQueueUrl: string): Promise<{ receiptHandle: string } | null> {
  const response = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: targetQueueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 0,
      VisibilityTimeout: 1,
    }),
  );

  const message = response.Messages?.[0];
  if (!message?.ReceiptHandle) return null;
  return { receiptHandle: message.ReceiptHandle };
}

async function deleteMessage(targetQueueUrl: string, receiptHandle: string): Promise<void> {
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: targetQueueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

async function getApproximateQueueMessageCount(targetQueueUrl: string): Promise<number> {
  const response = await sqsClient.send(
    new GetQueueAttributesCommand({
      QueueUrl: targetQueueUrl,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
    }),
  );

  const visible = Number(response.Attributes?.ApproximateNumberOfMessages ?? 0);
  const notVisible = Number(response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? 0);
  return visible + notVisible;
}

async function getPhase(
  ticketId: string,
  stepName: 'triage' | 'resolution',
): Promise<{
  status: string;
  attempt_count: number;
  result: Record<string, unknown> | null;
  provider_used: string | null;
  error_message: string | null;
} | null> {
  const result = await pool.query(
    `SELECT status, attempt_count, result, provider_used, error_message
     FROM ticket_phases
     WHERE ticket_id = $1 AND step_name = $2`,
    [ticketId, stepName],
  );

  return result.rows[0] ?? null;
}

async function clearQueue(targetQueueUrl: string): Promise<void> {
  try {
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: targetQueueUrl }));
    await sleep(1000);
  } catch {
    // LocalStack follows SQS purge cooldown rules; draining handles cooldown windows.
  }

  await drainQueueUntilEmpty(targetQueueUrl);
}

async function drainQueueUntilEmpty(targetQueueUrl: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await drainQueue(targetQueueUrl);
    if ((await getApproximateQueueMessageCount(targetQueueUrl)) === 0) return;
    await sleep(500);
  }

  throw new Error(`queue did not empty within 10000ms: ${targetQueueUrl}`);
}

async function drainQueue(targetQueueUrl: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const response = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: targetQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
        VisibilityTimeout: 1,
      }),
    );

    const messages = response.Messages ?? [];
    if (messages.length === 0) return;

    await Promise.all(
      messages
        .filter((message) => message.ReceiptHandle)
        .map((message) => deleteMessage(targetQueueUrl, message.ReceiptHandle as string)),
    );
  }
}

async function stopActiveWorkers(): Promise<void> {
  await Promise.all(activeWorkers.map((worker) => worker.stop(5000)));
  activeWorkers.length = 0;
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await sleep(50);
  }

  throw new Error(`condition not met within ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
