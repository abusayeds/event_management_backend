import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { ProgramController } from './program.controller';
import { ProgramValidation } from './program.validation';

const router = Router();

router
  .route('/')
  .post(
    auth(UserRole.ADMIN),
    upload.single('image'),
    validateRequest(ProgramValidation.createProgram),
    ProgramController.createProgram
  )
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ProgramValidation.getAllPrograms),
    ProgramController.getAllPrograms
  );

router
  .route('/:id')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ProgramValidation.getProgramById),
    ProgramController.getProgramById
  )
  .patch(
    auth(UserRole.ADMIN),
    upload.single('image'),
    validateRequest(ProgramValidation.updateProgram),
    ProgramController.updateProgram
  )
  .delete(
    auth(UserRole.ADMIN),
    validateRequest(ProgramValidation.deleteProgram),
    ProgramController.deleteProgram
  );

export const ProgramRoutes: Router = router;
