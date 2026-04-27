import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { SettingsController } from './settings.controller';
import { SettingsValidation } from './settings.validation';

const router = Router();

router.post(
  '/add-or-edit',
  auth(UserRole.ADMIN),
  validateRequest(SettingsValidation.addOrEditPage),
  SettingsController.addOrEditPage
);

router.get(
  '/:key',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(SettingsValidation.getPage),
  SettingsController.getPage
);

export const SettingsRoutes: Router = router;
