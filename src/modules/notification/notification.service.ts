import { StatusCodes } from 'http-status-codes';
import { NotificationMedium, UserRole } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { PaginationOptions } from '../../interfaces';
import { getSocketIO } from '../../socket';
import { ROOMS } from '../../socket/constants';
import { SOCKET_EVENTS } from '../../socket/socket.events';
import ApiError from '../../utils/apiError';
import notificationQueue from '../../jobs/queues/notification.queue';
import {
  ICreateNotificationPayload,
  INotificationFilters,
} from './notification.interface';
import { NotificationRepository } from './notification.repository';

const emitUnreadCount = async (userId: string) => {
  const unreadCount = await NotificationRepository.getUnreadCount(userId);
  try {
    const io = getSocketIO();
    io.to(`${ROOMS.USER_PREFIX}${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_UNREAD_COUNT, { unreadCount });
  } catch {
    // Socket may be disabled in some environments.
  }
  return unreadCount;
};

const createNotification = async (payload: ICreateNotificationPayload) => {
  const created = await NotificationRepository.createNotification(payload);
  await notificationQueue.add(
    'dispatch-notification',
    { notificationId: created.id },
    { jobId: `notification-${created.id}` }
  );
  await emitUnreadCount(created.recipientId);
  return created;
};

const notifyAdmins = async (
  payload: Omit<ICreateNotificationPayload, 'recipientId'>
) => {
  const admins = await database.user.findMany({
    where: { role: UserRole.ADMIN, status: 'ACTIVE' },
    select: { id: true },
  });

  if (admins.length === 0) return [];

  return Promise.all(
    admins.map(admin =>
      createNotification({
        ...payload,
        recipientId: admin.id,
        medium: payload.medium?.length ? payload.medium : [NotificationMedium.InApp],
      })
    )
  );
};

const getMyNotifications = async (
  userId: string,
  filters: INotificationFilters,
  options: PaginationOptions,
  markAllReadOnFetch?: boolean
) => {
  if (markAllReadOnFetch) {
    await NotificationRepository.markAllAsRead(userId);
  }
  const list = await NotificationRepository.getByUser(userId, filters, options);
  const unreadCount = await emitUnreadCount(userId);
  return { ...list, unreadCount };
};

const markNotificationRead = async (userId: string, notificationId: string) => {
  const existing = await NotificationRepository.getById(notificationId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found.');
  }
  if (existing.recipientId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only mark your own notification as read.');
  }
  const notification = await NotificationRepository.markAsRead(notificationId);
  const unreadCount = await emitUnreadCount(userId);
  return { notification, unreadCount };
};

const markAllRead = async (userId: string) => {
  const result = await NotificationRepository.markAllAsRead(userId);
  const unreadCount = await emitUnreadCount(userId);
  return { ...result, unreadCount };
};

const saveMyFcmToken = async (userId: string, fcmToken: string) => {
  return database.user.update({
    where: { id: userId },
    data: { fcmToken },
    select: { id: true, fcmToken: true },
  });
};

const clearMyFcmToken = async (userId: string) => {
  return database.user.update({
    where: { id: userId },
    data: { fcmToken: null },
    select: { id: true, fcmToken: true },
  });
};

export const NotificationService = {
  createNotification,
  notifyAdmins,
  getMyNotifications,
  markNotificationRead,
  markAllRead,
  emitUnreadCount,
  saveMyFcmToken,
  clearMyFcmToken,
};
