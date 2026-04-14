import { NotificationJobData } from '../queues/notification.queue';
import { getSocketIO } from '../../socket';

export const sendNotificationProcessor = async (data: NotificationJobData): Promise<void> => {
  const { userId, type, title, message, data: notificationData, channels } = data;
  
  try {
    // Send via WebSocket if user is connected
    const io = getSocketIO();
    const userSocket = io.sockets.sockets.get(`user_${userId}`);
    
    if (userSocket) {
      userSocket.emit('notification', {
        id: Date.now().toString(),
        type,
        title,
        message,
        data: notificationData,
        timestamp: new Date(),
        read: false,
      });
      
      console.log(`Notification sent via WebSocket to user ${userId}`);
    }
    
    // Send via other channels if specified
    if (channels) {
      for (const channel of channels) {
        io.to(channel).emit('notification', {
          id: Date.now().toString(),
          type,
          title,
          message,
          data: notificationData,
          timestamp: new Date(),
          read: false,
        });
        
        console.log(`Notification sent via channel ${channel}`);
      }
    }
    
    // Store notification in database (in production)
    // await NotificationService.createNotification({
    //   userId,
    //   type,
    //   title,
    //   message,
    //   data: notificationData,
    // });
    
    console.log(`Notification processed for user ${userId}: ${title}`);
  } catch (error) {
    console.error('Failed to send notification:', error);
    throw error;
  }
};
