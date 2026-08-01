import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { HomeEventController } from './cretehomeevent.controller';
import { HomeEventValidation } from './cretehomeevent.validation';

const router: Router = Router();

// POST /api/home-events
router.post(
  '/',
  auth(),
  validateRequest(HomeEventValidation.createHomeEventZodSchema),
  HomeEventController.createHomeEvent
);

// GET /api/home-events
router.get('/', auth(), HomeEventController.getAllHomeEvents);

// GET /api/home-events/:id
router.get('/:id', auth(), HomeEventController.getHomeEventById);

// PATCH /api/home-events/:id
router.patch(
  '/:id',
  auth(),
  validateRequest(HomeEventValidation.updateHomeEventZodSchema),
  HomeEventController.updateHomeEvent
);

// DELETE /api/home-events/:id
router.delete('/:id', auth(), HomeEventController.deleteHomeEvent);

export const HomeEventRoutes = router;
