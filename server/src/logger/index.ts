// US-1.5: Pino logger factory with PII redaction
import pino from 'pino';
import { config } from '../config';

export type Logger = pino.Logger;

export function createLogger(): Logger {
  return pino({
    level: config.LOG_LEVEL,
    redact: ['password', 'apiKey', 'authorization', 'PORTKEY_API_KEY', 'DATABASE_URL'],
  });
}
