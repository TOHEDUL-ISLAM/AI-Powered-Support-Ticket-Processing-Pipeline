// US-6.1 + US-6.2: integration tests for Socket.io room subscriptions and live update fanout
import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import pino from 'pino';
import { Server as SocketServer } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  registerRealtimeHandlers,
  SocketNotificationService,
  TICKET_UPDATE_EVENT,
  type TicketUpdatePayload,
} from '../../src/realtime';

const logger = pino({ level: 'silent' });

let httpServer: HttpServer;
let ioServer: SocketServer;
let baseUrl: string;
const clients: ClientSocket[] = [];

beforeEach(async () => {
  httpServer = createServer();
  ioServer = new SocketServer(httpServer, { cors: { origin: '*' } });
  registerRealtimeHandlers(ioServer, logger);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }

  await new Promise<void>((resolve) => {
    ioServer.close(() => resolve());
  });

  if (httpServer.listening) {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
});

describe('realtime subscriptions', () => {
  it('delivers a ticket update only to the subscribed ticket room', async () => {
    const ticketA = await connectClient();
    const ticketB = await connectClient();
    const receivedA: TicketUpdatePayload[] = [];
    const receivedB: TicketUpdatePayload[] = [];

    ticketA.on(TICKET_UPDATE_EVENT, (payload: TicketUpdatePayload) => receivedA.push(payload));
    ticketB.on(TICKET_UPDATE_EVENT, (payload: TicketUpdatePayload) => receivedB.push(payload));

    await expect(subscribe(ticketA, 'subscribe:ticket', { ticketId: 'ticket-a' })).resolves.toEqual({
      ok: true,
      room: 'ticket:ticket-a',
    });
    await expect(subscribe(ticketB, 'subscribe:ticket', { ticketId: 'ticket-b' })).resolves.toEqual({
      ok: true,
      room: 'ticket:ticket-b',
    });

    const notifier = new SocketNotificationService(ioServer, logger);
    notifier.publishTicketUpdate(makeStepStartedPayload('ticket-a', 'tenant-a'));

    await waitFor(() => receivedA.length === 1);
    await sleep(50);

    expect(receivedA[0]).toMatchObject({
      type: 'step_started',
      ticketId: 'ticket-a',
      tenantId: 'tenant-a',
    });
    expect(receivedB).toEqual([]);
  });

  it('delivers tenant updates for all tickets under that tenant', async () => {
    const tenantClient = await connectClient();
    const otherTenantClient = await connectClient();
    const tenantUpdates: TicketUpdatePayload[] = [];
    const otherTenantUpdates: TicketUpdatePayload[] = [];

    tenantClient.on(TICKET_UPDATE_EVENT, (payload: TicketUpdatePayload) => tenantUpdates.push(payload));
    otherTenantClient.on(TICKET_UPDATE_EVENT, (payload: TicketUpdatePayload) => {
      otherTenantUpdates.push(payload);
    });

    await subscribe(tenantClient, 'subscribe:tenant', { tenantId: 'tenant-a' });
    await subscribe(otherTenantClient, 'subscribe:tenant', { tenantId: 'tenant-b' });

    const notifier = new SocketNotificationService(ioServer, logger);
    notifier.publishTicketUpdate(makeStepStartedPayload('ticket-a', 'tenant-a'));
    notifier.publishTicketUpdate(makeStepStartedPayload('ticket-b', 'tenant-a'));

    await waitFor(() => tenantUpdates.length === 2);
    await sleep(50);

    expect(tenantUpdates.map((payload) => payload.ticketId)).toEqual(['ticket-a', 'ticket-b']);
    expect(otherTenantUpdates).toEqual([]);
  });

  it('returns ack errors for invalid subscription payloads', async () => {
    const client = await connectClient();

    await expect(subscribe(client, 'subscribe:ticket', {})).resolves.toEqual({
      ok: false,
      error: 'ticket_id_required',
    });
    await expect(subscribe(client, 'subscribe:tenant', { tenantId: '' })).resolves.toEqual({
      ok: false,
      error: 'tenant_id_required',
    });
  });
});

function makeStepStartedPayload(ticketId: string, tenantId: string): TicketUpdatePayload {
  return {
    type: 'step_started',
    ticketId,
    tenantId,
    step: 'triage',
    attempt: 1,
    occurredAt: new Date().toISOString(),
  };
}

async function connectClient(): Promise<ClientSocket> {
  const client = createClient(baseUrl, { forceNew: true, transports: ['websocket'] });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });
  return client;
}

function subscribe(
  client: ClientSocket,
  event: 'subscribe:ticket' | 'subscribe:tenant',
  payload: object,
): Promise<unknown> {
  return new Promise((resolve) => {
    client.emit(event, payload, resolve);
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await sleep(10);
  }

  throw new Error('condition not met before timeout');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
