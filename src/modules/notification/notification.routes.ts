import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { NotificationController } from './notification.controller';
import { NotificationValidation } from './notification.validation';

const router = Router();

// GET /api/notifications
router
  .route('/')
  .post(
    auth(),
    validateRequest(NotificationValidation.createNotification),
    NotificationController.createNotification
  )
  .get(
    auth(),
    validateRequest(NotificationValidation.getAllNotifications),
    NotificationController.getAllNotifications
  );

// GET /api/notifications/:id
router
  .route('/:id')
  .get(
    auth(),
    validateRequest(NotificationValidation.getNotificationById),
    NotificationController.getNotificationById
  )
  .delete(
    auth(),
    validateRequest(NotificationValidation.deleteNotification),
    NotificationController.deleteNotification
  );

// PATCH /api/notifications/:id/read
router.patch(
  '/:id/read',
  auth(),
  validateRequest(NotificationValidation.markAsRead),
  NotificationController.markAsRead
);

export const NotificationRoutes: Router = router;
