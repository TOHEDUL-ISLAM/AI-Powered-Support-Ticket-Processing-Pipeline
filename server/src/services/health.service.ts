// US-1.7: build sanitized health responses from dependency checks
import type { IHealthRepository } from '../repositories/health.repository';

export type HealthStatus = 'ok' | 'degraded';
export type DependencyName = 'database' | 'sqs_phase1' | 'sqs_phase2';
export type DependencyState = 'ok' | 'down';

export interface DependencyHealth {
  status: DependencyState;
  latency_ms: number;
}

export interface HealthResponse {
  status: HealthStatus;
  service: 'ai-ticket-pipeline';
  version: string;
  dependencies: Record<DependencyName, DependencyHealth>;
  checked_at: string;
}

export interface IHealthService {
  getHealth(version: string): Promise<HealthResponse>;
}

const HEALTH_CHECK_TIMEOUT_MS = 500;
const DEPENDENCIES: DependencyName[] = ['database', 'sqs_phase1', 'sqs_phase2'];

export class HealthService implements IHealthService {
  constructor(private readonly repository: IHealthRepository) {}

  async getHealth(version: string): Promise<HealthResponse> {
    const checkMap: Record<DependencyName, () => Promise<void>> = {
      database: () => this.repository.checkDatabase(),
      sqs_phase1: () => this.repository.checkSqsPhase1(),
      sqs_phase2: () => this.repository.checkSqsPhase2(),
    };

    const entries = await Promise.all(
      DEPENDENCIES.map(async (name) => {
        const result = await this.runCheck(checkMap[name]);
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

  private async runCheck(check: () => Promise<void>): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      await this.withTimeout(check(), HEALTH_CHECK_TIMEOUT_MS);
      return { status: 'ok', latency_ms: this.elapsedMs(startedAt) };
    } catch {
      return { status: 'down', latency_ms: this.elapsedMs(startedAt) };
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('health_check_timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  }

  private elapsedMs(startedAt: number): number {
    return Math.max(0, Date.now() - startedAt);
  }
}
