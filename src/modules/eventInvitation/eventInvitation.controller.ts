import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { EventInvitationService } from './eventInvitation.service';

const getShareConnections = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await EventInvitationService.getShareConnections(
    userId,
    req.params.eventId as string,
    options
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Shareable connections fetched.',
    data: result.data,
    meta: result.meta,
  });
});

const getShareLink = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await EventInvitationService.getShareLink(req.params.eventId as string);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Share link fetched.',
    data: result,
  });
});

const sendInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  // eventId comes from the path on POST /share/:eventId, or from the body on POST /.
  const eventId = (req.params.eventId as string | undefined) ?? (req.body.eventId as string);
  const { inviteeIds, message } = req.body;
  const result = await EventInvitationService.sendInvitations(userId, eventId, {
    inviteeIds,
    message,
  });

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message:
      result.skippedCount > 0
        ? `${result.sentCount} invitation(s) sent, ${result.skippedCount} skipped (already invited).`
        : 'Invitations sent.',
    data: result,
  });
});

const getReceivedInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await EventInvitationService.getReceivedInvitations(userId, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Received invitations fetched.',
    data: result.data,
    meta: result.meta,
  });
});

const getSentInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
  const result = await EventInvitationService.getSentInvitations(userId, options, eventId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Sent invitations fetched.',
    data: result.data,
    meta: result.meta,
  });
});

const acceptInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const result = await EventInvitationService.acceptInvitation(req.params.id as string, userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Invitation accepted.',
    data: result,
  });
});

const declineInvitation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const result = await EventInvitationService.declineInvitation(req.params.id as string, userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Invitation ignored.',
    data: result,
  });
});

const acceptAllInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const result = await EventInvitationService.acceptAllInvitations(userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'All invitations accepted.',
    data: result,
  });
});

const declineAllInvitations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const result = await EventInvitationService.declineAllInvitations(userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'All invitations ignored.',
    data: result,
  });
});

export const EventInvitationController = {
  getShareConnections,
  getShareLink,
  sendInvitations,
  getReceivedInvitations,
  getSentInvitations,
  acceptInvitation,
  declineInvitation,
  acceptAllInvitations,
  declineAllInvitations,
};
