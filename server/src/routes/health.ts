// US-1.7: /health route wiring
import { Router } from 'express';
import type { HealthController } from '../controllers/health.controller';

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();

  router.get('/health', (req, res, next) => controller.getHealth(req, res, next));

  return router;
}

