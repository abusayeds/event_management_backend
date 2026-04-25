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
  EventController.listActiveEvents
);

router.get(
  '/feed/upcoming',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.listUpcomingEvents
);

router.get(
  '/feed/today',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.listTodayEvents
);

router.get(
  '/feed/history',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.listHistoryEvents
);

router.get(
  '/feed/calendar/month',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.calendarMonthFeed),
  EventController.getCalendarMonthFeed
);

router.get(
  '/feed/calendar/day',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.calendarDayFeed),
  EventController.getCalendarDayFeed
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
    validateRequest(EventValidation.listEvents),
    EventController.listEvents
  );

// Nested resources (param name matches Prisma: `eventId` on `EventSession`, `EventApplication`, …)
router.get(
  '/:eventId/event-sessions',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listEventSessions),
  EventController.listEventSessions
);

router.post(
  '/:eventId/verify',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.verifyEvent),
  EventController.verifyEvent
);

router.post(
  '/:eventId/apply',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.applyToEvent),
  EventController.applyToEvent
);

router.delete(
  '/:eventId/apply',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.withdrawApplication),
  EventController.withdrawApplication
);

router.get(
  '/:eventId/event-applications',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listEventApplications),
  EventController.listEventApplications
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
