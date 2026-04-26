// US-1.7: Express app factory with request IDs, routes, and error handling
import { SQSClient } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { HealthController } from './controllers/health.controller';
import { TicketController } from './controllers/ticket.controller';
import { pool } from './db';
import { createLogger } from './logger';
import { HealthRepository, type IHealthRepository } from './repositories/health.repository';
import { TicketRepository } from './repositories/ticket.repository';
import { createRouter } from './routes';
import { HealthService } from './services/health.service';
import { TicketService } from './services/ticket.service';
import type { ITicketQueue } from './queue/ticket.queue';
import { TicketQueue } from './queue/ticket.queue';

export interface AppOptions {
  healthRepository?: IHealthRepository;
  ticketQueue?: ITicketQueue;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const logger = createLogger();

  const sqsClient = new SQSClient({
    region: config.AWS_REGION,
    endpoint: config.LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });

  const healthRepository =
    options.healthRepository ??
    new HealthRepository(pool, sqsClient, config.SQS_PHASE1_QUEUE_URL, config.SQS_PHASE2_QUEUE_URL);
  const healthService = new HealthService(healthRepository);
  const healthController = new HealthController(healthService);

  const ticketQueue = options.ticketQueue ?? new TicketQueue(sqsClient, config.SQS_PHASE1_QUEUE_URL);
  const ticketRepository = new TicketRepository();
  const ticketService = new TicketService(ticketRepository, ticketQueue, logger);
  const ticketController = new TicketController(ticketService, logger);

  app.use(express.json({ limit: '100kb' }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const requestId = req.header('x-request-id') ?? randomUUID();
    req.id = requestId;
    next();
  });

  app.use(createRouter(healthController, ticketController));

  app.use((_err: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}
