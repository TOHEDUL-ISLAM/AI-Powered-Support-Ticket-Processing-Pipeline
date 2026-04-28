// US-6.1: manual Socket.io client for ticket and tenant live update demos
const { io } = require('socket.io-client');

const [, , mode, id, rawUrl] = process.argv;
const url = rawUrl || 'http://localhost:3000';

if (!['ticket', 'tenant'].includes(mode) || !id) {
  console.error('Usage: node scripts/socket-client.js <ticket|tenant> <id> [url]');
  process.exit(1);
}

const socket = io(url, { transports: ['websocket'] });
const eventName = mode === 'ticket' ? 'subscribe:ticket' : 'subscribe:tenant';
const payload = mode === 'ticket' ? { ticketId: id } : { tenantId: id };

socket.on('connect', () => {
  console.log(`connected ${socket.id}`);
  socket.emit(eventName, payload, (ack) => {
    console.log('subscription', JSON.stringify(ack));
  });
});

socket.on('ticket:update', (update) => {
  console.log(JSON.stringify(update, null, 2));
});

socket.on('connect_error', (err) => {
  console.error(`connect_error: ${err.message}`);
});

socket.on('disconnect', (reason) => {
  console.log(`disconnected: ${reason}`);
});
