import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { EventController } from './event.controller';
import { EventValidation } from './event.validation';

const router = Router();
const asUser = auth(UserRole.ADMIN, UserRole.USER);
const asAdmin = auth(UserRole.ADMIN);

router.get(
  '/feed/upcoming',
  asUser,
  validateRequest(EventValidation.getUpcomingEventsValidationSchema),
  EventController.getUpcomingEvents
);

router.get(
  '/feed/today',
  asUser,
  validateRequest(EventValidation.getTodayEventsValidationSchema),
  EventController.getTodayEvents
);

router.get(
  '/feed/history',
  asUser,
  validateRequest(EventValidation.getHistoryEventsValidationSchema),
  EventController.getHistoryEvents
);

router.get(
  '/feed/search',
  asUser,
  validateRequest(EventValidation.searchHomeScreenEventsValidationSchema),
  EventController.searchHomeScreenEvents
);

router.get(
  '/feed/by-family-relation',
  asUser,
  validateRequest(EventValidation.getEventsByFamilyRelationValidationSchema),
  EventController.getEventsByFamilyRelation
);

// -----------------------------------------------------------------------------
// Admin: per-event lists & toggles
// -----------------------------------------------------------------------------
router.get(
  '/:eventId/edit-logs/:editLogId',
  asAdmin,
  validateRequest(EventValidation.getEventEditLogByIdValidationSchema),
  EventController.getEventEditLogById
);

router.get(
  '/edit-logs/:eventId',
  asAdmin,
  validateRequest(EventValidation.getEventEditLogsByEventIdValidationSchema),
  EventController.getEventEditLogsByEventId
);

router.get(
  '/applied-events/:eventId',
  asAdmin,
  validateRequest(EventValidation.getAppliedEventsByEventIdValidationSchema),
  EventController.getAppliedEventsByEventId
);

router.patch(
  '/disabled/:eventId',
  asAdmin,
  validateRequest(EventValidation.patchEventDisabledValidationSchema),
  EventController.setEventDisabled
);

// -----------------------------------------------------------------------------
// Collection: create + list
// -----------------------------------------------------------------------------
router
  .route('/')
  .post(
    asUser,
    upload.single('coverImage'),
    validateRequest(EventValidation.createEventValidationSchema),
    EventController.createEvent
  )
  .get(
    asUser,
    validateRequest(EventValidation.getEventsValidationSchema),
    EventController.getEvents
  );

// -----------------------------------------------------------------------------
// Single event: detail, update, delete
// -----------------------------------------------------------------------------
router
  .route('/:eventId')
  .get(
    asUser,
    validateRequest(EventValidation.getEventByIdValidationSchema),
    EventController.getEventById
  )
  .patch(
    asUser,
    upload.single('coverImage'),
    validateRequest(EventValidation.updateEventValidationSchema),
    EventController.updateEvent
  )
  .delete(
    asUser,
    validateRequest(EventValidation.deleteEventValidationSchema),
    EventController.deleteEvent
  );

export const EventRoutes: Router = router;
