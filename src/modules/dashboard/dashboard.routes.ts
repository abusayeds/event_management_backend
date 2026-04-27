import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { DashboardController } from './dashboard.controller';
import { DashboardValidation } from './dashboard.validation';

const router = Router();

router.get(
  '/overview',
  auth(UserRole.ADMIN),
  validateRequest(DashboardValidation.getOverview),
  DashboardController.getOverview
);

router.get(
  '/income-ratio',
  auth(UserRole.ADMIN),
  validateRequest(DashboardValidation.getIncomeRatio),
  DashboardController.getIncomeRatio
);

router.get(
  '/user-ratio',
  auth(UserRole.ADMIN),
  validateRequest(DashboardValidation.getUserRatio),
  DashboardController.getUserRatio
);

export const DashboardRoutes: Router = router;
