import { Router } from 'express';
import { FamilyController } from './family.controller';

const router = Router();

router.route('/').post(FamilyController.createFamily).get(FamilyController.getMyFamilies);
router
  .route('/:id')
  .get(FamilyController.getFamily)
  .put(FamilyController.updateFamily)
  .delete(FamilyController.deleteFamily);

export const FamilyRoutes: Router = router;
