import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { NotificationController } from './notification.controller';
import { NotificationValidation } from './notification.validation';

const router = Router();

router.post(
  '/',
  auth(UserRole.ADMIN),
  validateRequest(NotificationValidation.createNotification),
  NotificationController.createNotification
);

router.get(
  '/my',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(NotificationValidation.getMyNotifications),
  NotificationController.getMyNotifications
);

router.patch(
  '/:id/read',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(NotificationValidation.markRead),
  NotificationController.markRead
);

router.patch(
  '/my/read-all',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(NotificationValidation.markAllRead),
  NotificationController.markAllRead
);

router.post(
  '/my/push-token',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(NotificationValidation.saveMyFcmToken),
  NotificationController.saveMyFcmToken
);

router.delete(
  '/my/push-token',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(NotificationValidation.clearMyFcmToken),
  NotificationController.clearMyFcmToken
);

export const NotificationRoutes: Router = router;
