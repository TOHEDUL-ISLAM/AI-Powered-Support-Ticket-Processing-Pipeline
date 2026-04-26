// US-1.5: POST /tickets route wiring
import { Router } from 'express';
import type { TicketController } from '../controllers/ticket.controller';

export function createTicketsRouter(controller: TicketController): Router {
  const router = Router();

  router.post('/tickets', (req, res, next) => controller.create(req, res, next));

  return router;
}
