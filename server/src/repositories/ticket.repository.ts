// US-1.5: ticket persistence — insert new ticket record
import type { PoolClient } from 'pg';
import type { CreateTicketInput } from '../schemas/ticket.schema';

export interface Ticket {
  id: string;
  status: string;
  created_at: Date;
}

export interface ITicketRepository {
  create(client: PoolClient, data: CreateTicketInput): Promise<Ticket>;
}

export class TicketRepository implements ITicketRepository {
  async create(client: PoolClient, data: CreateTicketInput): Promise<Ticket> {
    const result = await client.query<Ticket>(
      `INSERT INTO tickets (tenant_id, submitter, subject, body, status)
       VALUES ($1, $2, $3, $4, 'queued')
       RETURNING id, status, created_at`,
      [data.tenant_id, data.submitter, data.subject, data.body],
    );
    return result.rows[0];
  }
}
