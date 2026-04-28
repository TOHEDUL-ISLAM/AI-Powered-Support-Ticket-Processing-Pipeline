// US-7.1 + US-7.2: Pino logger factory, redaction, base fields, and pipeline event constants
import pino, { type DestinationStream } from 'pino';
import { config } from '../config';

export type Logger = pino.Logger;

const packageJson = require('../../package.json') as { version: string };

export const PIPELINE_EVENTS = {
  STEP_STARTED: 'step_started',
  STEP_COMPLETED: 'step_completed',
  STEP_FAILED: 'step_failed',
  RETRY_SCHEDULED: 'retry_scheduled',
  PROVIDER_FALLBACK: 'provider_fallback',
  PERMANENTLY_FAILED: 'permanently_failed',
  PIPELINE_COMPLETE: 'pipeline_complete',
  REPLAY_INITIATED: 'replay_initiated',
} as const;

export type PipelineEvent = (typeof PIPELINE_EVENTS)[keyof typeof PIPELINE_EVENTS];

export interface CreateLoggerOptions {
  level?: pino.LevelWithSilent;
  destination?: DestinationStream;
  pretty?: boolean;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const pretty = options.pretty ?? config.NODE_ENV === 'development';
  const loggerOptions: pino.LoggerOptions = {
    base: {
      service: 'ai-ticket-pipeline',
      environment: config.NODE_ENV,
      version: packageJson.version,
    },
    level: options.level ?? config.LOG_LEVEL,
    redact: {
      paths: [
        'password',
        '*.password',
        'apiKey',
        '*.apiKey',
        'authorization',
        '*.authorization',
        'PORTKEY_API_KEY',
        '*.PORTKEY_API_KEY',
        'DATABASE_URL',
        '*.DATABASE_URL',
      ],
      censor: '[Redacted]',
    },
  };

  if (pretty) {
    loggerOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    };
  }

  if (options.destination) {
    return pino(loggerOptions, options.destination);
  }

  return pino(loggerOptions);
}
