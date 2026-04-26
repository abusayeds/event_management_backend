import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { EventController } from './event.controller';
import { EventValidation } from './event.validation';

const router = Router();

// Curated feeds
router.get(
  '/feed/active',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.getActiveEvents
);

router.get(
  '/feed/upcoming',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.getUpcomingEvents
);

router.get(
  '/feed/today',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.getTodayEvents
);

router.get(
  '/feed/history',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.getHistoryEvents
);

router
  .route('/')
  .post(
    auth(UserRole.ADMIN, UserRole.USER),
    upload.single('coverImage'),
    validateRequest(EventValidation.createEvent),
    EventController.createEvent
  )
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidation.getEvents),
    EventController.getEvents
  );

router.post(
  '/:eventId/verify',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.verifyEvent),
  EventController.verifyEvent
);

router
  .route('/:eventId')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidation.getEventById),
    EventController.getEventById
  )
  .patch(
    auth(UserRole.ADMIN, UserRole.USER),
    upload.single('coverImage'),
    validateRequest(EventValidation.updateEvent),
    EventController.updateEvent
  )
  .delete(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidation.deleteEvent),
    EventController.deleteEvent
);

export const EventRoutes: Router = router;
