// US-1.7: health endpoint integration tests with controlled dependency checks
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { HealthChecks } from '../../src/health/checks';

function passingChecks(): HealthChecks {
  return {
    database: async () => undefined,
    sqs_phase1: async () => undefined,
    sqs_phase2: async () => undefined,
  };
}

function failingChecks(failingDependency: keyof HealthChecks): HealthChecks {
  return {
    ...passingChecks(),
    [failingDependency]: async () => {
      throw new Error(
        'postgres://ticket_user:ticket_pass@localhost:5432/ai_ticket_pipeline http://localhost:4566/000000000000/phase1Queue arn:aws:sqs:us-east-1:000000000000:phase1Queue',
      );
    },
  };
}

describe('GET /health', () => {
  it('returns ok with each dependency listed when all checks pass', async () => {
    const app = createApp({ healthChecks: passingChecks() });

    const response = await request(app).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'ai-ticket-pipeline',
      version: '0.1.0',
      dependencies: {
        database: { status: 'ok' },
        sqs_phase1: { status: 'ok' },
        sqs_phase2: { status: 'ok' },
      },
    });
    expect(Date.parse(response.body.checked_at)).not.toBeNaN();
    expect(response.body.dependencies.database.latency_ms).toEqual(expect.any(Number));
  });

  it('returns degraded and names the database when the database check fails', async () => {
    const app = createApp({ healthChecks: failingChecks('database') });

    const response = await request(app).get('/health').expect(503);

    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.database.status).toBe('down');
    expect(response.body.dependencies.sqs_phase1.status).toBe('ok');
    expect(response.body.dependencies.sqs_phase2.status).toBe('ok');
  });

  it('returns degraded and names phase1 when the phase1 queue check fails', async () => {
    const app = createApp({ healthChecks: failingChecks('sqs_phase1') });

    const response = await request(app).get('/health').expect(503);

    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.sqs_phase1.status).toBe('down');
    expect(response.body.dependencies.database.status).toBe('ok');
    expect(response.body.dependencies.sqs_phase2.status).toBe('ok');
  });

  it('returns degraded and names phase2 when the phase2 queue check fails', async () => {
    const app = createApp({ healthChecks: failingChecks('sqs_phase2') });

    const response = await request(app).get('/health').expect(503);

    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.sqs_phase2.status).toBe('down');
    expect(response.body.dependencies.database.status).toBe('ok');
    expect(response.body.dependencies.sqs_phase1.status).toBe('ok');
  });

  it('does not expose secrets, URLs, ARNs, or raw dependency errors', async () => {
    const app = createApp({ healthChecks: failingChecks('database') });

    const response = await request(app).get('/health').expect(503);
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('ticket_pass');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('localhost:4566');
    expect(serialized).not.toContain('arn:aws:sqs');
    expect(serialized).not.toContain('phase1Queue');
  });
});

