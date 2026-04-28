// US-2.2 + US-3.2: resolution persistence, Step 1 dependency checks, and provider metadata
import { pool, withTransaction } from '../db';
import type { TriagePhaseStatus } from './triage.repository';

export type ResolutionPhaseStatus = 'pending' | 'running' | 'success' | 'failed' | 'permanently_failed';

export interface ResolutionTicket {
  id: string;
  tenant_id: string;
  subject: string;
  body: string;
  status: string;
}

export interface ResolutionPhase {
  status: ResolutionPhaseStatus;
  attempt_count: number;
  result: ResolutionResult | null;
}

export interface TriageDependencyPhase {
  status: TriagePhaseStatus;
  result: Record<string, unknown> | null;
}

export interface ResolutionResult {
  customer_reply: string;
  internal_note: string;
  recommended_actions: string[];
}

export interface IResolutionRepository {
  getTicket(ticketId: string): Promise<ResolutionTicket | null>;
  getTriagePhase(ticketId: string): Promise<TriageDependencyPhase | null>;
  getResolutionPhase(ticketId: string): Promise<ResolutionPhase | null>;
  markRunning(ticketId: string): Promise<number>;
  markSuccess(
    ticketId: string,
    result: ResolutionResult,
    providerUsed: string,
    fallback: boolean,
    primaryProvider: string,
  ): Promise<void>;
  markFailed(ticketId: string, errorMessage: string): Promise<void>;
  markPermanentlyFailed(ticketId: string, errorMessage: string): Promise<void>;
}

export class ResolutionRepository implements IResolutionRepository {
  async getTicket(ticketId: string): Promise<ResolutionTicket | null> {
    const result = await pool.query<ResolutionTicket>(
      `SELECT id, tenant_id, subject, body, status
       FROM tickets
       WHERE id = $1`,
      [ticketId],
    );

    return result.rows[0] ?? null;
  }

  async getTriagePhase(ticketId: string): Promise<TriageDependencyPhase | null> {
    const result = await pool.query<TriageDependencyPhase>(
      `SELECT status, result
       FROM ticket_phases
       WHERE ticket_id = $1 AND step_name = 'triage'`,
      [ticketId],
    );

    return result.rows[0] ?? null;
  }

  async getResolutionPhase(ticketId: string): Promise<ResolutionPhase | null> {
    const result = await pool.query<ResolutionPhase>(
      `SELECT status, attempt_count, result
       FROM ticket_phases
       WHERE ticket_id = $1 AND step_name = 'resolution'`,
      [ticketId],
    );

    return result.rows[0] ?? null;
  }

  async markRunning(ticketId: string): Promise<number> {
    return withTransaction(async (client) => {
      const phase = await client.query<{ attempt_count: number }>(
        `INSERT INTO ticket_phases (
           ticket_id,
           step_name,
           status,
           attempt_count,
           started_at,
           updated_at
         )
         VALUES ($1, 'resolution', 'running', 1, now(), now())
         ON CONFLICT (ticket_id, step_name)
         DO UPDATE SET
           status = 'running',
           attempt_count = ticket_phases.attempt_count + 1,
           result = null,
           provider_used = null,
           error_message = null,
           started_at = COALESCE(ticket_phases.started_at, now()),
           updated_at = now()
         RETURNING attempt_count`,
        [ticketId],
      );

      const attempt = phase.rows[0].attempt_count;

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_started', 'resolution', $2::jsonb)`,
        [ticketId, JSON.stringify({ attempt })],
      );

      return attempt;
    });
  }

  async markSuccess(
    ticketId: string,
    result: ResolutionResult,
    providerUsed: string,
    fallback: boolean,
    primaryProvider: string,
  ): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE ticket_phases
         SET
           status = 'success',
           result = $2::jsonb,
           provider_used = $3,
           error_message = null,
           finished_at = now(),
           updated_at = now()
         WHERE ticket_id = $1 AND step_name = 'resolution'`,
        [ticketId, JSON.stringify(result), providerUsed],
      );

      await client.query(
        `UPDATE tickets
         SET status = 'completed', updated_at = now()
         WHERE id = $1`,
        [ticketId],
      );

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_completed', 'resolution', $2::jsonb)`,
        [ticketId, JSON.stringify({ provider_used: providerUsed, fallback })],
      );

      if (fallback) {
        await client.query(
          `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
           VALUES ($1, 'provider_fallback', 'resolution', $2::jsonb)`,
          [
            ticketId,
            JSON.stringify({
              primary_provider: primaryProvider,
              provider_used: providerUsed,
            }),
          ],
        );
      }
    });
  }

  async markFailed(ticketId: string, errorMessage: string): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE ticket_phases
         SET status = 'failed',
             error_message = $2,
             finished_at = now(),
             updated_at = now()
         WHERE ticket_id = $1 AND step_name = 'resolution' AND status = 'running'`,
        [ticketId, errorMessage],
      );

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_failed', 'resolution', $2::jsonb)`,
        [ticketId, JSON.stringify({ error: errorMessage })],
      );
    });
  }

  async markPermanentlyFailed(ticketId: string, errorMessage: string): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE ticket_phases
         SET status = 'permanently_failed',
             error_message = $2,
             finished_at = now(),
             updated_at = now()
         WHERE ticket_id = $1 AND step_name = 'resolution'`,
        [ticketId, errorMessage],
      );

      await client.query(
        `UPDATE tickets
         SET status = 'failed', updated_at = now()
         WHERE id = $1`,
        [ticketId],
      );

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_permanently_failed', 'resolution', $2::jsonb)`,
        [ticketId, JSON.stringify({ error: errorMessage })],
      );
    });
  }
}
