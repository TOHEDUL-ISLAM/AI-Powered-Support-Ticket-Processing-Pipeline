// US-1.7: root router for service endpoints
import { Router } from 'express';
import type { HealthChecks } from '../health/checks';
import { createHealthRouter } from './health';

export interface RoutesOptions {
  healthChecks?: HealthChecks;
}

export function createRouter(options: RoutesOptions = {}): Router {
  const router = Router();

  router.use(createHealthRouter({ healthChecks: options.healthChecks }));

  return router;
}

