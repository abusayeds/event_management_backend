import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { UserSettingsController } from './userSettings.controller';
import { UserSettingsValidation } from './userSettings.validation';

const router = Router();
const asUser = auth(UserRole.ADMIN, UserRole.USER);

router.get(
  '/options',
  asUser,
  validateRequest(UserSettingsValidation.getOptions),
  UserSettingsController.getOptions
);

router
  .route('/')
  .get(
    asUser,
    validateRequest(UserSettingsValidation.getMySettings),
    UserSettingsController.getMySettings
  )
  .patch(
    asUser,
    validateRequest(UserSettingsValidation.updateMySettings),
    UserSettingsController.updateMySettings
  );

export const UserSettingsRoutes: Router = router;
