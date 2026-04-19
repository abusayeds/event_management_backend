import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';

const router = Router();

// check username exists
router.get(
  '/check-username',
  validateRequest(UserValidation.checkUsernameExists),
  UserController.checkUsernameExists
);

router.get('/me', auth(UserRole.ADMIN, UserRole.USER), UserController.getMyProfile);

// GET  /api/users
router
  .route('/')
  .post(auth(UserRole.ADMIN), validateRequest(UserValidation.createUser), UserController.createUser)
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
    auth(UserRole.ADMIN, UserRole.USER),
    upload.single('profilePicture'),
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

// METHOD 2: Presigned URL endpoint (Future - uncomment when ready)
// GET /api/users/:id/presigned-url
// Generates a presigned URL for frontend direct S3 upload
// router.get(
//   '/:id/presigned-url',
//   auth(UserRole.ADMIN, UserRole.USER),
//   validateRequest(UserValidation.getPresignedUrl),
//   UserController.getProfilePicturePresignedUrl
// );

export const UserRoutes: Router = router;
