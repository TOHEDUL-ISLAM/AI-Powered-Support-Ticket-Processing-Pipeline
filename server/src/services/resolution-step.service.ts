// US-2.2 + US-3.1 + US-4.3 + US-4.4 + US-5.2: Step 2 resolution processing, validation, completion/failure notification
import type { IAiGateway } from '../ai';
import { PIPELINE_EVENTS, type Logger } from '../logger';
import type { INotificationService } from '../realtime';
import type { IResolutionRepository } from '../repositories/resolution.repository';
import type { ITicketStatusReader } from './ticket.service';

const MAX_ATTEMPTS = 3;

export type ResolutionProcessOutcome =
  | 'processed'
  | 'already_success'
  | 'already_running'
  | 'failed'
  | 'permanently_failed'
  | 'triage_not_ready'
  | 'not_found';

export interface ResolutionProcessResult {
  outcome: ResolutionProcessOutcome;
  attempt?: number;
}

export interface IResolutionStepService {
  process(ticketId: string): Promise<ResolutionProcessResult>;
}

export class ResolutionStepService implements IResolutionStepService {
  constructor(
    private readonly repository: IResolutionRepository,
    private readonly aiGateway: IAiGateway,
    private readonly notifier: INotificationService,
    private readonly ticketStatusReader: ITicketStatusReader,
    private readonly logger: Logger,
    private readonly processingDelayMs = 100,
  ) {}

  async process(ticketId: string): Promise<ResolutionProcessResult> {
    const startedAtMs = Date.now();
    const ticket = await this.repository.getTicket(ticketId);
    if (!ticket) {
      return { outcome: 'not_found' };
    }

    const triage = await this.repository.getTriagePhase(ticketId);
    if (triage?.status !== 'success' || !triage.result) {
      return { outcome: 'triage_not_ready' };
    }

    const existingPhase = await this.repository.getResolutionPhase(ticketId);
    if (existingPhase?.status === 'success') {
      return { outcome: 'already_success' };
    }

    if (existingPhase?.status === 'running') {
      return { outcome: 'already_running' };
    }

    if (existingPhase?.status === 'permanently_failed') {
      return { outcome: 'permanently_failed' };
    }

    const attempt = await this.repository.markRunning(ticket.id);
    this.logger.info({
      event: 'phase2.resolution.started',
      pipelineEvent: PIPELINE_EVENTS.STEP_STARTED,
      ticketId,
      step: 'resolution',
      attempt,
    });
    this.notifier.publishTicketUpdate({
      type: 'step_started',
      ticketId: ticket.id,
      tenantId: ticket.tenant_id,
      step: 'resolution',
      attempt,
      occurredAt: new Date().toISOString(),
    });

    if (attempt >= MAX_ATTEMPTS) {
      await this.repository.markPermanentlyFailed(ticket.id, 'max_attempts_reached');
      this.logger.error({
        event: 'phase2.resolution.permanently_failed',
        pipelineEvent: PIPELINE_EVENTS.PERMANENTLY_FAILED,
        ticketId,
        step: 'resolution',
        attempt,
        durationMs: Date.now() - startedAtMs,
        error: 'max_attempts_reached',
      });
      await this.emitFailureNotification(ticketId);
      return { outcome: 'permanently_failed', attempt };
    }

    await sleep(this.processingDelayMs);

    let resolution;
    try {
      resolution = await this.aiGateway.draftResolution({
        ticketId: ticket.id,
        subject: ticket.subject,
        body: ticket.body,
        triage: triage.result,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.repository.markFailed(ticket.id, errorMessage);
      this.logger.error({
        event: 'phase2.resolution.failed',
        pipelineEvent: PIPELINE_EVENTS.STEP_FAILED,
        ticketId,
        step: 'resolution',
        attempt,
        durationMs: Date.now() - startedAtMs,
        error: errorMessage,
      });
      this.notifier.publishTicketUpdate({
        type: 'step_failed',
        ticketId: ticket.id,
        tenantId: ticket.tenant_id,
        step: 'resolution',
        attempt,
        reason: 'step_attempt_failed',
        occurredAt: new Date().toISOString(),
      });
      return { outcome: 'failed', attempt };
    }

    await this.repository.markSuccess(
      ticket.id,
      resolution.result,
      resolution.provider,
      resolution.fallback,
      resolution.primaryProvider,
    );
    if (resolution.fallback) {
      this.logger.info({
        event: 'phase2.provider_fallback',
        pipelineEvent: PIPELINE_EVENTS.PROVIDER_FALLBACK,
        ticketId,
        step: 'resolution',
        primaryProvider: resolution.primaryProvider,
        providerUsed: resolution.provider,
      });
    }
    this.logger.info({
      event: 'phase2.resolution.completed',
      pipelineEvent: PIPELINE_EVENTS.STEP_COMPLETED,
      ticketId,
      step: 'resolution',
      attempt,
      durationMs: Date.now() - startedAtMs,
      providerUsed: resolution.provider,
      fallback: resolution.fallback,
    });
    this.notifier.publishTicketUpdate({
      type: 'step_completed',
      ticketId: ticket.id,
      tenantId: ticket.tenant_id,
      step: 'resolution',
      attempt,
      providerUsed: resolution.provider,
      fallback: resolution.fallback,
      occurredAt: new Date().toISOString(),
    });

    await this.emitCompletionNotification(ticketId, startedAtMs);
    return { outcome: 'processed', attempt };
  }

  private async emitCompletionNotification(ticketId: string, startedAtMs: number): Promise<void> {
    const payload = await this.ticketStatusReader.getById(ticketId);
    if (!payload) {
      this.logger.warn({ event: 'phase2.notification.payload_missing', ticketId });
      return;
    }
    this.notifier.publishTicketUpdate({
      type: 'pipeline_completed',
      ticketId,
      tenantId: payload.tenantId,
      occurredAt: new Date().toISOString(),
      data: payload,
    });
    this.logger.info({
      event: 'phase2.pipeline.completed',
      pipelineEvent: PIPELINE_EVENTS.PIPELINE_COMPLETE,
      ticketId,
      durationMs: Date.now() - startedAtMs,
      status: payload.status,
    });
    this.logger.info({ event: 'phase2.notification.sent', ticketId });
  }

  private async emitFailureNotification(ticketId: string): Promise<void> {
    const payload = await this.ticketStatusReader.getById(ticketId);
    if (!payload) {
      this.logger.warn({ event: 'phase2.failure_notification.payload_missing', ticketId });
      return;
    }
    this.notifier.publishTicketUpdate({
      type: 'ticket_failed',
      ticketId,
      tenantId: payload.tenantId,
      failedStep: 'resolution',
      reason: 'max_attempts_reached',
      occurredAt: new Date().toISOString(),
      data: payload,
    });
    this.logger.info({ event: 'phase2.failure_notification.sent', ticketId });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
