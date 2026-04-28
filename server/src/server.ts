// US-1.7 + US-2.1 + US-2.2 + US-6.1 + US-7.1: HTTP entry point, Socket.io setup, structured logging, and worker startup
import { Server } from 'socket.io';
import { config } from './config';
import { createAiGateway, createPhase1Worker, createPhase2Worker } from './bootstrap';
import { createApp } from './app';
import { pool } from './db';
import { createLogger } from './logger';
import { registerRealtimeHandlers, SocketNotificationService } from './realtime';

const logger = createLogger();
const app = createApp();
const aiGateway = createAiGateway();

const server = app.listen(config.PORT, () => {
  logger.info({ event: 'server.started', port: config.PORT });
});

const io = new Server(server, { cors: { origin: '*' } });
registerRealtimeHandlers(io, logger);
const notificationService = new SocketNotificationService(io, logger);

const phase1Worker = createPhase1Worker(logger, aiGateway, notificationService);
const phase2Worker = createPhase2Worker(logger, aiGateway, notificationService);

phase1Worker.start();
phase2Worker.start();

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ event: 'server.shutdown.started', signal });

  try {
    await Promise.all([phase1Worker.stop(), phase2Worker.stop()]);
    await closeHttpServer();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await pool.end();
    logger.info({ event: 'server.shutdown.completed' });
  } catch (err) {
    logger.error({
      event: 'server.shutdown.failed',
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  }
}

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
