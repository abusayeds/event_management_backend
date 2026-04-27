import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { NotificationService } from './notification.service';

const createNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user?.userId;
  const result = await NotificationService.createNotification({
    ...req.body,
    senderId,
  });
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Notification sent successfully.',
    data: result,
  });
});

const getMyNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const filters = pick(req.query, ['isRead', 'type']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const { markAllRead } = pick(req.query, ['markAllRead']) as { markAllRead?: boolean };
  const result = await NotificationService.getMyNotifications(userId, filters, options, markAllRead);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notifications fetched successfully.',
    data: {
      items: result.data,
      unreadCount: result.unreadCount,
    },
    meta: result.meta,
  });
});

const markRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await NotificationService.markNotificationRead(userId, req.params.id as string);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Notification marked as read.',
    data: result,
  });
});

const markAllRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await NotificationService.markAllRead(userId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'All notifications marked as read.',
    data: result,
  });
});

const saveMyFcmToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await NotificationService.saveMyFcmToken(userId, req.body.fcmToken);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'FCM token saved successfully.',
    data: result,
  });
});

const clearMyFcmToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await NotificationService.clearMyFcmToken(userId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'FCM token cleared successfully.',
    data: result,
  });
});

export const NotificationController = {
  createNotification,
  getMyNotifications,
  markRead,
  markAllRead,
  saveMyFcmToken,
  clearMyFcmToken,
};
