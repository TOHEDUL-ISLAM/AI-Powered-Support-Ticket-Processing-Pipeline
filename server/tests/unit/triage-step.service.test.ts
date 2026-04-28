// US-6.2 + US-6.3: unit tests for Step 1 live notification timing and payloads
import { describe, expect, it, vi } from 'vitest';
import type { AiGatewayResponse, IAiGateway } from '../../src/ai';
import { PIPELINE_EVENTS, type Logger } from '../../src/logger';
import type { ITicketQueue } from '../../src/queue/ticket.queue';
import type { INotificationService } from '../../src/realtime';
import type { ITriageRepository, TriageResult } from '../../src/repositories/triage.repository';
import { TriageStepService } from '../../src/services/triage-step.service';
import type { ITicketStatusReader, TicketStatusResponse } from '../../src/services/ticket.service';

const ticketId = 'aaaaaaaa-0000-0000-0000-000000000001';

const triageResult: TriageResult = {
  category: 'account_access',
  priority: 'medium',
  sentiment: 'frustrated',
  escalation_needed: false,
  routing_target: 'tier1',
  summary: 'Customer locked out of account.',
};

const ticket = {
  id: ticketId,
  tenant_id: 'tenant-1',
  subject: 'Cannot access my account',
  body: 'I have been locked out for two days.',
  status: 'queued',
};

const statusPayload: TicketStatusResponse = {
  ticketId,
  tenantId: 'tenant-1',
  submitter: 'alice@example.com',
  subject: ticket.subject,
  status: 'failed',
  createdAt: new Date(),
  updatedAt: new Date(),
  phases: {
    triage: {
      status: 'permanently_failed',
      attemptCount: 3,
      result: null,
      providerUsed: null,
      startedAt: null,
      finishedAt: null,
    },
    resolution: null,
  },
};

describe('TriageStepService realtime notifications', () => {
  it('publishes started and completed after triage is saved and handed off', async () => {
    const repo = makeRepo();
    const notifier = makeNotifier();
    const logger = makeLogger();
    const service = new TriageStepService(
      repo,
      makeQueue(),
      makeAiGateway(),
      notifier,
      makeStatusReader(),
      logger,
      0,
    );

    const result = await service.process(ticketId);

    expect(result).toEqual({ outcome: 'processed', attempt: 1 });
    expect(repo.saveRunningResult).toHaveBeenCalledWith(ticketId, triageResult, 'openrouter');
    expect(repo.markSuccess).toHaveBeenCalledWith(ticketId, triageResult, 'openrouter', false, 'openrouter');
    expect(notifier.publishTicketUpdate).toHaveBeenCalledTimes(2);
    expect(notifier.publishTicketUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'step_started',
        ticketId,
        tenantId: 'tenant-1',
        step: 'triage',
        attempt: 1,
        status: 'processing',
      }),
    );
    expect(notifier.publishTicketUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'step_completed',
        ticketId,
        tenantId: 'tenant-1',
        step: 'triage',
        attempt: 1,
        providerUsed: 'openrouter',
        fallback: false,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'phase1.triage.started',
        pipelineEvent: PIPELINE_EVENTS.STEP_STARTED,
        step: 'triage',
        attempt: 1,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'phase1.triage.completed',
        pipelineEvent: PIPELINE_EVENTS.STEP_COMPLETED,
        step: 'triage',
        attempt: 1,
        providerUsed: 'openrouter',
        fallback: false,
        durationMs: expect.any(Number),
      }),
    );
  });

  it('publishes a sanitized failed-attempt event after the failed state is saved', async () => {
    const repo = makeRepo();
    const notifier = makeNotifier();
    const logger = makeLogger();
    const service = new TriageStepService(
      repo,
      makeQueue(),
      makeAiGateway(new Error('raw provider timeout')),
      notifier,
      makeStatusReader(),
      logger,
      0,
    );

    const result = await service.process(ticketId);

    expect(result).toEqual({ outcome: 'failed', attempt: 1 });
    expect(repo.markFailed).toHaveBeenCalledWith(ticketId, 'raw provider timeout');
    expect(notifier.publishTicketUpdate).toHaveBeenCalledTimes(2);
    expect(notifier.publishTicketUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'step_failed',
        ticketId,
        tenantId: 'tenant-1',
        step: 'triage',
        attempt: 1,
        reason: 'step_attempt_failed',
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'phase1.triage.failed',
        pipelineEvent: PIPELINE_EVENTS.STEP_FAILED,
        step: 'triage',
        attempt: 1,
        durationMs: expect.any(Number),
        error: 'raw provider timeout',
      }),
    );
  });

  it('publishes ticket_failed after permanent failure is saved and status is read back', async () => {
    const repo = makeRepo({ markRunning: vi.fn().mockResolvedValue(3) });
    const notifier = makeNotifier();
    const logger = makeLogger();
    const service = new TriageStepService(
      repo,
      makeQueue(),
      makeAiGateway(),
      notifier,
      makeStatusReader(statusPayload),
      logger,
      0,
    );

    const result = await service.process(ticketId);

    expect(result).toEqual({ outcome: 'permanently_failed', attempt: 3 });
    expect(repo.markPermanentlyFailed).toHaveBeenCalledWith(ticketId, 'max_attempts_reached');
    expect(notifier.publishTicketUpdate).toHaveBeenCalledTimes(2);
    expect(notifier.publishTicketUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'ticket_failed',
        ticketId,
        tenantId: 'tenant-1',
        failedStep: 'triage',
        reason: 'max_attempts_reached',
        data: statusPayload,
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'phase1.triage.permanently_failed',
        pipelineEvent: PIPELINE_EVENTS.PERMANENTLY_FAILED,
        step: 'triage',
        attempt: 3,
        durationMs: expect.any(Number),
        error: 'max_attempts_reached',
      }),
    );
  });

  it('logs provider fallback when a non-primary provider handles triage', async () => {
    const logger = makeLogger();
    const service = new TriageStepService(
      makeRepo(),
      makeQueue(),
      makeAiGateway(undefined, 'openai'),
      makeNotifier(),
      makeStatusReader(),
      logger,
      0,
    );

    await service.process(ticketId);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'phase1.provider_fallback',
        pipelineEvent: PIPELINE_EVENTS.PROVIDER_FALLBACK,
        ticketId,
        step: 'triage',
        primaryProvider: 'openrouter',
        providerUsed: 'openai',
      }),
    );
  });
});

function makeRepo(overrides: Partial<ITriageRepository> = {}): ITriageRepository {
  return {
    getTicket: vi.fn().mockResolvedValue(ticket),
    getPhase: vi.fn().mockResolvedValue(null),
    markRunning: vi.fn().mockResolvedValue(1),
    saveRunningResult: vi.fn().mockResolvedValue(undefined),
    markSuccess: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markPermanentlyFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeQueue(): ITicketQueue {
  return { enqueue: vi.fn().mockResolvedValue(undefined) };
}

function makeAiGateway(error?: Error, provider = 'openrouter'): IAiGateway {
  return {
    primaryProvider: 'openrouter',
    triageTicket: vi.fn().mockImplementation(async () => {
      if (error) throw error;
      return {
        result: triageResult,
        provider,
        primaryProvider: 'openrouter',
        fallback: provider !== 'openrouter',
      } satisfies AiGatewayResponse<TriageResult>;
    }),
    draftResolution: vi.fn().mockImplementation(async () => {
      throw new Error('not used in triage tests');
    }),
  };
}

function makeNotifier(): INotificationService {
  return { publishTicketUpdate: vi.fn() };
}

function makeStatusReader(payload: TicketStatusResponse | null = null): ITicketStatusReader {
  return { getById: vi.fn().mockResolvedValue(payload) };
}

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
}
