import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { FamilyMemberController } from './familyMember.controller';
import { FamilyMemberValidation } from './familyMember.validation';

const router = Router();

router.post(
  '/',
  auth(UserRole.USER),
  validateRequest(FamilyMemberValidation.addFamilyMember),
  FamilyMemberController.addFamilyMember
);

router.get(
  '/family/:familyId',
  auth(UserRole.USER),
  validateRequest(FamilyMemberValidation.getFamilyMembersByFamilyId),
  FamilyMemberController.getFamilyMembersByFamilyId
);

router.delete(
  '/family/:familyId/user/:userId',
  auth(UserRole.USER),
  validateRequest(FamilyMemberValidation.removeFamilyMember),
  FamilyMemberController.removeFamilyMember
);

router.patch(
  '/add-owner',
  auth(UserRole.USER),
  validateRequest(FamilyMemberValidation.addFamilyOwner),
  FamilyMemberController.addFamilyOwner
);

router.patch(
  '/family/:familyId/owner-independent',
  auth(UserRole.USER),
  validateRequest(FamilyMemberValidation.updateOwnerIndependentStatus),
  FamilyMemberController.updateOwnerIndependentStatus
);
export const FamilyMemberRoutes: Router = router;
