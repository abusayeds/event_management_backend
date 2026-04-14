import { StatusCodes } from 'http-status-codes';
import { PaginationOptions } from '../../interfaces/pagination.interface';
import ApiError from '../../utils/apiError';
import { ICreateNotificationPayload, INotificationFilters } from './notification.interface';
import { NotificationRepository } from './notification.repository';

// Create Notification
const createNotification = async (payload: ICreateNotificationPayload, actorId: string) => {
  const notification = await NotificationRepository.createNotification({
    ...payload,
    read: false,
    priority: payload.priority || 'MEDIUM',
  });

  return notification;
};

// Get All Notifications
const getAllNotifications = async (
  actorId: string,
  filters: INotificationFilters,
  options: PaginationOptions
) => {
  // If not admin, only show notifications for the current user
  if (filters.userId && filters.userId !== actorId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only view your own notifications');
  }
  
  // Set userId to current user if not specified
  if (!filters.userId) {
    filters.userId = actorId;
  }

  return NotificationRepository.getAllNotifications(filters, options);
};

// Get Single Notification
const getNotificationById = async (id: string) => {
  const notification = await NotificationRepository.getNotificationById(id);
  if (!notification) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found.');
  }
  return notification;
};

// Mark as Read
const markAsRead = async (id: string, actorId: string) => {
  // Notification existence check
  const existing = await NotificationRepository.isNotificationExists(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found.');
  }

  const updated = await NotificationRepository.markAsRead(id);
  return updated;
};

// Delete Notification
const deleteNotification = async (id: string, actorId: string) => {
  // Notification existence check
  const existing = await NotificationRepository.isNotificationExists(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found.');
  }

  await NotificationRepository.deleteNotificationById(id);
};

export const NotificationService = {
  createNotification,
  getNotificationById,
  getAllNotifications,
  markAsRead,
  deleteNotification,
};
