import { NotificationMedium } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import logger from '../../config/logger';
import { getSocketIO } from '../../socket';
import { ROOMS } from '../../socket/constants';
import { SOCKET_EVENTS } from '../../socket/socket.events';
import { sendFcmPush } from '../../utils/fcm';
import { NotificationJobPayload } from '../queues/notification.queue';

export const processNotification = async (job: { data: NotificationJobPayload }) => {
  const { notificationId } = job.data;
  const notification = await database.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    logger.warn(`Notification job skipped, notification not found: ${notificationId}`);
    return;
  }

  try {
    const io = getSocketIO();
    const room = `${ROOMS.USER_PREFIX}${notification.recipientId}`;
    io.to(room).emit(SOCKET_EVENTS.NOTIFICATION, notification);
    const unreadCount = await database.notification.count({
      where: { recipientId: notification.recipientId, isRead: false },
    });
    io.to(room).emit(SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT, { unreadCount });
  } catch {
    logger.warn('Socket server is not initialized, skipping realtime notification emit.');
  }

  if (notification.medium.includes(NotificationMedium.Push)) {
    const user = await database.user.findUnique({
      where: { id: notification.recipientId },
      select: { id: true, fcmToken: true },
    });

    if (user?.fcmToken) {
      const pushResult = await sendFcmPush({
        token: user.fcmToken,
        title: notification.title,
        body: notification.message,
        image: notification.image,
        data: {
          notificationId: notification.id,
          type: String(notification.type),
          linkId: notification.linkId ?? '',
          linkType: notification.linkType ?? '',
        },
      });

      if (!pushResult.success) {
        logger.warn(`Push send failed for notification ${notification.id}`);
      }

      if (pushResult.invalidToken) {
        await database.user.update({
          where: { id: user.id },
          data: { fcmToken: null },
        });
        logger.info(`Invalid FCM token cleared for user ${user.id}`);
      }
    } else {
      logger.info(`Push skipped for notification ${notification.id}: no FCM token.`);
    }
  }
};
