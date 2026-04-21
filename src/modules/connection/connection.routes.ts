import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { ConnectionController } from './connection.controller';
import { ConnectionValidation } from './connection.validation';

const router = Router();

router
  .route('/my')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ConnectionValidation.getAcceptedConnections),
    ConnectionController.getAcceptedConnections
  );

router.post(
  '/requests',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.sendConnectionRequest),
  ConnectionController.sendConnectionRequest
);

router.get(
  '/requests/received',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.getIncomingPendingRequests),
  ConnectionController.getIncomingPendingRequests
);

router.get(
  '/requests/sent',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.getOutgoingPendingRequests),
  ConnectionController.getOutgoingPendingRequests
);

router.patch(
  '/requests/:id/accept',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.acceptRequest),
  ConnectionController.acceptRequest
);

router.patch(
  '/requests/:id/reject',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.rejectRequest),
  ConnectionController.rejectRequest
);

router.delete(
  '/requests/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.cancelRequest),
  ConnectionController.cancelRequest
);

router.delete(
  '/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.removeConnection),
  ConnectionController.removeConnection
);

export const ConnectionRoutes: Router = router;
