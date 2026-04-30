import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { FeedbackController } from './feedback.controller';
import { FeedbackValidation } from './feedback.validation';

const router = Router();

router.post(
  '/',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(FeedbackValidation.createFeedback),
  FeedbackController.createFeedback
);

router.get(
  '/me',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(FeedbackValidation.listMineQuery),
  FeedbackController.getMyFeedbacks
);

router.get(
  '/',
  auth(UserRole.ADMIN),
  validateRequest(FeedbackValidation.listAllQuery),
  FeedbackController.getAllFeedbacks
);

router.get(
  '/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(FeedbackValidation.getById),
  FeedbackController.getFeedbackById
);

router.patch(
  '/:id',
  auth(UserRole.ADMIN),
  validateRequest(FeedbackValidation.updateByAdmin),
  FeedbackController.updateFeedbackByAdmin
);

export const FeedbackRoutes: Router = router;
