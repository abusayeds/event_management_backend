import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { WelcomeController } from './welcome.controller';
import { WelcomeValidation } from './welcome.validation';

const router = Router();

router.post(
  '/:key',
  auth(UserRole.ADMIN),
  validateRequest(WelcomeValidation.upsertPage),
  WelcomeController.upsertPage
);

router.get(
  '/:key',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(WelcomeValidation.getPage),
  WelcomeController.getPage
);

export const WelcomeRoutes: Router = router;
