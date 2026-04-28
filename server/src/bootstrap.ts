// US-2.1 + US-2.2 + US-2.3 + US-3.1 + US-4.4 + US-5.2: runtime dependency wiring for workers, AI gateway, and notifications
import { SQSClient } from '@aws-sdk/client-sqs';
import { PortkeyAiGateway, type IAiGateway } from './ai';
import { config } from './config';
import { createLogger, type Logger } from './logger';
import { SqsQueueConsumer } from './queue/sqs.consumer';
import { TicketQueue } from './queue/ticket.queue';
import type { INotificationService } from './realtime';
import { ResolutionRepository } from './repositories/resolution.repository';
import { TicketRepository } from './repositories/ticket.repository';
import { TriageRepository } from './repositories/triage.repository';
import { ResolutionStepService } from './services/resolution-step.service';
import { TicketService } from './services/ticket.service';
import { TriageStepService } from './services/triage-step.service';
import { Phase1Worker } from './workers/phase1.worker';
import { Phase2Worker } from './workers/phase2.worker';

export function createSqsClient(): SQSClient {
  return new SQSClient({
    region: config.AWS_REGION,
    endpoint: config.LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export function createAiGateway(): IAiGateway {
  return new PortkeyAiGateway();
}

export function createPhase1Worker(
  logger: Logger = createLogger(),
  aiGateway: IAiGateway = createAiGateway(),
  notifier: INotificationService,
): Phase1Worker {
  const sqsClient = createSqsClient();
  const consumer = new SqsQueueConsumer(sqsClient, config.SQS_PHASE1_QUEUE_URL);
  const phase2Queue = new TicketQueue(sqsClient, config.SQS_PHASE2_QUEUE_URL);
  const triageRepository = new TriageRepository();
  const ticketRepository = new TicketRepository();
  const phase1Queue = new TicketQueue(createSqsClient(), config.SQS_PHASE1_QUEUE_URL);
  const phase2QueueForReader = new TicketQueue(createSqsClient(), config.SQS_PHASE2_QUEUE_URL);
  const ticketStatusReader = new TicketService(ticketRepository, phase1Queue, phase2QueueForReader, logger);
  const service = new TriageStepService(triageRepository, phase2Queue, aiGateway, notifier, ticketStatusReader, logger);

  return new Phase1Worker(consumer, service, logger);
}

export function createPhase2Worker(
  logger: Logger = createLogger(),
  aiGateway: IAiGateway = createAiGateway(),
  notifier: INotificationService,
): Phase2Worker {
  const sqsClient = createSqsClient();
  const consumer = new SqsQueueConsumer(sqsClient, config.SQS_PHASE2_QUEUE_URL);
  const repository = new ResolutionRepository();
  const phase1Queue = new TicketQueue(createSqsClient(), config.SQS_PHASE1_QUEUE_URL);
  const phase2Queue = new TicketQueue(createSqsClient(), config.SQS_PHASE2_QUEUE_URL);
  const ticketRepository = new TicketRepository();
  const ticketStatusReader = new TicketService(ticketRepository, phase1Queue, phase2Queue, logger);
  const service = new ResolutionStepService(repository, aiGateway, notifier, ticketStatusReader, logger);

  return new Phase2Worker(consumer, service, logger);
}
