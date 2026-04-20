import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { SubcategoryController } from './subcategory.controller';
import { SubcategoryValidation } from './subcategory.validation';

const router = Router();

router
  .route('/')
  .post(
    auth(UserRole.ADMIN),
    upload.single('image'),
    validateRequest(SubcategoryValidation.createSubcategory),
    SubcategoryController.createSubcategory
  )
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(SubcategoryValidation.getAllSubcategories),
    SubcategoryController.getAllSubcategories
  );

router
  .route('/:id')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(SubcategoryValidation.getSubcategoryById),
    SubcategoryController.getSubcategoryById
  )
  .patch(
    auth(UserRole.ADMIN),
    upload.single('image'),
    validateRequest(SubcategoryValidation.updateSubcategory),
    SubcategoryController.updateSubcategory
  )
  .delete(
    auth(UserRole.ADMIN),
    validateRequest(SubcategoryValidation.deleteSubcategory),
    SubcategoryController.deleteSubcategory
  );

export const SubcategoryRoutes: Router = router;
