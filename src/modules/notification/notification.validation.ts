import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().min(1, 'Notification id is required'),
});

const createNotification = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
    message: z.string().min(1, 'Message is required').max(1000, 'Message is too long'),
    type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    userId: z.string().optional(),
  }),
});

const getAllNotifications = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).optional(),
    status: z.enum(['READ', 'UNREAD']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    userId: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
  cookies: z.object({}).optional(),
});

const getNotificationById = z.object({
  body: z.object({}).optional(),
  params: idParamSchema,
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const markAsRead = z.object({
  body: z.object({}).optional(),
  params: idParamSchema,
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

const deleteNotification = z.object({
  body: z.object({}).optional(),
  params: idParamSchema,
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});

export const NotificationValidation = {
  createNotification,
  getAllNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification,
};
