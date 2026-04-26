// US-1.5: POST /tickets route wiring
import { Router } from 'express';
import type { TicketController } from '../controllers/ticket.controller';

export function createTicketsRouter(controller: TicketController): Router {
  const router = Router();

  router.post('/tickets', (req, res, next) => controller.create(req, res, next));
  router.get('/tickets/:id', (req, res, next) => controller.get(req, res, next));

  return router;
}
