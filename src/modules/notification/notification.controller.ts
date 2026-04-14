import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import apiResponse from '../../utils/apiResponse';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import { NotificationService } from './notification.service';

// POST /api/notifications
const createNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId: actorId } = req.user!;
  const notification = await NotificationService.createNotification(req.body, actorId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Notification created successfully.',
    data: notification,
  });
});

// GET /api/notifications
const getAllNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId: actorId } = req.user!;
  const filters = pick(req.query, [
    'type',
    'status',
    'priority',
    'userId',
    'search',
  ]);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await NotificationService.getAllNotifications(actorId, filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notifications fetched successfully.',
    data: result,
  });
});

// GET /api/notifications/:id
const getNotificationById = asyncHandler(async (req: Request, res: Response) => {
  const { id: notificationId } = req.params;
  const notification = await NotificationService.getNotificationById(notificationId as string);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notification fetched successfully.',
    data: notification,
  });
});

// PATCH /api/notifications/:id/read
const markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: notificationId } = req.params;
  const { userId: actorId } = req.user!;
  const notification = await NotificationService.markAsRead(notificationId as string, actorId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notification marked as read.',
    data: notification,
  });
});

// DELETE /api/notifications/:id
const deleteNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId: actorId } = req.user!;
  const { id: notificationId } = req.params;
  await NotificationService.deleteNotification(notificationId as string, actorId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notification deleted successfully.',
  });
});

export const NotificationController = {
  createNotification,
  getAllNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification,
};
