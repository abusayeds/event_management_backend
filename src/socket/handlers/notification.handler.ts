import { Socket } from 'socket.io';
import logger from '../../config/logger';
import { SOCKET_EVENTS } from '../socket.events';
import { AuthenticatedSocket } from '../socket.handler';

interface NotificationData {
  id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// In-memory storage for demo (in production, use database)
const userNotifications: Map<string, NotificationData[]> = new Map();

export const notificationHandler = (socket: AuthenticatedSocket) => {
  // Send notification to specific user
  socket.on('send_notification', (data: {
    userId: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    title: string;
    message: string;
  }) => {
    if (!socket.user) {
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Authentication required' });
      return;
    }

    const notification: NotificationData = {
      id: Date.now().toString(),
      type: data.type,
      title: data.title,
      message: data.message,
      timestamp: new Date(),
      read: false,
    };

    // Store notification
    if (!userNotifications.has(data.userId)) {
      userNotifications.set(data.userId, []);
    }
    userNotifications.get(data.userId)!.push(notification);

    // Send to specific user
    socket.to(`user_${data.userId}`).emit(SOCKET_EVENTS.NOTIFICATION, notification);

    logger.info('Notification sent', { targetUserId: data.userId, title: data.title });
  });

  // Mark notification as read
  socket.on(SOCKET_EVENTS.NOTIFICATION_READ, (notificationId: string) => {
    if (!socket.user) return;

    const notifications = userNotifications.get(socket.user.userId) || [];
    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.read = true;
      socket.emit(SOCKET_EVENTS.NOTIFICATION_READ, { notificationId });
      logger.info('Notification marked as read', { notificationId, userId: socket.user.userId });
    }
  });

  // Get user notifications
  socket.on('get_notifications', () => {
    if (!socket.user) return;

    const notifications = userNotifications.get(socket.user.userId) || [];
    socket.emit('notifications_list', notifications);
  });

  // Clear all notifications
  socket.on('clear_notifications', () => {
    if (!socket.user) return;

    userNotifications.set(socket.user.userId, []);
    socket.emit('notifications_cleared', { timestamp: new Date() });
    logger.info('All notifications cleared', { userId: socket.user.userId });
  });

  // Broadcast system notification
  socket.on('broadcast_notification', (data: {
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    title: string;
    message: string;
  }) => {
    if (!socket.user) {
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Authentication required' });
      return;
    }

    const notification: NotificationData = {
      id: Date.now().toString(),
      type: data.type,
      title: data.title,
      message: data.message,
      timestamp: new Date(),
      read: false,
    };

    // Broadcast to all connected users
    socket.broadcast.emit(SOCKET_EVENTS.NOTIFICATION, notification);

    logger.info('System notification broadcasted', { title: data.title });
  });
};
