import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { CategoryController } from './category.controller';
import { CategoryValidation } from './category.validation';

const router = Router();

router
  .route('/')
  .post(
    auth(UserRole.ADMIN),
    validateRequest(CategoryValidation.createCategory),
    CategoryController.createCategory
  )
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(CategoryValidation.getAllCategories),
    CategoryController.getAllCategories
  );

router
  .route('/:id')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(CategoryValidation.getCategoryById),
    CategoryController.getCategoryById
  )
  .patch(
    auth(UserRole.ADMIN),
    validateRequest(CategoryValidation.updateCategory),
    CategoryController.updateCategory
  )
  .delete(
    auth(UserRole.ADMIN),
    validateRequest(CategoryValidation.deleteCategory),
    CategoryController.deleteCategory
  );

export const CategoryRoutes: Router = router;
