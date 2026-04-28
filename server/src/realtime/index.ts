// US-6.1 + US-6.2 + US-6.3: Socket.io room management and live ticket updates
import type { Server, Socket } from 'socket.io';
import type { Logger } from '../logger';
import type { TicketStatusResponse } from '../services/ticket.service';

export const TICKET_UPDATE_EVENT = 'ticket:update';

export type PipelineStep = 'triage' | 'resolution';

export interface BaseTicketUpdatePayload {
  ticketId: string;
  tenantId: string;
  occurredAt: string;
}

export interface StepStartedPayload extends BaseTicketUpdatePayload {
  type: 'step_started';
  step: PipelineStep;
  attempt: number;
  status?: string;
}

export interface StepCompletedPayload extends BaseTicketUpdatePayload {
  type: 'step_completed';
  step: PipelineStep;
  attempt: number;
  providerUsed: string;
  fallback: boolean;
}

export interface StepFailedPayload extends BaseTicketUpdatePayload {
  type: 'step_failed';
  step: PipelineStep;
  attempt: number;
  reason: 'step_attempt_failed';
}

export interface PipelineCompletedPayload extends BaseTicketUpdatePayload {
  type: 'pipeline_completed';
  data: TicketStatusResponse;
}

export interface TicketFailedPayload extends BaseTicketUpdatePayload {
  type: 'ticket_failed';
  failedStep: PipelineStep;
  reason: 'max_attempts_reached';
  data: TicketStatusResponse;
}

export type TicketUpdatePayload =
  | StepStartedPayload
  | StepCompletedPayload
  | StepFailedPayload
  | PipelineCompletedPayload
  | TicketFailedPayload;

type SubscriptionAck = { ok: true; room: string } | { ok: false; error: string };
type SubscriptionAckCallback = (ack: SubscriptionAck) => void;

export interface INotificationService {
  publishTicketUpdate(payload: TicketUpdatePayload): void;
}

export class SocketNotificationService implements INotificationService {
  constructor(
    private readonly io: Server,
    private readonly logger: Logger,
  ) {}

  publishTicketUpdate(payload: TicketUpdatePayload): void {
    try {
      const rooms = [ticketRoom(payload.ticketId), tenantRoom(payload.tenantId)];
      this.io.to(rooms[0]).to(rooms[1]).emit(TICKET_UPDATE_EVENT, payload);
      this.logger.info({
        event: 'socket.update.published',
        type: payload.type,
        ticketId: payload.ticketId,
        tenantId: payload.tenantId,
        rooms,
      });
    } catch (err) {
      this.logger.error({
        event: 'socket.update.publish_failed',
        type: payload.type,
        ticketId: payload.ticketId,
        tenantId: payload.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function registerRealtimeHandlers(io: Server, logger: Logger): void {
  io.on('connection', (socket) => {
    logger.info({ event: 'socket.connected', socketId: socket.id });

    socket.on('subscribe:ticket', (payload: unknown, ack?: SubscriptionAckCallback) => {
      subscribeToRoom(socket, logger, ticketSubscriptionRoom(payload), ack);
    });

    socket.on('subscribe:tenant', (payload: unknown, ack?: SubscriptionAckCallback) => {
      subscribeToRoom(socket, logger, tenantSubscriptionRoom(payload), ack);
    });

    socket.on('disconnect', (reason) => {
      logger.info({ event: 'socket.disconnected', socketId: socket.id, reason });
    });
  });
}

export function ticketRoom(ticketId: string): string {
  return `ticket:${ticketId}`;
}

export function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

function subscribeToRoom(
  socket: Socket,
  logger: Logger,
  result: { ok: true; room: string } | { ok: false; error: string },
  ack?: SubscriptionAckCallback,
): void {
  if (!result.ok) {
    ack?.({ ok: false, error: result.error });
    logger.warn({ event: 'socket.subscription.rejected', socketId: socket.id, error: result.error });
    return;
  }

  socket.join(result.room);
  ack?.({ ok: true, room: result.room });
  logger.info({ event: 'socket.subscribed', socketId: socket.id, room: result.room });
}

function ticketSubscriptionRoom(payload: unknown): { ok: true; room: string } | { ok: false; error: string } {
  if (!isObject(payload) || !isNonEmptyString(payload.ticketId)) {
    return { ok: false, error: 'ticket_id_required' };
  }

  return { ok: true, room: ticketRoom(payload.ticketId) };
}

function tenantSubscriptionRoom(payload: unknown): { ok: true; room: string } | { ok: false; error: string } {
  if (!isObject(payload) || !isNonEmptyString(payload.tenantId)) {
    return { ok: false, error: 'tenant_id_required' };
  }

  return { ok: true, room: tenantRoom(payload.tenantId) };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
