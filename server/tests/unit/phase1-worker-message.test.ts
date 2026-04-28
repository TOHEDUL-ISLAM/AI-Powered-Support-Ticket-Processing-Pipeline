// US-2.1 + US-5.2: unit tests for Step 1 worker message parsing, retry scheduling, and permanent failure
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { PIPELINE_EVENTS, type Logger } from '../../src/logger';
import type { ISqsQueueConsumer, QueueMessage, ReceiveOptions } from '../../src/queue/types';
import type { ITriageStepService, TriageProcessResult } from '../../src/services/triage-step.service';
import { parsePhase1Message, Phase1Worker } from '../../src/workers/phase1.worker';

describe('parsePhase1Message', () => {
  it('accepts a valid UUID ticketId', () => {
    const result = parsePhase1Message(
      JSON.stringify({ ticketId: '11111111-1111-4111-8111-111111111111' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ticketId).toBe('11111111-1111-4111-8111-111111111111');
    }
  });

  it('rejects invalid JSON', () => {
    const result = parsePhase1Message('not-json');

    expect(result).toEqual({ ok: false, reason: 'invalid_json' });
  });

  it('rejects a missing ticketId', () => {
    const result = parsePhase1Message(JSON.stringify({}));

    expect(result).toEqual({ ok: false, reason: 'invalid_ticket_id' });
  });

  it('rejects a non-UUID ticketId', () => {
    const result = parsePhase1Message(JSON.stringify({ ticketId: 'not-a-uuid' }));

    expect(result).toEqual({ ok: false, reason: 'invalid_ticket_id' });
  });
});

describe('Phase1Worker deletion rules', () => {
  it('deletes malformed messages without calling the processor', async () => {
    const consumer = new FakeConsumer([{ receiptHandle: 'rh-1', body: 'not-json' }]);
    const service = new SuccessfulService();
    const worker = new Phase1Worker(consumer, service, pino({ level: 'silent' }), {
      waitSeconds: 0,
      maxMessages: 1,
      visibilityTimeout: 1,
    });

    worker.start();
    await waitFor(async () => consumer.deletedReceiptHandles.length === 1);
    await worker.stop(500);

    expect(consumer.deletedReceiptHandles).toEqual(['rh-1']);
    expect(service.calls).toBe(0);
  });

  it('does not delete messages when processing throws', async () => {
    const consumer = new FakeConsumer([
      {
        receiptHandle: 'rh-2',
        body: JSON.stringify({ ticketId: '11111111-1111-4111-8111-111111111111' }),
      },
    ]);
    const service = new ThrowingService();
    const worker = new Phase1Worker(consumer, service, pino({ level: 'silent' }), {
      waitSeconds: 0,
      maxMessages: 1,
      visibilityTimeout: 1,
    });

    worker.start();
    await waitFor(async () => service.calls === 1);
    await worker.stop(500);

    expect(consumer.deletedReceiptHandles).toEqual([]);
  });

  it('schedules visibility change and does not delete on failed outcome', async () => {
    const consumer = new FakeConsumer([
      {
        receiptHandle: 'rh-3',
        body: JSON.stringify({ ticketId: '11111111-1111-4111-8111-111111111111' }),
      },
    ]);
    const service = new FailedOutcomeService();
    const logger = makeLogger();
    const worker = new Phase1Worker(consumer, service, logger, {
      waitSeconds: 0,
      maxMessages: 1,
      visibilityTimeout: 1,
    });

    worker.start();
    await waitFor(async () => service.calls === 1);
    await worker.stop(500);

    expect(consumer.deletedReceiptHandles).toEqual([]);
    expect(consumer.visibilityChanges.length).toBe(1);
    expect(consumer.visibilityChanges[0].receiptHandle).toBe('rh-3');
    expect(consumer.visibilityChanges[0].seconds).toBeGreaterThanOrEqual(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'phase1.message.retry_scheduled',
        pipelineEvent: PIPELINE_EVENTS.RETRY_SCHEDULED,
        ticketId: '11111111-1111-4111-8111-111111111111',
        step: 'triage',
        attempt: 1,
        retryDelayMs: expect.any(Number),
      }),
    );
  });

  it('does not delete and does not change visibility on permanently_failed outcome', async () => {
    const consumer = new FakeConsumer([
      {
        receiptHandle: 'rh-4',
        body: JSON.stringify({ ticketId: '11111111-1111-4111-8111-111111111111' }),
      },
    ]);
    const service = new PermanentlyFailedService();
    const worker = new Phase1Worker(consumer, service, pino({ level: 'silent' }), {
      waitSeconds: 0,
      maxMessages: 1,
      visibilityTimeout: 1,
    });

    worker.start();
    await waitFor(async () => service.calls === 1);
    await worker.stop(500);

    expect(consumer.deletedReceiptHandles).toEqual([]);
    expect(consumer.visibilityChanges).toEqual([]);
  });
});

class FakeConsumer implements ISqsQueueConsumer {
  readonly deletedReceiptHandles: string[] = [];
  readonly visibilityChanges: { receiptHandle: string; seconds: number }[] = [];

  constructor(private readonly messages: QueueMessage[]) {}

  async receive(options: ReceiveOptions): Promise<QueueMessage[]> {
    void options;
    await sleep(5);
    const next = this.messages.shift();
    return next ? [next] : [];
  }

  async delete(receiptHandle: string): Promise<void> {
    this.deletedReceiptHandles.push(receiptHandle);
  }

  async changeVisibility(receiptHandle: string, visibilityTimeoutSeconds: number): Promise<void> {
    this.visibilityChanges.push({ receiptHandle, seconds: visibilityTimeoutSeconds });
  }
}

class SuccessfulService implements ITriageStepService {
  calls = 0;

  async process(ticketId: string): Promise<TriageProcessResult> {
    void ticketId;
    this.calls += 1;
    return { outcome: 'processed' };
  }
}

class ThrowingService implements ITriageStepService {
  calls = 0;

  async process(ticketId: string): Promise<TriageProcessResult> {
    void ticketId;
    this.calls += 1;
    throw new Error('triage_failed');
  }
}

class FailedOutcomeService implements ITriageStepService {
  calls = 0;

  async process(ticketId: string): Promise<TriageProcessResult> {
    void ticketId;
    this.calls += 1;
    return { outcome: 'failed', attempt: 1 };
  }
}

class PermanentlyFailedService implements ITriageStepService {
  calls = 0;

  async process(ticketId: string): Promise<TriageProcessResult> {
    void ticketId;
    this.calls += 1;
    return { outcome: 'permanently_failed', attempt: 3 };
  }
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await sleep(5);
  }

  throw new Error(`condition not met within ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
}
