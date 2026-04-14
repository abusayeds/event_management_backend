import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import config from '../config';
import { chatHandler } from './handlers/chat.handler';
import { notificationHandler } from './handlers/notification.handler';
import { socketHandler } from './socket.handler';

let io: SocketIOServer;

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: config.socket.cors,
    transports: config.socket.transports as any,
    pingTimeout: config.socket.pingTimeout,
    pingInterval: config.socket.pingInterval,
    maxHttpBufferSize: config.socket.maxHttpBufferSize,
    allowEIO3: config.socket.allowEIO3,
  });

  // Socket connection handler
  io.on('connection', socketHandler);

  console.log('Socket.IO server initialized');
  return io;
};

export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

// Export handlers for use in other modules
export { chatHandler, notificationHandler };
