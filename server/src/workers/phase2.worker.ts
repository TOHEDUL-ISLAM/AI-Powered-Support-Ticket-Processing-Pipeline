// US-2.2 + US-5.2: Step 2 worker polling SQS and running resolution processing with backoff retry
import { z } from 'zod';
import { PIPELINE_EVENTS, type Logger } from '../logger';
import type { ISqsQueueConsumer, QueueMessage } from '../queue/types';
import type {
  IResolutionStepService,
  ResolutionProcessOutcome,
} from '../services/resolution-step.service';
import { calculateRetryDelay } from '../utils/retry';

const phase2MessageSchema = z.object({
  ticketId: z.string().uuid(),
});

export interface Phase2WorkerOptions {
  waitSeconds?: number;
  maxMessages?: number;
  visibilityTimeout?: number;
}

export interface ParsedPhase2Message {
  ticketId: string;
}

export type Phase2MessageParseResult =
  | { ok: true; value: ParsedPhase2Message }
  | { ok: false; reason: string };

export class Phase2Worker {
  private readonly waitSeconds: number;
  private readonly maxMessages: number;
  private readonly visibilityTimeout: number;
  private stopping = false;
  private loopPromise?: Promise<void>;
  private inFlight?: Promise<void>;

  constructor(
    private readonly consumer: ISqsQueueConsumer,
    private readonly resolutionService: IResolutionStepService,
    private readonly logger: Logger,
    options: Phase2WorkerOptions = {},
  ) {
    this.waitSeconds = options.waitSeconds ?? 20;
    this.maxMessages = options.maxMessages ?? 1;
    this.visibilityTimeout = options.visibilityTimeout ?? 90;
  }

  start(): void {
    if (this.loopPromise) return;

    this.stopping = false;
    this.logger.info({ event: 'phase2.worker.started' });
    this.loopPromise = this.loop();
  }

  async stop(timeoutMs = 90_000): Promise<void> {
    if (!this.loopPromise) return;

    this.stopping = true;
    this.logger.info({ event: 'phase2.worker.stopping' });

    await withTimeout(this.waitForShutdown(), timeoutMs, () => {
      this.logger.error({ event: 'phase2.worker.stop_timeout', timeoutMs });
    });

    this.loopPromise = undefined;
    this.logger.info({ event: 'phase2.worker.stopped' });
  }

  private async loop(): Promise<void> {
    while (!this.stopping) {
      try {
        const messages = await this.consumer.receive({
          maxMessages: this.maxMessages,
          waitSeconds: this.waitSeconds,
          visibilityTimeout: this.visibilityTimeout,
        });

        if (this.stopping) return;

        for (const message of messages) {
          this.inFlight = this.handleMessage(message);
          await this.inFlight;
          this.inFlight = undefined;
        }
      } catch (err) {
        if (!this.stopping) {
          this.logger.error({
            event: 'phase2.worker.poll_failed',
            error: err instanceof Error ? err.message : String(err),
          });
          await sleep(1000);
        }
      }
    }
  }

  private async handleMessage(message: QueueMessage): Promise<void> {
    this.logger.info({ event: 'phase2.message.received', messageId: message.messageId });

    const parsed = parsePhase2Message(message.body);
    if (!parsed.ok) {
      this.logger.warn({
        event: 'phase2.message.malformed',
        reason: parsed.reason,
        rawBody: truncate(message.body, 500),
      });
      await this.consumer.delete(message.receiptHandle);
      this.logger.info({ event: 'phase2.message.deleted', reason: 'malformed' });
      return;
    }

    try {
      const result = await this.resolutionService.process(parsed.value.ticketId);
      await this.handleOutcome(message, parsed.value.ticketId, result.outcome, result.attempt);
    } catch (err) {
      this.logger.error({
        event: 'phase2.message.processing_failed',
        ticketId: parsed.value.ticketId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async handleOutcome(
    message: QueueMessage,
    ticketId: string,
    outcome: ResolutionProcessOutcome,
    attempt?: number,
  ): Promise<void> {
    if (outcome === 'already_running' || outcome === 'triage_not_ready') {
      this.logger.info({ event: 'phase2.message.retry_later', ticketId, outcome });
      return;
    }

    if (outcome === 'failed') {
      const delaySec = Math.ceil(calculateRetryDelay(attempt ?? 1) / 1000);
      try {
        await this.consumer.changeVisibility(message.receiptHandle, delaySec);
        this.logger.info({
          event: 'phase2.message.retry_scheduled',
          pipelineEvent: PIPELINE_EVENTS.RETRY_SCHEDULED,
          ticketId,
          step: 'resolution',
          attempt,
          retryDelayMs: delaySec * 1000,
        });
      } catch (err) {
        this.logger.warn({
          event: 'phase2.message.visibility_change_failed',
          ticketId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (outcome === 'permanently_failed') {
      this.logger.info({ event: 'phase2.message.permanently_failed', ticketId });
      return;
    }

    this.logger.info({ event: 'phase2.message.completed', ticketId, outcome });
    await this.consumer.delete(message.receiptHandle);
    this.logger.info({ event: 'phase2.message.deleted', ticketId, outcome });
  }

  private async waitForShutdown(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
    }

    if (this.loopPromise) {
      await this.loopPromise;
    }
  }
}

export function parsePhase2Message(body: string): Phase2MessageParseResult {
  try {
    const parsedJson = JSON.parse(body) as unknown;
    const parsed = phase2MessageSchema.safeParse(parsedJson);

    if (!parsed.success) {
      return { ok: false, reason: 'invalid_ticket_id' };
    }

    return { ok: true, value: parsed.data };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

async function withTimeout(task: Promise<void>, timeoutMs: number, onTimeout: () => void): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  let timedOut = false;

  await Promise.race([
    task,
    new Promise<void>((resolve) => {
      timeout = setTimeout(() => {
        timedOut = true;
        onTimeout();
        resolve();
      }, timeoutMs);
    }),
  ]);

  if (!timedOut && timeout) {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
