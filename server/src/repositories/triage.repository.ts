// US-2.1 + US-2.3 + US-3.2 + US-4.1: triage persistence, handoff audit, and provider metadata
import { pool, withTransaction } from '../db';

export type TriagePhaseStatus = 'pending' | 'running' | 'success' | 'failed' | 'permanently_failed';

export interface TriageTicket {
  id: string;
  tenant_id: string;
  subject: string;
  body: string;
  status: string;
}

export interface TriagePhase {
  status: TriagePhaseStatus;
  attempt_count: number;
  result: TriageResult | null;
  provider_used: string | null;
}

export type TriagePriority = 'low' | 'medium' | 'high' | 'critical';
export type TriageSentiment = 'positive' | 'neutral' | 'negative' | 'frustrated';

export interface TriageResult {
  category: string;
  priority: TriagePriority;
  sentiment: TriageSentiment;
  escalation_needed: boolean;
  routing_target: string;
  summary: string;
}

export interface ITriageRepository {
  getTicket(ticketId: string): Promise<TriageTicket | null>;
  getPhase(ticketId: string): Promise<TriagePhase | null>;
  markRunning(ticketId: string): Promise<number>;
  saveRunningResult(ticketId: string, result: TriageResult, providerUsed: string): Promise<void>;
  markSuccess(
    ticketId: string,
    result: TriageResult,
    providerUsed: string,
    fallback: boolean,
    primaryProvider: string,
  ): Promise<void>;
  markFailed(ticketId: string, errorMessage: string): Promise<void>;
  markPermanentlyFailed(ticketId: string, errorMessage: string): Promise<void>;
}

export class TriageRepository implements ITriageRepository {
  async getTicket(ticketId: string): Promise<TriageTicket | null> {
    const result = await pool.query<TriageTicket>(
      `SELECT id, tenant_id, subject, body, status
       FROM tickets
       WHERE id = $1`,
      [ticketId],
    );

    return result.rows[0] ?? null;
  }

  async getPhase(ticketId: string): Promise<TriagePhase | null> {
    const result = await pool.query<TriagePhase>(
      `SELECT status, attempt_count, result, provider_used
       FROM ticket_phases
       WHERE ticket_id = $1 AND step_name = 'triage'`,
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
         VALUES ($1, 'triage', 'running', 1, now(), now())
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
        `UPDATE tickets
         SET status = 'processing', updated_at = now()
         WHERE id = $1`,
        [ticketId],
      );

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_started', 'triage', $2::jsonb)`,
        [ticketId, JSON.stringify({ attempt })],
      );

      return attempt;
    });
  }

  async saveRunningResult(
    ticketId: string,
    result: TriageResult,
    providerUsed: string,
  ): Promise<void> {
    await pool.query(
      `UPDATE ticket_phases
       SET
         result = $2::jsonb,
         provider_used = $3,
         error_message = null,
         updated_at = now()
       WHERE ticket_id = $1 AND step_name = 'triage' AND status = 'running'`,
      [ticketId, JSON.stringify(result), providerUsed],
    );
  }

  async markSuccess(
    ticketId: string,
    result: TriageResult,
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
         WHERE ticket_id = $1 AND step_name = 'triage'`,
        [ticketId, JSON.stringify(result), providerUsed],
      );

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_completed', 'triage', $2::jsonb)`,
        [ticketId, JSON.stringify({ provider_used: providerUsed, fallback })],
      );

      if (fallback) {
        await client.query(
          `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
           VALUES ($1, 'provider_fallback', 'triage', $2::jsonb)`,
          [
            ticketId,
            JSON.stringify({
              primary_provider: primaryProvider,
              provider_used: providerUsed,
            }),
          ],
        );
      }

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_handoff', 'triage', $2::jsonb)`,
        [ticketId, JSON.stringify({ from_step: 'triage', to_step: 'resolution' })],
      );
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
         WHERE ticket_id = $1 AND step_name = 'triage' AND status = 'running'`,
        [ticketId, errorMessage],
      );

      await client.query(
        `INSERT INTO ticket_events (ticket_id, event_type, step_name, metadata)
         VALUES ($1, 'step_failed', 'triage', $2::jsonb)`,
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
         WHERE ticket_id = $1 AND step_name = 'triage'`,
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
         VALUES ($1, 'step_permanently_failed', 'triage', $2::jsonb)`,
        [ticketId, JSON.stringify({ error: errorMessage })],
      );
    });
  }
}
