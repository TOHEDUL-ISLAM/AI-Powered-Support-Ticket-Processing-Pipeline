// US-1.5 + US-1.6: integration tests for POST /tickets and GET /tickets/:id — real DB, mock queue
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { pool } from '../../src/db';
import type { ITicketQueue } from '../../src/queue/ticket.queue';

class PassingQueue implements ITicketQueue {
  async enqueue(_ticketId: string): Promise<void> {}
}

class FailingQueue implements ITicketQueue {
  async enqueue(_ticketId: string): Promise<void> {
    throw new Error('sqs_unavailable');
  }
}

const VALID_BODY = {
  subject: 'Login broken',
  body: 'Cannot log in since yesterday',
  submitter: 'alice',
  tenant_id: 'acme',
};

const createdIds: string[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await pool.query('DELETE FROM tickets WHERE id = ANY($1::uuid[])', [createdIds]);
    createdIds.length = 0;
  }
});

describe('POST /tickets', () => {
  it('returns 202 with ticketId, status, and createdAt within 500ms', async () => {
    const app = createApp({ ticketQueue: new PassingQueue() });
    const start = Date.now();

    const response = await request(app).post('/tickets').send(VALID_BODY).expect(202);

    expect(Date.now() - start).toBeLessThan(500);
    expect(response.body).toMatchObject({ status: 'queued' });
    expect(typeof response.body.ticketId).toBe('string');
    expect(Date.parse(response.body.createdAt)).not.toBeNaN();

    createdIds.push(response.body.ticketId);
  });

  it('persists the ticket to the database with status queued', async () => {
    const app = createApp({ ticketQueue: new PassingQueue() });

    const response = await request(app).post('/tickets').send(VALID_BODY).expect(202);
    const { ticketId } = response.body;
    createdIds.push(ticketId);

    const dbResult = await pool.query('SELECT id, status FROM tickets WHERE id = $1', [ticketId]);
    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0].status).toBe('queued');
  });

  it('rolls back the DB record when the queue is unavailable', async () => {
    const uniqueTenantId = `rollback-test-${Date.now()}`;
    const app = createApp({ ticketQueue: new FailingQueue() });

    const response = await request(app)
      .post('/tickets')
      .send({ ...VALID_BODY, tenant_id: uniqueTenantId })
      .expect(500);
    expect(response.body.error).toBe('internal_server_error');

    const dbResult = await pool.query(
      'SELECT id FROM tickets WHERE tenant_id = $1',
      [uniqueTenantId],
    );
    expect(dbResult.rowCount).toBe(0);
  });

  it('returns 400 with field-specific issues when subject is missing', async () => {
    const app = createApp({ ticketQueue: new PassingQueue() });
    const { subject: _, ...bodyWithoutSubject } = VALID_BODY;

    const response = await request(app).post('/tickets').send(bodyWithoutSubject).expect(400);

    expect(response.body.error).toBe('validation_error');
    expect(Array.isArray(response.body.issues)).toBe(true);
    expect(response.body.issues.some((i: { field: string }) => i.field === 'subject')).toBe(true);
  });

  it('returns 400 listing all failing fields when multiple are missing', async () => {
    const app = createApp({ ticketQueue: new PassingQueue() });

    const response = await request(app)
      .post('/tickets')
      .send({ subject: '', body: '' })
      .expect(400);

    expect(response.body.error).toBe('validation_error');
    const fields = response.body.issues.map((i: { field: string }) => i.field);
    expect(fields).toContain('subject');
    expect(fields).toContain('body');
    expect(fields).toContain('submitter');
    expect(fields).toContain('tenant_id');
  });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

async function insertTicket(status: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO tickets (tenant_id, submitter, subject, body, status)
     VALUES ('acme', 'alice', 'Login broken', 'Cannot log in', $1)
     RETURNING id`,
    [status],
  );
  return result.rows[0].id;
}

async function insertPhase(
  ticketId: string,
  stepName: string,
  status: string,
  result: object | null = null,
): Promise<void> {
  await pool.query(
    `INSERT INTO ticket_phases (ticket_id, step_name, status, attempt_count, result, started_at, finished_at)
     VALUES ($1, $2, $3, 1, $4, NOW(), NOW())`,
    [ticketId, stepName, status, result ? JSON.stringify(result) : null],
  );
}

// ─── GET /tickets/:id ─────────────────────────────────────────────────────────

describe('GET /tickets/:id', () => {
  const app = createApp({ ticketQueue: new PassingQueue() });

  it('queued ticket returns 200 with both phases null', async () => {
    const ticketId = await insertTicket('queued');
    createdIds.push(ticketId);

    const res = await request(app).get(`/tickets/${ticketId}`).expect(200);

    expect(res.body.ticketId).toBe(ticketId);
    expect(res.body.status).toBe('queued');
    expect(res.body.phases.triage).toBeNull();
    expect(res.body.phases.resolution).toBeNull();
  });

  it('processing ticket returns triage running and resolution null', async () => {
    const ticketId = await insertTicket('processing');
    await insertPhase(ticketId, 'triage', 'running');
    createdIds.push(ticketId);

    const res = await request(app).get(`/tickets/${ticketId}`).expect(200);

    expect(res.body.status).toBe('processing');
    expect(res.body.phases.triage.status).toBe('running');
    expect(res.body.phases.resolution).toBeNull();
  });

  it('completed ticket returns both phases with results', async () => {
    const ticketId = await insertTicket('completed');
    await insertPhase(ticketId, 'triage', 'success', { category: 'billing' });
    await insertPhase(ticketId, 'resolution', 'success', { draft: 'Here is your answer' });
    createdIds.push(ticketId);

    const res = await request(app).get(`/tickets/${ticketId}`).expect(200);

    expect(res.body.status).toBe('completed');
    expect(res.body.phases.triage.status).toBe('success');
    expect(res.body.phases.resolution.status).toBe('success');
    expect(res.body.phases.resolution.result).toEqual({ draft: 'Here is your answer' });
  });

  it('failed ticket returns triage permanently_failed and resolution null', async () => {
    const ticketId = await insertTicket('failed');
    await insertPhase(ticketId, 'triage', 'permanently_failed');
    createdIds.push(ticketId);

    const res = await request(app).get(`/tickets/${ticketId}`).expect(200);

    expect(res.body.status).toBe('failed');
    expect(res.body.phases.triage.status).toBe('permanently_failed');
    expect(res.body.phases.resolution).toBeNull();
  });

  it('returns 404 for a valid UUID that does not exist', async () => {
    const res = await request(app)
      .get('/tickets/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body.error).toBe('ticket_not_found');
  });

  it('returns 400 for a non-UUID id', async () => {
    const res = await request(app).get('/tickets/not-a-uuid').expect(400);
    expect(res.body.error).toBe('invalid_ticket_id');
  });

  it('responds within 200ms across 20 sequential calls', async () => {
    const ticketId = await insertTicket('queued');
    createdIds.push(ticketId);

    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      await request(app).get(`/tickets/${ticketId}`).expect(200);
      expect(Date.now() - start).toBeLessThan(200);
    }
  });
});
