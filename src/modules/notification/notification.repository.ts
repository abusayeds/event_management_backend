import { database } from '../../config/database';
import {
    createPaginationQuery,
    createPaginationResult,
    PaginationOptions,
    PaginationResult,
    parsePaginationOptions,
} from '../../utils/paginate';
import { ICreateNotificationPayload, INotificationFilters } from './notification.interface';

// Notification list select
const notificationListSelect = {
  id: true,
  title: true,
  message: true,
  type: true,
  status: true,
  priority: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
};

// Create Notification
const createNotification = async (notificationData: ICreateNotificationPayload) => {
  return database.notification.create({
    data: notificationData,
    select: notificationListSelect,
  });
};

// Get Notification by ID
const getNotificationById = async (id: string) => {
  return database.notification.findFirst({
    where: { id },
    select: notificationListSelect,
  });
};

// Get All Notifications with Filters + Pagination
const getAllNotifications = async (
  filters: INotificationFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: any = {};

  // Search filter
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { message: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.read !== undefined) {
    where.read = filters.read;
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }
  if (filters.userId) {
    where.userId = filters.userId;
  }

  const [notifications, total] = await Promise.all([
    database.notification.findMany({
      where,
      select: notificationListSelect,
      skip,
      take,
      orderBy,
    }),
    database.notification.count({ where }),
  ]);

  return createPaginationResult(notifications, total, pagination);
};

// Mark as Read
const markAsRead = async (id: string) => {
  return database.notification.update({
    where: { id },
    data: { read: true },
    select: notificationListSelect,
  });
};

// Delete Notification
const deleteNotificationById = async (id: string) => {
  return database.notification.delete({
    where: { id },
  });
};

// Notification Exists Check
const isNotificationExists = async (id: string): Promise<boolean> => {
  const notification = await database.notification.findUnique({
    where: { id },
    select: { id: true },
  });
  return !!notification;
};

export const NotificationRepository = {
  createNotification,
  getNotificationById,
  getAllNotifications,
  markAsRead,
  deleteNotificationById,
  isNotificationExists,
};
