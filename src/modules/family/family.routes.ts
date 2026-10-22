import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { FamilyController } from './family.controller';
import { FamilyValidation } from './family.validation';

const router = Router();

// Protect all routes with authentication
router.use(auth(UserRole.USER));

router
  .route('/')
  .post(
    upload.single('imageUrl'),
    validateRequest(FamilyValidation.createFamily),
    FamilyController.createFamily
  )
  .get(validateRequest(FamilyValidation.getMyFamilies), FamilyController.getMyFamilies);

router
  .route('/:id')
  .get(validateRequest(FamilyValidation.getFamily), FamilyController.getFamily)
  .patch(
    upload.single('imageUrl'),
    validateRequest(FamilyValidation.updateFamily),
    FamilyController.updateFamily
  )
  .delete(validateRequest(FamilyValidation.deleteFamily), FamilyController.deleteFamily);

export const FamilyRoutes: Router = router;
