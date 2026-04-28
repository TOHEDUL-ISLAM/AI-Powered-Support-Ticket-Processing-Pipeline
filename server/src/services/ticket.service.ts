// US-1.5 + US-4.4 + US-5.3: ticket submission orchestration and replay
import { withTransaction } from '../db';
import { PIPELINE_EVENTS, type Logger } from '../logger';
import type { ITicketQueue } from '../queue/ticket.queue';
import type {
  ITicketRepository,
  RawPhaseRow,
  Ticket,
} from '../repositories/ticket.repository';
import type { CreateTicketInput } from '../schemas/ticket.schema';

export interface PhaseResponse {
  status: string;
  attemptCount: number;
  result: unknown;
  providerUsed: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TicketStatusResponse {
  ticketId: string;
  tenantId: string;
  submitter: string;
  subject: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  phases: {
    triage: PhaseResponse | null;
    resolution: PhaseResponse | null;
  };
}

export type ReplayOutcome = 'replayed' | 'not_found' | 'not_failed';

export interface ReplayResult {
  outcome: ReplayOutcome;
  step?: 'triage' | 'resolution';
}

export interface ITicketService {
  create(data: CreateTicketInput): Promise<Ticket>;
  getById(id: string): Promise<TicketStatusResponse | null>;
  replay(ticketId: string): Promise<ReplayResult>;
}

export interface ITicketStatusReader {
  getById(id: string): Promise<TicketStatusResponse | null>;
}

export class TicketService implements ITicketService {
  constructor(
    private readonly repository: ITicketRepository,
    private readonly phase1Queue: ITicketQueue,
    private readonly phase2Queue: ITicketQueue,
    private readonly logger: Logger,
  ) {}

  async create(data: CreateTicketInput): Promise<Ticket> {
    try {
      const ticket = await withTransaction(async (client) => {
        const created = await this.repository.create(client, data);
        this.logger.info({ ticketId: created.id, event: 'ticket.saved' });

        await this.phase1Queue.enqueue(created.id);
        this.logger.info({ ticketId: created.id, event: 'ticket.queued' });

        return created;
      });

      return ticket;
    } catch (err) {
      this.logger.error({
        event: 'ticket.queue_failed',
        error: err instanceof Error ? err.message : String(err),
      });
      this.logger.warn({ event: 'ticket.rollback_completed' });
      throw err;
    }
  }

  async replay(ticketId: string): Promise<ReplayResult> {
    const row = await this.repository.getById(ticketId);
    if (!row) return { outcome: 'not_found' };
    if (row.status !== 'failed') return { outcome: 'not_failed' };

    const triageStatus = (row.triage as { status?: string } | null)?.status;
    const resolutionStatus = (row.resolution as { status?: string } | null)?.status;

    let stepName: 'triage' | 'resolution';
    if (triageStatus === 'permanently_failed') {
      stepName = 'triage';
    } else if (resolutionStatus === 'permanently_failed') {
      stepName = 'resolution';
    } else {
      return { outcome: 'not_failed' };
    }

    await withTransaction(async (client) => {
      await this.repository.resetPhase(client, ticketId, stepName);
      await this.repository.setStatusQueued(client, ticketId);
      await this.repository.writeReplayEvent(client, ticketId, stepName);
    });

    if (stepName === 'triage') {
      await this.phase1Queue.enqueue(ticketId);
    } else {
      await this.phase2Queue.enqueue(ticketId);
    }

    this.logger.info({
      event: 'ticket.replay.queued',
      pipelineEvent: PIPELINE_EVENTS.REPLAY_INITIATED,
      ticketId,
      step: stepName,
    });
    return { outcome: 'replayed', step: stepName };
  }

  async getById(id: string): Promise<TicketStatusResponse | null> {
    const row = await this.repository.getById(id);
    if (!row) return null;
    return {
      ticketId: row.id,
      tenantId: row.tenant_id,
      submitter: row.submitter,
      subject: row.subject,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      phases: {
        triage: shapePhase(row.triage),
        resolution: shapePhase(row.resolution),
      },
    };
  }
}

function shapePhase(p: RawPhaseRow | null): PhaseResponse | null {
  if (!p) return null;
  return {
    status: p.status,
    attemptCount: p.attempt_count,
    result: p.result,
    providerUsed: p.provider_used,
    startedAt: p.started_at,
    finishedAt: p.finished_at,
  };
}
