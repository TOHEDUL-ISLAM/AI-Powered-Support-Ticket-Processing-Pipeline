// US-1.7: health dependency checks for database and SQS reachability
import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { Pool } from 'pg';
import { config } from '../config';
import { pool } from '../db';

export type DependencyName = 'database' | 'sqs_phase1' | 'sqs_phase2';
export type DependencyState = 'ok' | 'down';

export interface DependencyHealth {
  status: DependencyState;
  latency_ms: number;
}

export type DependencyCheck = () => Promise<void>;

export interface HealthChecks {
  database: DependencyCheck;
  sqs_phase1: DependencyCheck;
  sqs_phase2: DependencyCheck;
}

export interface HealthCheckOptions {
  databasePool?: Pool;
  sqsClient?: SQSClient;
  phase1QueueUrl?: string;
  phase2QueueUrl?: string;
}

const defaultSqsClient = new SQSClient({
  region: config.AWS_REGION,
  endpoint: config.LOCALSTACK_ENDPOINT,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

export function createHealthChecks(options: HealthCheckOptions = {}): HealthChecks {
  const databasePool = options.databasePool ?? pool;
  const sqsClient = options.sqsClient ?? defaultSqsClient;
  const phase1QueueUrl = options.phase1QueueUrl ?? config.SQS_PHASE1_QUEUE_URL;
  const phase2QueueUrl = options.phase2QueueUrl ?? config.SQS_PHASE2_QUEUE_URL;

  return {
    async database() {
      const result = await databasePool.query('SELECT 1');
      if (result.rowCount !== 1) {
        throw new Error('database_check_failed');
      }
    },
    async sqs_phase1() {
      await checkSqsQueue(sqsClient, phase1QueueUrl);
    },
    async sqs_phase2() {
      await checkSqsQueue(sqsClient, phase2QueueUrl);
    },
  };
}

async function checkSqsQueue(sqsClient: SQSClient, queueUrl: string): Promise<void> {
  await sqsClient.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn'],
    }),
  );
}

