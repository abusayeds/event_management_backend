import { z } from 'zod';
import { NotificationMedium, NotificationType } from '../../../prisma/generated/enums';

const createNotification = z.object({
  body: z.object({
    recipientId: z.string().uuid(),
    type: z.nativeEnum(NotificationType),
    medium: z.array(z.nativeEnum(NotificationMedium)).optional(),
    title: z.string().trim().min(1).max(150),
    message: z.string().trim().min(1).max(1000),
    image: z.string().url().optional(),
    linkId: z.string().trim().optional(),
    linkType: z.string().trim().optional(),
    data: z.any().optional(),
  }),
});

const getMyNotifications = z.object({
  query: z.object({
    isRead: z.coerce.boolean().optional(),
    type: z.nativeEnum(NotificationType).optional(),
    markAllRead: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const markRead = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const markAllRead = z.object({
  query: z.object({}).optional(),
});

const saveMyFcmToken = z.object({
  body: z.object({
    fcmToken: z.string().trim().min(10),
  }),
});

const clearMyFcmToken = z.object({
  query: z.object({}).optional(),
});

export const NotificationValidation = {
  createNotification,
  getMyNotifications,
  markRead,
  markAllRead,
  saveMyFcmToken,
  clearMyFcmToken,
};
