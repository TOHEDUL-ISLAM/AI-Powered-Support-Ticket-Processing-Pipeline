// US-1.5: ticket persistence — insert and query ticket records
import type { PoolClient } from 'pg';
import { pool } from '../db';
import type { CreateTicketInput } from '../schemas/ticket.schema';

export interface Ticket {
  id: string;
  status: string;
  created_at: Date;
}

export interface RawPhaseRow {
  status: string;
  attempt_count: number;
  result: unknown;
  provider_used: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface RawTicketRow {
  id: string;
  tenant_id: string;
  submitter: string;
  subject: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  triage: RawPhaseRow | null;
  resolution: RawPhaseRow | null;
}

export interface ITicketRepository {
  create(client: PoolClient, data: CreateTicketInput): Promise<Ticket>;
  getById(id: string): Promise<RawTicketRow | null>;
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

  async getById(id: string): Promise<RawTicketRow | null> {
    const result = await pool.query<RawTicketRow>(
      `SELECT
         t.id, t.tenant_id, t.submitter, t.subject, t.status, t.created_at, t.updated_at,
         (SELECT row_to_json(p1)
          FROM ticket_phases p1
          WHERE p1.ticket_id = t.id AND p1.step_name = 'triage') AS triage,
         (SELECT row_to_json(p2)
          FROM ticket_phases p2
          WHERE p2.ticket_id = t.id AND p2.step_name = 'resolution') AS resolution
       FROM tickets t
       WHERE t.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
