import { StatusCodes } from 'http-status-codes';
import { ConnectionStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { ConnectionRepository } from './connection.repository';

/**
 * Creates a new connection request or re-opens a previously rejected/canceled one.
 * It handles various states, preventing duplicate requests and ensuring users exist.
 * @param senderId The ID of the user sending the request.
 * @param receiverId The ID of the user to receive the request.
 * @returns The created or updated connection object.
 */
const createConnectionRequest = async (senderId: string, receiverId: string) => {
  // Step:1 Block self-request to keep request flow valid.
  if (senderId === receiverId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You cannot send a connection request to yourself.'
    );
  }

  // Step:2 Validate that receiver user exists.
  const receiver = await ConnectionRepository.getUserById(receiverId);
  if (!receiver) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Receiver user not found.');
  }

  // Step:3 Find any existing relationship between both users.
  const existing = await ConnectionRepository.findConnectionBetweenUsers(senderId, receiverId);

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

/**
 * Retrieves a paginated list of pending connection requests received by a user.
 * @param userId The ID of the user whose received requests are to be fetched.
 * @param options Pagination options (page, limit).
 * @returns A paginated list of connection requests.
 */
const getReceivedConnectionRequests = async (userId: string, options: PaginationOptions) => {
  // Step:1 Return pending requests where current user is receiver.
  return ConnectionRepository.getReceivedPendingRequests(userId, options);
};

/**
 * Retrieves a paginated list of pending connection requests sent by a user.
 * @param userId The ID of the user whose sent requests are to be fetched.
 * @param options Pagination options (page, limit).
 * @returns A paginated list of connection requests.
 */
const getSentConnectionRequests = async (userId: string, options: PaginationOptions) => {
  // Step:1 Return pending requests sent by current user.
  return ConnectionRepository.getSentPendingRequests(userId, options);
};

/**
 * Retrieves a paginated list of accepted connections for a user.
 * @param userId The ID of the user whose connections are to be fetched.
 * @param options Pagination options (page, limit).
 * @returns A paginated list of accepted connections.
 */
const getAcceptedConnections = async (userId: string, options: PaginationOptions) => {
  // Step:1 Return accepted connections that include current user.
  return ConnectionRepository.getAcceptedConnections(userId, options);
};

/**
 * Retrieves a paginated list of user suggestions for a user to connect with.
 * Excludes users who are already connected, have pending requests, or are admins.
 * @param userId The ID of the user for whom to generate suggestions.
 * @param options Pagination options (page, limit).
 * @returns A paginated list of user suggestions.
 */
const getConnectionSuggestions = async (userId: string, options: PaginationOptions) => {
  // Step:1 Return users except self/admin/pending/accepted connected users.
  return ConnectionRepository.getConnectionSuggestions(userId, options);
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

/**
 * Rejects a pending connection request.
 * @param connectionId The ID of the connection request to reject.
 * @param userId The ID of the user performing the action (must be the receiver).
 * @returns The updated connection object with a 'REJECTED' status.
 */
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

/**
 * Cancels a pending connection request that was sent.
 * @param connectionId The ID of the connection request to cancel.
 * @param userId The ID of the user performing the action (must be the sender).
 * @returns The updated connection object with a 'CANCELED' status.
 */
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

/**
 * Removes an accepted connection (unfriend).
 * @param connectionId The ID of the connection to remove.
 * @param userId The ID of the user performing the action (must be one of the participants).
 * @returns The updated connection object with a 'CANCELED' status.
 */
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
  createConnectionRequest,
  getReceivedConnectionRequests,
  getSentConnectionRequests,
  getAcceptedConnections,
  getConnectionSuggestions,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeConnection,
};
