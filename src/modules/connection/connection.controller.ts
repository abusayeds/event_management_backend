import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { ConnectionService } from './connection.service';

const createConnectionRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read sender and target user ids from authenticated request.
  const { userId } = req.user!;
  const { receiverId } = req.body;

  // Step:2 Send a new connection request.
  const result = await ConnectionService.createConnectionRequest(userId, receiverId);

  // Step:3 Return success response with created request.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Connection request sent.',
    data: result,
  });
});

const getReceivedConnectionRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and pagination options.
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  // Step:2 Fetch received pending requests.
  const result = await ConnectionService.getReceivedConnectionRequests(userId, options);

  // Step:3 Return paginated request list.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Received requests fetched.',
    data: result.data,
    meta: result.meta,
  });
});

const getSentConnectionRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and pagination options.
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  // Step:2 Fetch sent pending requests.
  const result = await ConnectionService.getSentConnectionRequests(userId, options);

  // Step:3 Return paginated request list.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Sent requests fetched.',
    data: result.data,
    meta: result.meta,
  });
});

const getAcceptedConnections = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and pagination options.
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  // Step:2 Fetch accepted connections for current user.
  const result = await ConnectionService.getAcceptedConnections(userId, options);

  // Step:3 Return paginated connection list.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'My connections fetched.',
    data: result.data,
    meta: result.meta,
  });
});

const getConnectionSuggestions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and pagination options.
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  // Step:2 Fetch suggestion list excluding pending/accepted connections.
  const result = await ConnectionService.getConnectionSuggestions(userId, options);

  // Step:3 Return paginated suggestion list.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Connection suggestions fetched.',
    data: result.data,
    meta: result.meta,
  });
});

const acceptRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and request id.
  const { userId } = req.user!;
  const { id } = req.params;

  // Step:2 Accept the received request.
  const result = await ConnectionService.acceptRequest(id as string, userId);

  // Step:3 Return updated request data.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Connection request accepted.',
    data: result,
  });
});

const rejectRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and request id.
  const { userId } = req.user!;
  const { id } = req.params;

  // Step:2 Reject the received request.
  const result = await ConnectionService.rejectRequest(id as string, userId);

  // Step:3 Return updated request data.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Connection request rejected.',
    data: result,
  });
});

const cancelRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and request id.
  const { userId } = req.user!;
  const { id } = req.params;

  // Step:2 Cancel own sent pending request.
  const result = await ConnectionService.cancelRequest(id as string, userId);

  // Step:3 Return updated request data.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Connection request canceled.',
    data: result,
  });
});

const removeConnection = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Step:1 Read authenticated user id and connection id.
  const { userId } = req.user!;
  const { id } = req.params;

  // Step:2 Remove accepted connection.
  const result = await ConnectionService.removeConnection(id as string, userId);

  // Step:3 Return updated connection data.
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Connection removed.',
    data: result,
  });
});

export const ConnectionController = {
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
