// US-2.1: SQS consumer adapter for worker polling and message deletion
import { ChangeMessageVisibilityCommand, DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { ISqsQueueConsumer, QueueMessage, ReceiveOptions } from './types';

export class SqsQueueConsumer implements ISqsQueueConsumer {
  constructor(
    private readonly sqsClient: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async receive(options: ReceiveOptions): Promise<QueueMessage[]> {
    const response = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: options.maxMessages,
        WaitTimeSeconds: options.waitSeconds,
        VisibilityTimeout: options.visibilityTimeout,
      }),
    );

    return (response.Messages ?? [])
      .filter((message) => message.ReceiptHandle !== undefined)
      .map((message) => ({
        messageId: message.MessageId,
        receiptHandle: message.ReceiptHandle as string,
        body: message.Body ?? '',
      }));
  }

  async delete(receiptHandle: string): Promise<void> {
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }

  async changeVisibility(receiptHandle: string, visibilityTimeoutSeconds: number): Promise<void> {
    await this.sqsClient.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: visibilityTimeoutSeconds,
      }),
    );
  }
}
