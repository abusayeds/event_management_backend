import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { CategoryController } from './category.controller';
import { CategoryValidation } from './category.validation';

const router = Router();

router
  .route('/')
  .post(
    auth(UserRole.ADMIN),
    upload.single('imageUrl'),
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
    upload.single('image'),
    validateRequest(CategoryValidation.updateCategory),
    CategoryController.updateCategory
  )
  .delete(
    auth(UserRole.ADMIN),
    validateRequest(CategoryValidation.deleteCategory),
    CategoryController.deleteCategory
  );

router.get(
  '/events/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(CategoryValidation.getCategoryEvents),
  CategoryController.getCategoryEvents
);

export const CategoryRoutes: Router = router;
