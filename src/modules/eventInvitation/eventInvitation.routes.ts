import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { EventInvitationController } from './eventInvitation.controller';
import { EventInvitationValidation } from './eventInvitation.validation';

const router = Router();
const asUser = auth(UserRole.ADMIN, UserRole.USER);

// --- Share helpers -------------------------------------------------------

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

// --- Send invitations ----------------------------------------------------

router.post(
  '/share/:eventId',
  asUser,
  validateRequest(EventInvitationValidation.sendInvitations),
  EventInvitationController.sendInvitations
);

// Alias: eventId in the body instead of the path.
router.post(
  '/',
  asUser,
  validateRequest(EventInvitationValidation.sendInvitationsRoot),
  EventInvitationController.sendInvitations
);

// --- List invitations ----------------------------------------------------

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

// Alias: defaults to received invitations.
router.get(
  '/',
  asUser,
  validateRequest(EventInvitationValidation.getReceivedInvitations),
  EventInvitationController.getReceivedInvitations
);

// --- Respond to invitations ----------------------------------------------
// Bulk routes must stay above '/:id/...' so 'accept-all' is not captured as an id.

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
