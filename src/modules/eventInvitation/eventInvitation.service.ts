import { StatusCodes } from 'http-status-codes';
import {
  InvitationStatus,
  NotificationMedium,
  NotificationType,
} from '../../../prisma/generated/enums';
import config from '../../config';
import logger from '../../config/logger';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { NotificationService } from '../notification/notification.service';
import { ISendEventInvitationsPayload } from './eventInvitation.interface';
import { EventInvitationRepository } from './eventInvitation.repository';

const assertEventShareable = async (eventId: string) => {
  const event = await EventInvitationRepository.getEventById(eventId);
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  if (event.isDisabled || !event.isActive || !event.isPublished) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This event cannot be shared right now.');
  }
  return event;
};

const getShareConnections = async (
  userId: string,
  eventId: string,
  options: PaginationOptions
) => {
  await assertEventShareable(eventId);
  return EventInvitationRepository.getShareableConnections(userId, eventId, options);
};

const getShareLink = async (eventId: string) => {
  const event = await assertEventShareable(eventId);
  const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

  return {
    eventId: event.id,
    eventName: event.eventName,
    shareUrl: `${frontendBase}/events/${event.id}`,
    backendBaseUrl: config.backend.baseUrl,
  };
};

const sendInvitations = async (
  userId: string,
  eventId: string,
  payload: ISendEventInvitationsPayload
) => {
  const event = await assertEventShareable(eventId);
  const uniqueInviteeIds = [...new Set(payload.inviteeIds)];

  if (uniqueInviteeIds.includes(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot invite yourself.');
  }

  const connectedUserIds = await EventInvitationRepository.getAcceptedConnectionUserIds(userId);
  const connectedSet = new Set(connectedUserIds);

  const invalidInvitee = uniqueInviteeIds.find(inviteeId => !connectedSet.has(inviteeId));
  if (invalidInvitee) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You can only invite users from your connections.'
    );
  }

  const { invitations, skipped } = await EventInvitationRepository.createInvitations(
    eventId,
    userId,
    uniqueInviteeIds,
    payload.message
  );

  // Notifications are best-effort: a delivery failure must not fail the request
  // after invitations are already persisted.
  const notificationResults = await Promise.allSettled(
    invitations.map(invitation =>
      NotificationService.createNotification({
        recipientId: invitation.inviteeId,
        senderId: userId,
        type: NotificationType.EventInvitation,
        medium: [NotificationMedium.InApp, NotificationMedium.Push],
        title: 'Event invitation',
        message:
          payload.message?.trim() ||
          `You have been invited to "${event.eventName}".`,
        image: event.coverImage,
        linkId: invitation.id,
        linkType: 'event-invitation',
        data: {
          eventId: event.id,
          invitationId: invitation.id,
        },
      })
    )
  );

  notificationResults.forEach(result => {
    if (result.status === 'rejected') {
      logger.error('Failed to send event invitation notification', result.reason);
    }
  });

  return {
    sentCount: invitations.length,
    skippedCount: skipped.length,
    skipped,
    invitations,
  };
};

const getReceivedInvitations = async (userId: string, options: PaginationOptions) => {
  return EventInvitationRepository.getReceivedPendingInvitations(userId, options);
};

const getSentInvitations = async (
  userId: string,
  options: PaginationOptions,
  eventId?: string
) => {
  return EventInvitationRepository.getSentInvitations(userId, options, eventId);
};

const acceptInvitation = async (invitationId: string, userId: string) => {
  const invitation = await EventInvitationRepository.getInvitationById(invitationId);
  if (!invitation) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Invitation not found.');
  }
  if (invitation.inviteeId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the invitee can accept this invitation.');
  }
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending invitations can be accepted.');
  }

  // The event must still be live to accept its invitation.
  await assertEventShareable(invitation.eventId);

  const updated = await EventInvitationRepository.updateInvitationStatus(
    invitationId,
    InvitationStatus.ACCEPTED
  );

  // Best-effort notification — invitation is already accepted at this point.
  try {
    await NotificationService.createNotification({
      recipientId: invitation.inviterId,
      senderId: userId,
      type: NotificationType.EventInvitation,
      medium: [NotificationMedium.InApp],
      title: 'Invitation accepted',
      message: `Your invitation to "${invitation.event.eventName}" was accepted.`,
      linkId: invitation.eventId,
      linkType: 'event',
      data: {
        eventId: invitation.eventId,
        invitationId: invitation.id,
      },
    });
  } catch (error) {
    logger.error('Failed to send invitation-accepted notification', error);
  }

  return updated;
};

const declineInvitation = async (invitationId: string, userId: string) => {
  const invitation = await EventInvitationRepository.getInvitationById(invitationId);
  if (!invitation) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Invitation not found.');
  }
  if (invitation.inviteeId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the invitee can ignore this invitation.');
  }
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only pending invitations can be ignored.');
  }

  return EventInvitationRepository.updateInvitationStatus(
    invitationId,
    InvitationStatus.DECLINED
  );
};

const acceptAllInvitations = async (userId: string) => {
  const count = await EventInvitationRepository.bulkUpdateReceivedPending(
    userId,
    InvitationStatus.ACCEPTED
  );
  return { acceptedCount: count };
};

const declineAllInvitations = async (userId: string) => {
  const count = await EventInvitationRepository.bulkUpdateReceivedPending(
    userId,
    InvitationStatus.DECLINED
  );
  return { declinedCount: count };
};

export const EventInvitationService = {
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
