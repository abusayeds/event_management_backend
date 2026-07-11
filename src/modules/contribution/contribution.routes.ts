import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { ContributionController } from './contribution.controller';
import { ContributionValidation } from './contribution.validation';

const router = Router();
const asUser = auth(UserRole.ADMIN, UserRole.USER);

router.get(
  '/filter-options',
  asUser,
  validateRequest(ContributionValidation.getFilterOptionsValidationSchema),
  ContributionController.getFilterOptions
);

router.get(
  '/',
  asUser,
  validateRequest(ContributionValidation.getContributionsValidationSchema),
  ContributionController.getContributions
);

export const ContributionRoutes: Router = router;
