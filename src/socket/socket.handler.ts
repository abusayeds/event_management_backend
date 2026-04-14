import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import config from '../config';
import { IDecodedToken } from '../interfaces/token.interface';
import { ROOMS } from './constants';
import { chatHandler } from './handlers/chat.handler';
import { notificationHandler } from './handlers/notification.handler';
import { SOCKET_ERRORS, SOCKET_EVENTS } from './socket.events';

export interface AuthenticatedSocket extends Socket {
  user?: IDecodedToken;
  userId?: string;
}

export const socketHandler = (socket: AuthenticatedSocket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle authentication
  socket.on(SOCKET_EVENTS.AUTHENTICATE, async (token: string) => {
    try {
      if (!token) {
        socket.emit(SOCKET_EVENTS.AUTH_ERROR, { error: SOCKET_ERRORS.AUTHENTICATION_FAILED });
        return;
      }

      const decoded = jwt.verify(token, config.jwt.accessSecret) as IDecodedToken;
      socket.user = decoded;
      socket.userId = decoded.userId;

      // Join user-specific rooms
      socket.join(`${ROOMS.USER_PREFIX}${decoded.userId}`);
      socket.join(ROOMS.NOTIFICATIONS);

      // Emit success
      socket.emit(SOCKET_EVENTS.AUTH_SUCCESS, { user: decoded });

      // Broadcast user online status
      socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, {
        userId: decoded.userId,
        email: decoded.email,
      });

      console.log(`Socket authenticated: ${socket.id} for user: ${decoded.userId}`);

      // Register event handlers
      chatHandler(socket);
      notificationHandler(socket);

    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit(SOCKET_EVENTS.AUTH_ERROR, { error: SOCKET_ERRORS.AUTHENTICATION_FAILED });
    }
  });

  // Handle disconnection
  socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);

    if (socket.user) {
      // Broadcast user offline status
      socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, {
        userId: socket.user.userId,
        email: socket.user.email,
      });
    }
  });

  // Handle errors
  socket.on(SOCKET_EVENTS.ERROR, (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });

  // Handle room joining
  socket.on(SOCKET_EVENTS.JOIN_ROOM, (roomId: string) => {
    if (!socket.user) {
      socket.emit(SOCKET_EVENTS.ERROR, { error: SOCKET_ERRORS.AUTHENTICATION_FAILED });
      return;
    }

    socket.join(roomId);
    socket.emit(SOCKET_EVENTS.SYSTEM_MESSAGE, { message: `Joined room: ${roomId}` });
  });

  // Handle room leaving
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, (roomId: string) => {
    if (!socket.user) {
      socket.emit(SOCKET_EVENTS.ERROR, { error: SOCKET_ERRORS.AUTHENTICATION_FAILED });
      return;
    }

    socket.leave(roomId);
    socket.emit(SOCKET_EVENTS.SYSTEM_MESSAGE, { message: `Left room: ${roomId}` });
  });
};
