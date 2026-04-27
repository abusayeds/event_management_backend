import { NotificationMedium, Prisma } from '../../../prisma/generated/client';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import { ICreateNotificationPayload, INotificationFilters } from './notification.interface';

export const notificationSelect = {
  id: true,
  recipientId: true,
  senderId: true,
  type: true,
  medium: true,
  title: true,
  message: true,
  image: true,
  linkId: true,
  linkType: true,
  isRead: true,
  readAt: true,
  data: true,
  createdAt: true,
  updatedAt: true,
} as const;

const createNotification = async (payload: ICreateNotificationPayload) => {
  return database.notification.create({
    data: {
      recipientId: payload.recipientId,
      senderId: payload.senderId ?? null,
      type: payload.type,
      medium: payload.medium?.length ? payload.medium : [NotificationMedium.InApp],
      title: payload.title,
      message: payload.message,
      image: payload.image ?? null,
      linkId: payload.linkId ?? null,
      linkType: payload.linkType ?? null,
      data: payload.data as Prisma.InputJsonValue | undefined,
    },
    select: notificationSelect,
  });
};

const getById = async (id: string) => {
  return database.notification.findUnique({
    where: { id },
    select: notificationSelect,
  });
};

const getByUser = async (
  userId: string,
  filters: INotificationFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where: Prisma.NotificationWhereInput = { recipientId: userId };
  if (filters.isRead !== undefined) where.isRead = filters.isRead;
  if (filters.type) where.type = filters.type;

  const [data, total] = await Promise.all([
    database.notification.findMany({
      where,
      select: notificationSelect,
      skip,
      take,
      orderBy,
    }),
    database.notification.count({ where }),
  ]);

  return createPaginationResult(data, total, pagination);
};

const markAsRead = async (id: string) => {
  return database.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
    select: notificationSelect,
  });
};

const markAllAsRead = async (userId: string) => {
  return database.notification.updateMany({
    where: { recipientId: userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
};

const getUnreadCount = async (userId: string) => {
  return database.notification.count({
    where: {
      recipientId: userId,
      isRead: false,
    },
  });
};

export const NotificationRepository = {
  createNotification,
  getById,
  getByUser,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
