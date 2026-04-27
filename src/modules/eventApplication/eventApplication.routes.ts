import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { EventApplicationController } from './eventApplication.controller';
import { EventApplicationValidation } from './eventApplication.validation';

const router = Router();
router
  .route('/')
  .post(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventApplicationValidation.createEventApplication),
    EventApplicationController.createEventApplication
  );

router.get(
  '/my',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(EventApplicationValidation.getEventApplicationByUser),
  EventApplicationController.getEventApplicationByUser
);

router
  .route('/:appliedId')
  .delete(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(EventApplicationValidation.deleteApplication),
    EventApplicationController.deleteApplication
  );

export const EventApplicationRoutes: Router = router;
