import { StatusCodes } from 'http-status-codes';
import { Prisma } from '../../../prisma/generated/client';
import { NotificationMedium, NotificationType } from '../../../prisma/generated/enums';
import ApiError from '../../utils/apiError';
import { EVENT_CONTRIBUTION_SCORE } from '../event/event.interface';
import { EventRepository } from '../event/event.repository';
import { NotificationService } from '../notification/notification.service';
import { rewardUserContribution } from '../user/contributionReward';
import {
  ICreateEventApplicationPayload,
  IGetEventApplicationByUserQuery,
} from './eventApplication.interface';
import { EventApplicationRepository } from './eventApplication.repository';

// Create a simple event application row.
const createEventApplication = async (userId: string, payload: ICreateEventApplicationPayload) => {
  const event = await EventRepository.getEventBare(payload.eventId);
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  if (event.isDisabled) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'This event is not accepting applications at the moment.'
    );
  }

  try {
    const created = await EventApplicationRepository.createEventApplication(userId, payload);
    await rewardUserContribution(userId, EVENT_CONTRIBUTION_SCORE.APPLY);

    if (event.creatorId !== userId) {
      await NotificationService.createNotification({
        recipientId: event.creatorId,
        senderId: userId,
        type: NotificationType.EventApplication,
        medium: [NotificationMedium.InApp, NotificationMedium.Push],
        title: 'New event application',
        message: `A user applied to your event "${event.eventName}".`,
        linkId: event.id,
        linkType: 'event',
      });
    }

    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(StatusCodes.CONFLICT, 'You already applied to this event.');
    }
    throw error;
  }
};

const getEventApplicationByUser = async (userId: string, query: IGetEventApplicationByUserQuery) => {
  return EventApplicationRepository.getEventApplicationByUser(userId, query);
};

const deleteApplication = async (id: string, userId: string) => {
  const existing = await EventApplicationRepository.getEventApplicationBare(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Application not found.');
  }
  if (existing.userId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own applications.');
  }
  return EventApplicationRepository.deleteApplication(id);
};

export const EventApplicationService = {
  createEventApplication,
  getEventApplicationByUser,
  deleteApplication,
};
