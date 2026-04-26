// US-1.6: unit tests for GET /tickets/:id response shaping
import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import type { ITicketQueue } from '../../src/queue/ticket.queue';
import type {
  ITicketRepository,
  RawTicketRow,
  Ticket,
} from '../../src/repositories/ticket.repository';
import type { CreateTicketInput } from '../../src/schemas/ticket.schema';
import { TicketService } from '../../src/services/ticket.service';
import { createLogger } from '../../src/logger';

class FakeQueue implements ITicketQueue {
  async enqueue(_id: string): Promise<void> {}
}

function makeRepo(row: RawTicketRow | null): ITicketRepository {
  return {
    async create(_client: PoolClient, _data: CreateTicketInput): Promise<Ticket> {
      throw new Error('not used in these tests');
    },
    async getById(_id: string): Promise<RawTicketRow | null> {
      return row;
    },
  };
}

const BASE_ROW: RawTicketRow = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: 'acme',
  submitter: 'alice',
  subject: 'Login broken',
  status: 'queued',
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:00:00Z'),
  triage: null,
  resolution: null,
};

describe('TicketService.getById — response shaping', () => {
  const logger = createLogger();

  it('returns null when ticket does not exist', async () => {
    const service = new TicketService(makeRepo(null), new FakeQueue(), logger);
    const result = await service.getById(BASE_ROW.id);
    expect(result).toBeNull();
  });

  it('maps snake_case DB columns to camelCase response fields', async () => {
    const service = new TicketService(makeRepo(BASE_ROW), new FakeQueue(), logger);
    const result = await service.getById(BASE_ROW.id);

    expect(result).not.toBeNull();
    expect(result!.ticketId).toBe(BASE_ROW.id);
    expect(result!.tenantId).toBe('acme');
    expect(result!.submitter).toBe('alice');
    expect(result!.subject).toBe('Login broken');
    expect(result!.status).toBe('queued');
  });

  it('returns null for both phases when ticket is queued with no phases', async () => {
    const service = new TicketService(makeRepo(BASE_ROW), new FakeQueue(), logger);
    const result = await service.getById(BASE_ROW.id);

    expect(result!.phases.triage).toBeNull();
    expect(result!.phases.resolution).toBeNull();
  });

  it('shapes triage phase to camelCase and strips internal DB columns', async () => {
    const rowWithTriage: RawTicketRow = {
      ...BASE_ROW,
      status: 'processing',
      triage: {
        status: 'running',
        attempt_count: 1,
        result: null,
        provider_used: 'claude',
        started_at: '2025-01-01T00:00:01Z',
        finished_at: null,
      },
    };
    const service = new TicketService(makeRepo(rowWithTriage), new FakeQueue(), logger);
    const result = await service.getById(BASE_ROW.id);

    expect(result!.phases.triage).toMatchObject({
      status: 'running',
      attemptCount: 1,
      providerUsed: 'claude',
      startedAt: '2025-01-01T00:00:01Z',
      finishedAt: null,
    });
    expect(result!.phases.triage).not.toHaveProperty('attempt_count');
    expect(result!.phases.triage).not.toHaveProperty('provider_used');
    expect(result!.phases.triage).not.toHaveProperty('error_message');
    expect(result!.phases.resolution).toBeNull();
  });

  it('exposes both phases when ticket is completed', async () => {
    const completedRow: RawTicketRow = {
      ...BASE_ROW,
      status: 'completed',
      triage: {
        status: 'success',
        attempt_count: 1,
        result: { category: 'billing' },
        provider_used: 'claude',
        started_at: '2025-01-01T00:00:01Z',
        finished_at: '2025-01-01T00:00:02Z',
      },
      resolution: {
        status: 'success',
        attempt_count: 1,
        result: { draft: 'Here is your answer' },
        provider_used: 'claude',
        started_at: '2025-01-01T00:00:03Z',
        finished_at: '2025-01-01T00:00:05Z',
      },
    };
    const service = new TicketService(makeRepo(completedRow), new FakeQueue(), logger);
    const result = await service.getById(BASE_ROW.id);

    expect(result!.phases.triage).not.toBeNull();
    expect(result!.phases.resolution).not.toBeNull();
    expect(result!.phases.resolution!.result).toEqual({ draft: 'Here is your answer' });
    expect(result!.phases.resolution!.attemptCount).toBe(1);
  });
});
