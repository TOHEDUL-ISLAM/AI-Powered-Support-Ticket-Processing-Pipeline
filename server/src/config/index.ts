// US-1.4: zod-validated config — single source of truth for all env vars
import * as dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().url(),

  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  LOCALSTACK_ENDPOINT: z.string().url().optional(),

  SQS_PHASE1_QUEUE_URL: z.string().url(),
  SQS_PHASE2_QUEUE_URL: z.string().url(),
  SQS_PHASE1_DLQ_URL: z.string().url(),
  SQS_PHASE2_DLQ_URL: z.string().url(),

  PORTKEY_API_KEY: z.string().min(1),
  PORTKEY_CONFIG_ID: z.string().min(1),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  result.error.issues.forEach((issue) => {
    process.stderr.write(`${String(issue.path[0])}\n`);
  });
  process.exit(1);
}

export const config = Object.freeze(result.data);
