// US-1.7: root router for service endpoints
import { Router } from 'express';
import type { HealthController } from '../controllers/health.controller';
import type { TicketController } from '../controllers/ticket.controller';
import { createHealthRouter } from './health';
import { createTicketsRouter } from './tickets';

export function createRouter(healthController: HealthController, ticketController: TicketController): Router {
  const router = Router();

  router.use(createHealthRouter(healthController));
  router.use(createTicketsRouter(ticketController));

  return router;
}

