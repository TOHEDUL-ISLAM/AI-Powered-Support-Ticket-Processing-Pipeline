// US-1.5: ticket submission orchestration — DB insert + SQS enqueue in one transaction
import { withTransaction } from '../db';
import type { Logger } from '../logger';
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

export interface ITicketService {
  create(data: CreateTicketInput): Promise<Ticket>;
  getById(id: string): Promise<TicketStatusResponse | null>;
}

export class TicketService implements ITicketService {
  constructor(
    private readonly repository: ITicketRepository,
    private readonly queue: ITicketQueue,
    private readonly logger: Logger,
  ) {}

  async create(data: CreateTicketInput): Promise<Ticket> {
    try {
      const ticket = await withTransaction(async (client) => {
        const created = await this.repository.create(client, data);
        this.logger.info({ ticketId: created.id, event: 'ticket.saved' });

        await this.queue.enqueue(created.id);
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
