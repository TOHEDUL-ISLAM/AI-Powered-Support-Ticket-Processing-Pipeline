// US-1.7: build sanitized health responses from dependency checks
import type { DependencyHealth, DependencyName, HealthChecks } from './checks';
import { createHealthChecks } from './checks';

export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  status: HealthStatus;
  service: 'ai-ticket-pipeline';
  version: string;
  dependencies: Record<DependencyName, DependencyHealth>;
  checked_at: string;
}

export const HEALTH_CHECK_TIMEOUT_MS = 500;

const DEPENDENCIES: DependencyName[] = ['database', 'sqs_phase1', 'sqs_phase2'];

export async function getHealth(
  version: string,
  healthChecks: HealthChecks = createHealthChecks(),
): Promise<HealthResponse> {
  const entries = await Promise.all(
    DEPENDENCIES.map(async (name) => {
      const result = await runDependencyCheck(healthChecks[name]);
      return [name, result] as const;
    }),
  );

  const dependencies = Object.fromEntries(entries) as Record<DependencyName, DependencyHealth>;
  const allOk = DEPENDENCIES.every((name) => dependencies[name].status === 'ok');

  return {
    status: allOk ? 'ok' : 'degraded',
    service: 'ai-ticket-pipeline',
    version,
    dependencies,
    checked_at: new Date().toISOString(),
  };
}

async function runDependencyCheck(check: () => Promise<void>): Promise<DependencyHealth> {
  const startedAt = Date.now();

  try {
    await withTimeout(check(), HEALTH_CHECK_TIMEOUT_MS);
    return { status: 'ok', latency_ms: elapsedMs(startedAt) };
  } catch {
    return { status: 'down', latency_ms: elapsedMs(startedAt) };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('health_check_timeout')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

