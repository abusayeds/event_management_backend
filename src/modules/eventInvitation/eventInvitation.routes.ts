import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { EventInvitationController } from './eventInvitation.controller';
import { EventInvitationValidation } from './eventInvitation.validation';

const router = Router();
const asUser = auth(UserRole.ADMIN, UserRole.USER);

router.get(
  '/share/:eventId/connections',
  asUser,
  validateRequest(EventInvitationValidation.getShareConnections),
  EventInvitationController.getShareConnections
);

router.get(
  '/share/:eventId/link',
  asUser,
  validateRequest(EventInvitationValidation.getShareLink),
  EventInvitationController.getShareLink
);

router.post(
  '/share/:eventId',
  asUser,
  validateRequest(EventInvitationValidation.sendInvitations),
  EventInvitationController.sendInvitations
);

router.get(
  '/received',
  asUser,
  validateRequest(EventInvitationValidation.getReceivedInvitations),
  EventInvitationController.getReceivedInvitations
);

router.get(
  '/sent',
  asUser,
  validateRequest(EventInvitationValidation.getSentInvitations),
  EventInvitationController.getSentInvitations
);

router.patch(
  '/accept-all',
  asUser,
  validateRequest(EventInvitationValidation.bulkRespond),
  EventInvitationController.acceptAllInvitations
);

router.patch(
  '/decline-all',
  asUser,
  validateRequest(EventInvitationValidation.bulkRespond),
  EventInvitationController.declineAllInvitations
);

router.patch(
  '/:id/accept',
  asUser,
  validateRequest(EventInvitationValidation.respondToInvitation),
  EventInvitationController.acceptInvitation
);

router.patch(
  '/:id/decline',
  asUser,
  validateRequest(EventInvitationValidation.respondToInvitation),
  EventInvitationController.declineInvitation
);

export const EventInvitationRoutes: Router = router;
