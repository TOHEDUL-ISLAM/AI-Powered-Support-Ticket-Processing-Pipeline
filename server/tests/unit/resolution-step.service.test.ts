// US-4.3 + US-4.4: resolution step service — triage dependency, DB failure isolation, notification wiring
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { INotificationService } from '../../src/realtime';
import type { IResolutionRepository } from '../../src/repositories/resolution.repository';
import { ResolutionStepService } from '../../src/services/resolution-step.service';
import type { ITicketStatusReader, TicketStatusResponse } from '../../src/services/ticket.service';
import type { IAiGateway } from '../../src/ai/types';
import { PIPELINE_EVENTS, type Logger } from '../../src/logger';

const makeTicket = () => ({
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  tenant_id: 'tenant-1',
  subject: 'Cannot access my account',
  body: 'I have been locked out for two days.',
  status: 'processing',
});

const makeTriagePhase = () => ({
  status: 'success' as const,
  result: {
    category: 'account_access',
    priority: 'medium',
    sentiment: 'frustrated',
    escalation_needed: false,
    routing_target: 'tier1',
    summary: 'Customer locked out of account.',
  },
});

const makeResolutionResult = () => ({
  customer_reply: 'We apologise for the inconvenience. Your account has been unlocked.',
  internal_note: 'Password reset issued. Monitor for follow-up.',
  recommended_actions: ['Verify account status', 'Send password reset email'],
});

const makeFullPayload = (): TicketStatusResponse => ({
  ticketId: makeTicket().id,
  tenantId: 'tenant-1',
  submitter: 'user@example.com',
  subject: makeTicket().subject,
  status: 'completed',
  createdAt: new Date(),
  updatedAt: new Date(),
  phases: {
    triage: {
      status: 'success',
      attemptCount: 1,
      result: makeTriagePhase().result,
      providerUsed: 'openrouter',
      startedAt: null,
      finishedAt: null,
    },
    resolution: {
      status: 'success',
      attemptCount: 1,
      result: makeResolutionResult(),
      providerUsed: 'openrouter',
      startedAt: null,
      finishedAt: null,
    },
  },
});

function makeRepo(overrides: Partial<IResolutionRepository> = {}): IResolutionRepository {
  return {
    getTicket: vi.fn().mockResolvedValue(makeTicket()),
    getTriagePhase: vi.fn().mockResolvedValue(makeTriagePhase()),
    getResolutionPhase: vi.fn().mockResolvedValue(null),
    markRunning: vi.fn().mockResolvedValue(1),
    markSuccess: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markPermanentlyFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeAiGateway(provider = 'openrouter'): IAiGateway {
  return {
    primaryProvider: 'openrouter',
    triageTicket: vi.fn(),
    draftResolution: vi.fn().mockResolvedValue({
      result: makeResolutionResult(),
      provider,
      primaryProvider: 'openrouter',
      fallback: provider !== 'openrouter',
    }),
  };
}

function makeNotifier(): INotificationService {
  return { publishTicketUpdate: vi.fn() };
}

function makeStatusReader(payload: TicketStatusResponse | null = makeFullPayload()): ITicketStatusReader {
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

describe('ResolutionStepService', () => {
  describe('triage not ready — no AI call, no notification', () => {
    it('returns triage_not_ready when triage phase is null', async () => {
      const repo = makeRepo({ getTriagePhase: vi.fn().mockResolvedValue(null) });
      const gateway = makeAiGateway();
      const notifier = makeNotifier();
      const reader = makeStatusReader();
      const svc = new ResolutionStepService(repo, gateway, notifier, reader, makeLogger(), 0);

      const result = await svc.process(makeTicket().id);

      expect(result.outcome).toBe('triage_not_ready');
      expect(gateway.draftResolution).not.toHaveBeenCalled();
      expect(notifier.publishTicketUpdate).not.toHaveBeenCalled();
    });

    it('returns triage_not_ready when triage status is running', async () => {
      const repo = makeRepo({
        getTriagePhase: vi.fn().mockResolvedValue({ status: 'running', result: null }),
      });
      const gateway = makeAiGateway();
      const notifier = makeNotifier();
      const svc = new ResolutionStepService(repo, gateway, notifier, makeStatusReader(), makeLogger(), 0);

      const result = await svc.process(makeTicket().id);

      expect(result.outcome).toBe('triage_not_ready');
      expect(gateway.draftResolution).not.toHaveBeenCalled();
    });

    it('returns triage_not_ready when triage success but result is null', async () => {
      const repo = makeRepo({
        getTriagePhase: vi.fn().mockResolvedValue({ status: 'success', result: null }),
      });
      const gateway = makeAiGateway();
      const notifier = makeNotifier();
      const svc = new ResolutionStepService(repo, gateway, notifier, makeStatusReader(), makeLogger(), 0);

      const result = await svc.process(makeTicket().id);

      expect(result.outcome).toBe('triage_not_ready');
      expect(gateway.draftResolution).not.toHaveBeenCalled();
    });
  });

  describe('DB failure — notification must not be sent', () => {
    it('propagates the error and does not call notifier when markSuccess throws', async () => {
      const repo = makeRepo({
        markSuccess: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      const notifier = makeNotifier();
      const svc = new ResolutionStepService(
        repo,
        makeAiGateway(),
        notifier,
        makeStatusReader(),
        makeLogger(),
        0,
      );

      await expect(svc.process(makeTicket().id)).rejects.toThrow('DB connection lost');
      expect(notifier.publishTicketUpdate).toHaveBeenCalledTimes(1);
      expect(notifier.publishTicketUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'step_started',
          ticketId: makeTicket().id,
          tenantId: makeTicket().tenant_id,
          step: 'resolution',
          attempt: 1,
        }),
      );
    });

    it('does not call notifier when markRunning throws', async () => {
      const repo = makeRepo({
        markRunning: vi.fn().mockRejectedValue(new Error('DB timeout')),
      });
      const notifier = makeNotifier();
      const svc = new ResolutionStepService(
        repo,
        makeAiGateway(),
        notifier,
        makeStatusReader(),
        makeLogger(),
        0,
      );

      await expect(svc.process(makeTicket().id)).rejects.toThrow('DB timeout');
      expect(notifier.publishTicketUpdate).not.toHaveBeenCalled();
    });
  });

  describe('happy path — notification sent with correct payload', () => {
    let repo: IResolutionRepository;
    let gateway: IAiGateway;
    let notifier: INotificationService;
    let reader: ITicketStatusReader;
    let svc: ResolutionStepService;
    const ticketId = makeTicket().id;
    const fullPayload = makeFullPayload();

    beforeEach(() => {
      repo = makeRepo();
      gateway = makeAiGateway();
      notifier = makeNotifier();
      reader = makeStatusReader(fullPayload);
      svc = new ResolutionStepService(repo, gateway, notifier, reader, makeLogger(), 0);
    });

    it('returns processed outcome', async () => {
      const result = await svc.process(ticketId);
      expect(result.outcome).toBe('processed');
      expect(result.attempt).toBe(1);
    });

    it('calls markSuccess with AI result and provider metadata', async () => {
      await svc.process(ticketId);
      expect(repo.markSuccess).toHaveBeenCalledWith(
        ticketId,
        makeResolutionResult(),
        'openrouter',
        false,
        'openrouter',
      );
    });

    it('publishes started, completed, and pipeline completed after successful save', async () => {
      await svc.process(ticketId);
      expect(notifier.publishTicketUpdate).toHaveBeenCalledTimes(3);
      expect(notifier.publishTicketUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'step_started',
          ticketId,
          tenantId: 'tenant-1',
          step: 'resolution',
          attempt: 1,
        }),
      );
      expect(notifier.publishTicketUpdate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'step_completed',
          ticketId,
          tenantId: 'tenant-1',
          step: 'resolution',
          attempt: 1,
          providerUsed: 'openrouter',
          fallback: false,
        }),
      );
      expect(notifier.publishTicketUpdate).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          type: 'pipeline_completed',
          ticketId,
          tenantId: 'tenant-1',
          data: fullPayload,
        }),
      );
    });

    it('logs started, completed, and pipeline complete with standard pipelineEvent fields', async () => {
      const logger = makeLogger();
      const loggedSvc = new ResolutionStepService(repo, gateway, notifier, reader, logger, 0);

      await loggedSvc.process(ticketId);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'phase2.resolution.started',
          pipelineEvent: PIPELINE_EVENTS.STEP_STARTED,
          step: 'resolution',
          attempt: 1,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'phase2.resolution.completed',
          pipelineEvent: PIPELINE_EVENTS.STEP_COMPLETED,
          step: 'resolution',
          attempt: 1,
          durationMs: expect.any(Number),
          providerUsed: 'openrouter',
          fallback: false,
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'phase2.pipeline.completed',
          pipelineEvent: PIPELINE_EVENTS.PIPELINE_COMPLETE,
          ticketId,
          durationMs: expect.any(Number),
          status: 'completed',
        }),
      );
    });

    it('logs provider fallback when a non-primary provider handles resolution', async () => {
      const logger = makeLogger();
      const fallbackSvc = new ResolutionStepService(
        repo,
        makeAiGateway('openai'),
        notifier,
        reader,
        logger,
        0,
      );

      await fallbackSvc.process(ticketId);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'phase2.provider_fallback',
          pipelineEvent: PIPELINE_EVENTS.PROVIDER_FALLBACK,
          ticketId,
          step: 'resolution',
          primaryProvider: 'openrouter',
          providerUsed: 'openai',
        }),
      );
    });

    it('re-queries DB for payload via ticketStatusReader', async () => {
      await svc.process(ticketId);
      expect(reader.getById).toHaveBeenCalledWith(ticketId);
    });

    it('skips notification without throwing when getById returns null', async () => {
      const nullReader = makeStatusReader(null);
      const noopNotifier = makeNotifier();
      const safeSvc = new ResolutionStepService(repo, gateway, noopNotifier, nullReader, makeLogger(), 0);

      const result = await safeSvc.process(ticketId);

      expect(result.outcome).toBe('processed');
      expect(noopNotifier.publishTicketUpdate).toHaveBeenCalledTimes(2);
      expect(noopNotifier.publishTicketUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pipeline_completed' }),
      );
    });

    it('passes triage result and ticket content to AI gateway', async () => {
      await svc.process(ticketId);
      expect(gateway.draftResolution).toHaveBeenCalledWith({
        ticketId: makeTicket().id,
        subject: makeTicket().subject,
        body: makeTicket().body,
        triage: makeTriagePhase().result,
      });
    });
  });
});
