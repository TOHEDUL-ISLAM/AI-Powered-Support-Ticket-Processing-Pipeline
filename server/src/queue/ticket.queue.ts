// US-1.5: SQS producer — enqueue ticket ID to phase1 processing queue
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

export interface ITicketQueue {
  enqueue(ticketId: string): Promise<void>;
}

export class TicketQueue implements ITicketQueue {
  constructor(
    private readonly sqsClient: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueue(ticketId: string): Promise<void> {
    await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ ticketId }),
      }),
    );
  }
}
