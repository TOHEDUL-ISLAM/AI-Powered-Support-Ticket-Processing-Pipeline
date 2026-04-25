// US-1.7: Express app factory with request IDs, routes, and error handling
import { randomUUID } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import type { HealthChecks } from './health/checks';
import { createRouter } from './routes';

export interface AppOptions {
  healthChecks?: HealthChecks;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.use(express.json({ limit: '100kb' }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const requestId = req.header('x-request-id') ?? randomUUID();
    req.id = requestId;
    next();
  });

  app.use(createRouter({ healthChecks: options.healthChecks }));

  app.use((_err: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}
