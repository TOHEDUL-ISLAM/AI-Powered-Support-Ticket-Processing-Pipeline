// US-2.1: SQS queue consumer contracts — separated from implementation for clean dependency inversion
export interface QueueMessage {
  messageId?: string;
  receiptHandle: string;
  body: string;
}

export interface ReceiveOptions {
  maxMessages: number;
  waitSeconds: number;
  visibilityTimeout: number;
}

export interface ISqsQueueConsumer {
  receive(options: ReceiveOptions): Promise<QueueMessage[]>;
  delete(receiptHandle: string): Promise<void>;
  changeVisibility(receiptHandle: string, visibilityTimeoutSeconds: number): Promise<void>;
}
