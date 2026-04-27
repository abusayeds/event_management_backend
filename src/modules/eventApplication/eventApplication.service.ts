import { StatusCodes } from 'http-status-codes';
import { Prisma } from '../../../prisma/generated/client';
import ApiError from '../../utils/apiError';
import { EVENT_CONTRIBUTION_SCORE } from '../event/event.interface';
import { EventRepository } from '../event/event.repository';
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

  try {
    const created = await EventApplicationRepository.createEventApplication(userId, payload);
    await rewardUserContribution(userId, EVENT_CONTRIBUTION_SCORE.APPLY);
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
