// US-1.5: ticket submission orchestration — DB insert + SQS enqueue in one transaction
import { withTransaction } from '../db';
import type { Logger } from '../logger';
import type { ITicketQueue } from '../queue/ticket.queue';
import type { ITicketRepository, Ticket } from '../repositories/ticket.repository';
import type { CreateTicketInput } from '../schemas/ticket.schema';

export interface ITicketService {
  create(data: CreateTicketInput): Promise<Ticket>;
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
}
