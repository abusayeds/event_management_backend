import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { EventApplicationController } from './eventApplication.controller';
import { EventApplicationValidation } from './eventApplication.validation';

const router = Router();

// Event-specific apply/withdraw endpoints.
router.post(
  '/events/:eventId/apply',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventApplicationValidation.applyToEvent),
  EventApplicationController.applyToEvent
);

router.delete(
  '/events/:eventId/apply',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventApplicationValidation.withdrawEventApplication),
  EventApplicationController.withdrawEventApplication
);

// Event application list + by-id (mounted under /event-applications).
router
  .route('/')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventApplicationValidation.getEventApplicationList),
    EventApplicationController.getEventApplicationList
  );

// Must stay after /events/... so `events` is not parsed as an appliedId.
router
  .route('/:appliedId')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventApplicationValidation.getEventApplicationById),
    EventApplicationController.getEventApplicationById
  )
  .patch(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventApplicationValidation.updateEventApplication),
    EventApplicationController.updateEventApplication
  )
  .delete(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventApplicationValidation.deleteEventApplication),
    EventApplicationController.deleteEventApplication
  );

export const EventApplicationRoutes: Router = router;
