import { Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { auth } from '../../middleware/auth.middleware';
import validateRequest from '../../middleware/validate.middleware';
import { ConnectionController } from './connection.controller';
import { ConnectionValidation } from './connection.validation';

const router = Router();

router
  .route('/my-connections')
  .get(
    auth(UserRole.ADMIN, UserRole.USER),
    validateRequest(ConnectionValidation.getAcceptedConnections),
    ConnectionController.getAcceptedConnections
  );

router.post(
  '/requests/create',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.createConnectionRequest),
  ConnectionController.createConnectionRequest
);

router.get(
  '/requests/received',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.getReceivedConnectionRequests),
  ConnectionController.getReceivedConnectionRequests
);

router.get(
  '/requests/sent',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.getSentConnectionRequests),
  ConnectionController.getSentConnectionRequests
);

router.patch(
  '/requests/accept/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.acceptRequest),
  ConnectionController.acceptRequest
);

router.patch(
  '/requests/reject/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.rejectRequest),
  ConnectionController.rejectRequest
);

router.delete(
  '/requests/cancel/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.cancelRequest),
  ConnectionController.cancelRequest
);

router.delete(
  '/requests/remove/:id',
  auth(UserRole.ADMIN, UserRole.USER),
  validateRequest(ConnectionValidation.removeConnection),
  ConnectionController.removeConnection
);

export const ConnectionRoutes: Router = router;
