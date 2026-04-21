import { StatusCodes } from 'http-status-codes';
import { ConnectionStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { ConnectionRepository } from './connection.repository';

const sendConnectionRequest = async (senderId: string, receiverId: string) => {
  // Step:1 Block self-request to keep request flow valid.
  if (senderId === receiverId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot send a connection request to yourself.');
  }

  // Step:2 Validate that receiver user exists.
  const receiver = await ConnectionRepository.getUserById(receiverId);
  if (!receiver) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Receiver user not found.');
  }

  // Step:3 Find any existing relationship between both users.
  const existing = await ConnectionRepository.findAnyBetweenUsers(senderId, receiverId);

  // Step:4 Create new pending request when no previous record exists.
  if (!existing) {
    return ConnectionRepository.createConnection(senderId, receiverId);
  }

  // Step:5 Prevent duplicate request when connection is already accepted.
  if (existing.status === ConnectionStatus.ACCEPTED) {
    throw new ApiError(StatusCodes.CONFLICT, 'You are already connected.');
  }

  // Step:6 Handle duplicate or reverse pending request case.
  if (existing.status === ConnectionStatus.PENDING) {
    if (existing.requesterId === senderId) {
      throw new ApiError(StatusCodes.CONFLICT, 'Connection request already sent.');
    }

    throw new ApiError(
      StatusCodes.CONFLICT,
      'This user already sent you a request. Please accept or reject it.'
    );
  }

  // Step:7 Reopen rejected/canceled record as a fresh pending request.
  return ConnectionRepository.updateConnection(existing.id, {
    requesterId: senderId,
    receiverId,
    status: ConnectionStatus.PENDING,
  });
};

const getIncomingPendingRequests = async (userId: string, options: PaginationOptions) => {
  // Step:1 Return pending requests where current user is receiver.
  return ConnectionRepository.getIncomingPendingRequests(userId, options);
};

const getOutgoingPendingRequests = async (userId: string, options: PaginationOptions) => {
  // Step:1 Return pending requests sent by current user.
  return ConnectionRepository.getOutgoingPendingRequests(userId, options);
};

const getAcceptedConnections = async (userId: string, options: PaginationOptions) => {
  // Step:1 Return accepted connections that include current user.
  return ConnectionRepository.getAcceptedConnections(userId, options);
};

const acceptRequest = async (connectionId: string, userId: string) => {
  // Step:1 Load the connection request by id.
  const connection = await ConnectionRepository.getConnectionById(connectionId);

  // Step:2 Validate that the request exists.
  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection request not found.');
  }

  // Step:3 Ensure only pending request can be accepted.
  if (connection.status !== ConnectionStatus.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending requests can be accepted.');
  }

  // Step:4 Ensure receiver user performs the accept action.
  if (connection.receiverId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the receiver can accept this request.');
  }

  // Step:5 Mark request as accepted.
  return ConnectionRepository.updateConnection(connectionId, {
    status: ConnectionStatus.ACCEPTED,
  });
};

const rejectRequest = async (connectionId: string, userId: string) => {
  // Step:1 Load the connection request by id.
  const connection = await ConnectionRepository.getConnectionById(connectionId);

  // Step:2 Validate that the request exists.
  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection request not found.');
  }

  // Step:3 Ensure only pending request can be rejected.
  if (connection.status !== ConnectionStatus.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending requests can be rejected.');
  }

  // Step:4 Ensure receiver user performs the reject action.
  if (connection.receiverId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the receiver can reject this request.');
  }

  // Step:5 Mark request as rejected.
  return ConnectionRepository.updateConnection(connectionId, {
    status: ConnectionStatus.REJECTED,
  });
};

const cancelRequest = async (connectionId: string, userId: string) => {
  // Step:1 Load the connection request by id.
  const connection = await ConnectionRepository.getConnectionById(connectionId);

  // Step:2 Validate that the request exists.
  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection request not found.');
  }

  // Step:3 Ensure only pending request can be canceled.
  if (connection.status !== ConnectionStatus.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending requests can be canceled.');
  }

  // Step:4 Ensure requester user performs the cancel action.
  if (connection.requesterId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the requester can cancel this request.');
  }

  // Step:5 Mark request as canceled.
  return ConnectionRepository.updateConnection(connectionId, {
    status: ConnectionStatus.CANCELED,
  });
};

const removeConnection = async (connectionId: string, userId: string) => {
  // Step:1 Load the connection by id.
  const connection = await ConnectionRepository.getConnectionById(connectionId);

  // Step:2 Validate that the connection exists.
  if (!connection) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Connection not found.');
  }

  // Step:3 Ensure requester or receiver can remove the connection.
  const isParticipant = connection.requesterId === userId || connection.receiverId === userId;
  if (!isParticipant) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not allowed to remove this connection.');
  }

  // Step:4 Ensure only accepted connection can be removed.
  if (connection.status !== ConnectionStatus.ACCEPTED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only accepted connections can be removed.');
  }

  // Step:5 Mark accepted connection as canceled (unfriend flow).
  return ConnectionRepository.updateConnection(connectionId, {
    status: ConnectionStatus.CANCELED,
  });
};

export const ConnectionService = {
  sendConnectionRequest,
  getIncomingPendingRequests,
  getOutgoingPendingRequests,
  getAcceptedConnections,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeConnection,
};
