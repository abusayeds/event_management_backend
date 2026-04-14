import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';

// User role enum
enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

const router = Router();

// GET  /api/users
router
  .route('/')
  .post(
    auth(UserRole.ADMIN),
    validateRequest(UserValidation.createUser),
    UserController.createUser
  )
  .get(
    auth(UserRole.ADMIN),
    validateRequest(UserValidation.getAllUsers),
    UserController.getAllUsers
  );

// GET  /api/users/:id
router
  .route('/:id')
  .get(
    auth(UserRole.ADMIN),
    validateRequest(UserValidation.getUserById),
    UserController.getUserById
  )
  .patch(
    auth(UserRole.ADMIN),
    validateRequest(UserValidation.updateUser),
    UserController.updateUser
  )
  .delete(
    auth(UserRole.ADMIN),
    validateRequest(UserValidation.deleteUser),
    UserController.deleteUser
  );

// PATCH /api/users/:id/status
router.patch(
  '/:id/status',
  auth(UserRole.ADMIN),
  validateRequest(UserValidation.updateUserStatus),
  UserController.updateUserStatus
);

export const UserRoutes: Router = router;
