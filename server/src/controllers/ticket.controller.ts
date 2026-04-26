// US-1.5: handle POST /tickets and GET /tickets/:id — validate, log, delegate to service, respond
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { Logger } from '../logger';
import { CreateTicketSchema, formatZodErrors } from '../schemas/ticket.schema';
import type { ITicketService } from '../services/ticket.service';

export class TicketController {
  constructor(
    private readonly service: ITicketService,
    private readonly logger: Logger,
  ) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = CreateTicketSchema.safeParse(req.body);

    if (!parsed.success) {
      this.logger.warn({
        event: 'ticket.validation_failed',
        fields: parsed.error.issues.map((i) => String(i.path[0])),
        requestId: req.id,
      });
      res.status(400).json({
        error: 'validation_error',
        issues: formatZodErrors(parsed.error),
      });
      return;
    }

    const { tenant_id, submitter } = parsed.data;
    this.logger.info({ event: 'ticket.received', tenantId: tenant_id, submitter, requestId: req.id });

    try {
      const ticket = await this.service.create(parsed.data);
      res.status(202).json({
        ticketId: ticket.id,
        status: ticket.status,
        createdAt: ticket.created_at,
      });
      this.logger.info({ event: 'ticket.response_sent', ticketId: ticket.id, status: ticket.status });
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_ticket_id' });
      return;
    }

    try {
      const ticket = await this.service.getById(parsed.data);
      if (!ticket) {
        res.status(404).json({ error: 'ticket_not_found' });
        return;
      }
      res.status(200).json(ticket);
    } catch (err) {
      next(err);
    }
  }
}
