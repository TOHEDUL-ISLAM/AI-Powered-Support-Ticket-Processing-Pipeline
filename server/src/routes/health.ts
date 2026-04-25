// US-1.7: /health route reporting database and main queue reachability
import { Router } from 'express';
import type { HealthChecks } from '../health/checks';
import { getHealth } from '../health/service';

const packageJson = require('../../package.json') as { version: string };

export interface HealthRouterOptions {
  healthChecks?: HealthChecks;
}

export function createHealthRouter(options: HealthRouterOptions = {}): Router {
  const router = Router();

  router.get('/health', async (_req, res, next) => {
    try {
      const health = await getHealth(packageJson.version, options.healthChecks);
      res.status(health.status === 'ok' ? 200 : 503).json(health);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

