// US-1.5: integration tests for POST /tickets — real DB, mock queue
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
    const app = createApp({ ticketQueue: new FailingQueue() });

    const response = await request(app).post('/tickets').send(VALID_BODY).expect(500);
    expect(response.body.error).toBe('internal_server_error');

    const dbResult = await pool.query(
      'SELECT id FROM tickets WHERE tenant_id = $1 AND submitter = $2 ORDER BY created_at DESC LIMIT 1',
      [VALID_BODY.tenant_id, VALID_BODY.submitter],
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
