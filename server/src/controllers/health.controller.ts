// US-1.7: handle /health HTTP requests
import type { NextFunction, Request, Response } from 'express';
import type { IHealthService } from '../services/health.service';

const packageJson = require('../../package.json') as { version: string };

export class HealthController {
  constructor(private readonly service: IHealthService) {}

  async getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await this.service.getHealth(packageJson.version);
      res.status(health.status === 'ok' ? 200 : 503).json(health);
    } catch (err) {
      next(err);
    }
  }
}
