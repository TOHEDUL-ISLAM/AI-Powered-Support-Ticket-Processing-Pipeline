// US-2.1 + US-2.3 + US-3.1 + US-5.2: Step 1 triage processing through the AI gateway with retry handling
import type { AiGatewayResponse, IAiGateway } from '../ai';
import { PIPELINE_EVENTS, type Logger } from '../logger';
import type { ITicketQueue } from '../queue/ticket.queue';
import type { INotificationService } from '../realtime';
import type { ITriageRepository, TriageResult } from '../repositories/triage.repository';
import type { ITicketStatusReader } from './ticket.service';

const MAX_ATTEMPTS = 3;

export type TriageProcessOutcome =
  | 'processed'
  | 'already_success'
  | 'already_running'
  | 'failed'
  | 'permanently_failed'
  | 'not_found';

export interface TriageProcessResult {
  outcome: TriageProcessOutcome;
  attempt?: number;
}

export interface ITriageStepService {
  process(ticketId: string): Promise<TriageProcessResult>;
}

export class TriageStepService implements ITriageStepService {
  constructor(
    private readonly repository: ITriageRepository,
    private readonly phase2Queue: ITicketQueue,
    private readonly aiGateway: IAiGateway,
    private readonly notifier: INotificationService,
    private readonly ticketStatusReader: ITicketStatusReader,
    private readonly logger: Logger,
    private readonly processingDelayMs = 100,
  ) {}

  async process(ticketId: string): Promise<TriageProcessResult> {
    const startedAtMs = Date.now();
    const ticket = await this.repository.getTicket(ticketId);
    if (!ticket) {
      return { outcome: 'not_found' };
    }

    const existingPhase = await this.repository.getPhase(ticketId);
    if (existingPhase?.status === 'success') {
      return { outcome: 'already_success' };
    }

    if (existingPhase?.status === 'running') {
      if (existingPhase.result) {
        const provider = existingPhase.provider_used ?? this.aiGateway.primaryProvider;
        await this.handoffToStep2(
          ticket.id,
          ticket.tenant_id,
          existingPhase.attempt_count,
          startedAtMs,
          {
            result: existingPhase.result,
            provider,
            primaryProvider: this.aiGateway.primaryProvider,
            fallback: provider.toLowerCase() !== this.aiGateway.primaryProvider,
          },
        );
        this.logger.info({ event: 'phase1.handoff.retried', ticketId });
        return { outcome: 'processed', attempt: existingPhase.attempt_count };
      }

      return { outcome: 'already_running' };
    }

    if (existingPhase?.status === 'permanently_failed') {
      return { outcome: 'permanently_failed' };
    }

    const attempt = await this.repository.markRunning(ticket.id);
    this.logger.info({
      event: 'phase1.triage.started',
      pipelineEvent: PIPELINE_EVENTS.STEP_STARTED,
      ticketId,
      step: 'triage',
      attempt,
    });
    this.notifier.publishTicketUpdate({
      type: 'step_started',
      ticketId: ticket.id,
      tenantId: ticket.tenant_id,
      step: 'triage',
      attempt,
      status: 'processing',
      occurredAt: new Date().toISOString(),
    });

    if (attempt >= MAX_ATTEMPTS) {
      await this.repository.markPermanentlyFailed(ticket.id, 'max_attempts_reached');
      this.logger.error({
        event: 'phase1.triage.permanently_failed',
        pipelineEvent: PIPELINE_EVENTS.PERMANENTLY_FAILED,
        ticketId,
        step: 'triage',
        attempt,
        durationMs: Date.now() - startedAtMs,
        error: 'max_attempts_reached',
      });
      await this.emitFailureNotification(ticketId);
      return { outcome: 'permanently_failed', attempt };
    }

    await sleep(this.processingDelayMs);

    let triage;
    try {
      triage = await this.aiGateway.triageTicket({
        ticketId: ticket.id,
        subject: ticket.subject,
        body: ticket.body,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.repository.markFailed(ticket.id, errorMessage);
      this.logger.error({
        event: 'phase1.triage.failed',
        pipelineEvent: PIPELINE_EVENTS.STEP_FAILED,
        ticketId,
        step: 'triage',
        attempt,
        durationMs: Date.now() - startedAtMs,
        error: errorMessage,
      });
      this.notifier.publishTicketUpdate({
        type: 'step_failed',
        ticketId: ticket.id,
        tenantId: ticket.tenant_id,
        step: 'triage',
        attempt,
        reason: 'step_attempt_failed',
        occurredAt: new Date().toISOString(),
      });
      return { outcome: 'failed', attempt };
    }

    await this.repository.saveRunningResult(ticket.id, triage.result, triage.provider);
    if (triage.fallback) {
      this.logger.info({
        event: 'phase1.provider_fallback',
        pipelineEvent: PIPELINE_EVENTS.PROVIDER_FALLBACK,
        ticketId,
        step: 'triage',
        primaryProvider: triage.primaryProvider,
        providerUsed: triage.provider,
      });
    }
    await this.handoffToStep2(ticket.id, ticket.tenant_id, attempt, startedAtMs, triage);
    return { outcome: 'processed', attempt };
  }

  private async handoffToStep2(
    ticketId: string,
    tenantId: string,
    attempt: number,
    startedAtMs: number,
    triage: AiGatewayResponse<TriageResult>,
  ): Promise<void> {
    await this.phase2Queue.enqueue(ticketId);
    this.logger.info({ event: 'phase1.handoff.queued', ticketId, toStep: 'resolution' });
    await this.repository.markSuccess(
      ticketId,
      triage.result,
      triage.provider,
      triage.fallback,
      triage.primaryProvider,
    );
    this.logger.info({
      event: 'phase1.triage.completed',
      pipelineEvent: PIPELINE_EVENTS.STEP_COMPLETED,
      ticketId,
      step: 'triage',
      attempt,
      durationMs: Date.now() - startedAtMs,
      providerUsed: triage.provider,
      fallback: triage.fallback,
    });
    this.notifier.publishTicketUpdate({
      type: 'step_completed',
      ticketId,
      tenantId,
      step: 'triage',
      attempt,
      providerUsed: triage.provider,
      fallback: triage.fallback,
      occurredAt: new Date().toISOString(),
    });
  }

  private async emitFailureNotification(ticketId: string): Promise<void> {
    const payload = await this.ticketStatusReader.getById(ticketId);
    if (!payload) {
      this.logger.warn({ event: 'phase1.failure_notification.payload_missing', ticketId });
      return;
    }
    this.notifier.publishTicketUpdate({
      type: 'ticket_failed',
      ticketId,
      tenantId: payload.tenantId,
      failedStep: 'triage',
      reason: 'max_attempts_reached',
      occurredAt: new Date().toISOString(),
      data: payload,
    });
    this.logger.info({ event: 'phase1.failure_notification.sent', ticketId });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
