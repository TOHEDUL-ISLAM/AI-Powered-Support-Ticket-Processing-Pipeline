// US-2.1 + US-2.3 + US-3.1: integration tests for Step 1 worker, handoff, and AI gateway use
import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import pino from 'pino';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AiGatewayResponse, AiResolutionInput, AiTicketInput, IAiGateway } from '../../src/ai';
import { config } from '../../src/config';
import { pool } from '../../src/db';
import { SqsQueueConsumer } from '../../src/queue/sqs.consumer';
import { TicketQueue, type ITicketQueue } from '../../src/queue/ticket.queue';
import type { INotificationService } from '../../src/realtime';
import type { ResolutionResult } from '../../src/repositories/resolution.repository';
import { TriageRepository, type TriageResult } from '../../src/repositories/triage.repository';
import { TriageStepService, type ITriageStepService } from '../../src/services/triage-step.service';
import type { ITicketStatusReader } from '../../src/services/ticket.service';
import { Phase1Worker } from '../../src/workers/phase1.worker';

const logger = pino({ level: 'silent' });
const sqsClient = new SQSClient({
  region: config.AWS_REGION,
  endpoint: config.LOCALSTACK_ENDPOINT,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const queueUrl = config.SQS_PHASE1_QUEUE_URL;
const phase2QueueUrl = config.SQS_PHASE2_QUEUE_URL;
const createdTicketIds: string[] = [];
let activeWorker: Phase1Worker | undefined;

beforeAll(async () => {
  await drainQueueUntilEmpty();
  await drainQueueUntilEmpty(phase2QueueUrl);
});

afterEach(async () => {
  if (activeWorker) {
    await activeWorker.stop(5000);
    activeWorker = undefined;
  }

  await clearQueue();
  await clearQueue(phase2QueueUrl);

  if (createdTicketIds.length > 0) {
    await pool.query('DELETE FROM tickets WHERE id = ANY($1::uuid[])', [createdTicketIds]);
    createdTicketIds.length = 0;
  }
});

afterAll(async () => {
  sqsClient.destroy();
});

describe('Phase1Worker', () => {
  it('processes 10 queued tickets without manual action', async () => {
    const ticketIds = await Promise.all(
      Array.from({ length: 10 }, (_, index) => insertTicket(`bulk-${index}`)),
    );

    for (const ticketId of ticketIds) {
      await sendMessage({ ticketId });
    }

    activeWorker = createWorker(20, 10);
    activeWorker.start();

    await waitFor(async () => {
      const result = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM ticket_phases
         WHERE ticket_id = ANY($1::uuid[])
           AND step_name = 'triage'
           AND status = 'success'`,
        [ticketIds],
      );
      return Number(result.rows[0].count) === 10;
    }, 15_000);

    const events = await pool.query<{ event_type: string }>(
      `SELECT event_type
       FROM ticket_events
       WHERE ticket_id = $1 AND step_name = 'triage'
       ORDER BY created_at ASC`,
      [ticketIds[0]],
    );

    expect(events.rows.map((row) => row.event_type)).toEqual([
      'step_started',
      'step_completed',
      'step_handoff',
    ]);
  }, 20_000);

  it('saves triage success only after the result is persisted', async () => {
    const ticketId = await insertTicket('single');
    await sendMessage({ ticketId });

    activeWorker = createWorker();
    activeWorker.start();

    await waitFor(async () => {
      const phase = await getTriagePhase(ticketId);
      return phase?.status === 'success';
    });

    const phase = await getTriagePhase(ticketId);
    expect(phase).toMatchObject({
      status: 'success',
      attempt_count: 1,
      provider_used: 'openrouter',
      error_message: null,
    });
    expect(phase?.result).toMatchObject({
      category: 'general',
      priority: 'medium',
      sentiment: 'neutral',
      escalation_needed: false,
      routing_target: 'tier1',
      summary: 'Stub triage result for worker verification',
    });
    expect(phase?.finished_at).not.toBeNull();

    const ticket = await pool.query<{ status: string }>('SELECT status FROM tickets WHERE id = $1', [
      ticketId,
    ]);
    expect(ticket.rows[0].status).toBe('processing');
  });

  it('skips tickets that already have successful triage and deletes the duplicate message', async () => {
    const ticketId = await insertTicket('already-success');
    await insertSuccessfulTriage(ticketId);
    await sendMessage({ ticketId });

    activeWorker = createWorker();
    activeWorker.start();

    await sleep(500);
    await activeWorker.stop(5000);
    activeWorker = undefined;

    const phase = await getTriagePhase(ticketId);
    expect(phase).toMatchObject({
      status: 'success',
      attempt_count: 1,
      provider_used: 'manual',
    });
    expect(await receiveOneMessage()).toBeNull();
  });

  it('does not delete an already-running message so SQS can retry it later', async () => {
    const ticketId = await insertTicket('retry-later-running');
    await insertRunningTriage(ticketId);
    await sendMessage({ ticketId });

    activeWorker = createWorkerWithService(
      new TriageStepService(
        new TriageRepository(),
        new TicketQueue(sqsClient, phase2QueueUrl),
        new FakeAiGateway(),
        makeNotifier(),
        makeStatusReader(),
        logger,
      ),
      1,
    );
    activeWorker.start();

    await sleep(500);
    await activeWorker.stop(5000);
    activeWorker = undefined;
    const remainingMessages = await getApproximateQueueMessageCount();
    expect(remainingMessages).toBeGreaterThanOrEqual(1);
    await sleep(1200);
    await drainQueue();
  }, 10_000);

  it('does not mark triage success when Step 2 handoff fails', async () => {
    const ticketId = await insertTicket('handoff-failure');
    const service = new TriageStepService(
      new TriageRepository(),
      new FailingQueue(),
      new FakeAiGateway(),
      makeNotifier(),
      makeStatusReader(),
      logger,
      20,
    );

    await expect(service.process(ticketId)).rejects.toThrow('phase2_queue_unavailable');

    const phase = await getTriagePhase(ticketId);
    expect(phase?.status).toBe('running');
    expect(phase?.result).toMatchObject({
      category: 'general',
      priority: 'medium',
    });
  });

  it('finishes the in-flight ticket before graceful shutdown completes', async () => {
    const ticketId = await insertTicket('shutdown');
    await sendMessage({ ticketId });

    activeWorker = createWorker(500);
    activeWorker.start();

    await waitFor(async () => {
      const phase = await getTriagePhase(ticketId);
      return phase?.status === 'running';
    });

    await activeWorker.stop(5000);
    activeWorker = undefined;

    const phase = await getTriagePhase(ticketId);
    expect(phase?.status).toBe('success');
  });
});

function createWorker(delayMs = 50, maxMessages = 1): Phase1Worker {
  const repository = new TriageRepository();
  const service = new TriageStepService(
    repository,
    new TicketQueue(sqsClient, phase2QueueUrl),
    new FakeAiGateway(),
    makeNotifier(),
    makeStatusReader(),
    logger,
    delayMs,
  );
  return createWorkerWithService(service, 5, maxMessages);
}

class FailingQueue implements ITicketQueue {
  async enqueue(ticketId: string): Promise<void> {
    void ticketId;
    throw new Error('phase2_queue_unavailable');
  }
}

class FakeAiGateway implements IAiGateway {
  readonly primaryProvider = 'openrouter';

  async triageTicket(input: AiTicketInput): Promise<AiGatewayResponse<TriageResult>> {
    void input;
    return {
      provider: this.primaryProvider,
      primaryProvider: this.primaryProvider,
      fallback: false,
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
    throw new Error('not used in phase1 tests');
  }
}

function createWorkerWithService(
  service: ITriageStepService,
  visibilityTimeout = 5,
  maxMessages = 1,
): Phase1Worker {
  const consumer = new SqsQueueConsumer(sqsClient, queueUrl);
  return new Phase1Worker(consumer, service, logger, {
    waitSeconds: 1,
    maxMessages,
    visibilityTimeout,
  });
}

function makeNotifier(): INotificationService {
  return { publishTicketUpdate: () => undefined };
}

function makeStatusReader(): ITicketStatusReader {
  return { getById: async () => null };
}

async function insertTicket(label: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO tickets (tenant_id, submitter, subject, body, status)
     VALUES ($1, 'alice', $2, 'Cannot log in', 'queued')
     RETURNING id`,
    [`worker-${label}-${Date.now()}`, `Worker test ${label}`],
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
     VALUES ($1, 'triage', 'success', 1, $2::jsonb, 'manual', now(), now())`,
    [ticketId, JSON.stringify({ category: 'manual' })],
  );
}

async function insertRunningTriage(ticketId: string): Promise<void> {
  await pool.query(
    `INSERT INTO ticket_phases (
       ticket_id,
       step_name,
       status,
       attempt_count,
       started_at
     )
     VALUES ($1, 'triage', 'running', 1, now())`,
    [ticketId],
  );
}

async function sendMessage(message: object | string): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: typeof message === 'string' ? message : JSON.stringify(message),
    }),
  );
}

async function receiveOneMessage(waitSeconds = 0): Promise<{ receiptHandle: string } | null> {
  const response = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: waitSeconds,
      VisibilityTimeout: 1,
    }),
  );

  const message = response.Messages?.[0];
  if (!message?.ReceiptHandle) return null;
  return { receiptHandle: message.ReceiptHandle };
}

async function deleteMessage(receiptHandle: string, targetQueueUrl = queueUrl): Promise<void> {
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: targetQueueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

async function getApproximateQueueMessageCount(targetQueueUrl = queueUrl): Promise<number> {
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

async function getTriagePhase(ticketId: string): Promise<{
  status: string;
  attempt_count: number;
  result: Record<string, unknown> | null;
  provider_used: string | null;
  error_message: string | null;
  finished_at: Date | null;
} | null> {
  const result = await pool.query(
    `SELECT status, attempt_count, result, provider_used, error_message, finished_at
     FROM ticket_phases
     WHERE ticket_id = $1 AND step_name = 'triage'`,
    [ticketId],
  );

  return result.rows[0] ?? null;
}

async function clearQueue(targetQueueUrl = queueUrl): Promise<void> {
  try {
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: targetQueueUrl }));
    await sleep(1000);
  } catch {
    // LocalStack follows SQS purge cooldown rules; draining handles cooldown windows.
  }

  await drainQueueUntilEmpty(targetQueueUrl);
}

async function drainQueueUntilEmpty(targetQueueUrl = queueUrl): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await drainQueue(targetQueueUrl);
    if ((await getApproximateQueueMessageCount(targetQueueUrl)) === 0) return;
    await sleep(500);
  }

  throw new Error(`queue did not empty within 10000ms: ${targetQueueUrl}`);
}

async function drainQueue(targetQueueUrl = queueUrl): Promise<void> {
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
        .map((message) => deleteMessage(message.ReceiptHandle as string, targetQueueUrl)),
    );
  }
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
