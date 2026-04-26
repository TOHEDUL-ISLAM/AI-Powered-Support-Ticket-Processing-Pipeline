// US-1.7: health dependency checks for database and SQS reachability
import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { Pool } from 'pg';

export interface IHealthRepository {
  checkDatabase(): Promise<void>;
  checkSqsPhase1(): Promise<void>;
  checkSqsPhase2(): Promise<void>;
}

export class HealthRepository implements IHealthRepository {
  constructor(
    private readonly pool: Pool,
    private readonly sqsClient: SQSClient,
    private readonly phase1QueueUrl: string,
    private readonly phase2QueueUrl: string,
  ) {}

  async checkDatabase(): Promise<void> {
    const result = await this.pool.query('SELECT 1');
    if (result.rowCount !== 1) {
      throw new Error('database_check_failed');
    }
  }

  async checkSqsPhase1(): Promise<void> {
    await this.checkSqsQueue(this.phase1QueueUrl);
  }

  async checkSqsPhase2(): Promise<void> {
    await this.checkSqsQueue(this.phase2QueueUrl);
  }

  private async checkSqsQueue(queueUrl: string): Promise<void> {
    await this.sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['QueueArn'],
      }),
    );
  }
}
