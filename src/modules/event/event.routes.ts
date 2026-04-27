import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { EventController } from './event.controller';
import { EventValidation } from './event.validation';

const router = Router();
// GET /events/feed/upcoming -> EventController.getUpcomingEvents -> EventService.getUpcomingEvents -> EventRepository.getUpcomingEvents
router.get(
  '/feed/upcoming',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.getUpcomingEvents
);

// GET /events/feed/today -> EventController.getTodayEvents -> EventService.getTodayEvents -> EventRepository.getFeedToday
router.get(
  '/feed/today',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.getTodayEvents
);

// GET /events/feed/history -> EventController.getHistoryEvents -> EventService.getHistoryEvents -> EventRepository.getFeedHistory
router.get(
  '/feed/history',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listFeed),
  EventController.getHistoryEvents
);

// GET /events/feed/member-events — `action` only (self | spouse | child_<name>); no price filter
router.get(
  '/feed/member-events',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventValidation.listMemberEventsFeed),
  EventController.getMemberEventsByAction
);

router
  .route('/')
  // POST /events -> EventController.createEvent -> EventService.createEvent -> EventRepository.createEvent
  .post(
    auth(UserRole.ADMIN, UserRole.USER),
    upload.single('coverImage'),
    validateRequest(EventValidation.createEvent),
    EventController.createEvent
  )
  // GET /events -> EventController.getEvents -> EventService.getEvents -> EventRepository.getEvents
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidation.getEvents),
    EventController.getEvents
  );

router
  .route('/:eventId')
  // GET /events/:eventId -> EventController.getEventById -> EventService.getEventById -> EventRepository.getEventById
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidation.getEventById),
    EventController.getEventById
  )
  // PATCH /events/:eventId -> EventController.updateEvent -> EventService.updateEvent -> EventRepository.update* + createEditLog
  .patch(
    auth(UserRole.ADMIN, UserRole.USER),
    upload.single('coverImage'),
    validateRequest(EventValidation.updateEvent),
    EventController.updateEvent
  )
  // DELETE /events/:eventId -> EventController.deleteEvent -> EventService.deleteEvent -> EventRepository.softDeleteEvent
  .delete(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventValidation.deleteEvent),
    EventController.deleteEvent
);

export const EventRoutes: Router = router;
