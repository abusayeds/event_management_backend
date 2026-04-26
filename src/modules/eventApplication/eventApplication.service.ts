import { StatusCodes } from 'http-status-codes';
import { Prisma } from '../../../prisma/generated/client';
import { EventApplicationStatus, UserRole } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { EVENT_CONTRIBUTION_SCORE } from '../event/event.interface';
import { EventRepository } from '../event/event.repository';
import { rewardUserContribution } from '../user/contributionReward';
import {
  ICreateEventApplicationPayload,
  IUpdateEventApplicationPayload,
  IEventApplicationFilters,
} from './eventApplication.interface';
import { EventApplicationRepository } from './eventApplication.repository';

// Admins can filter by userId; non-admin users only see their own applications.
const resolveListFilters = (
  requesterId: string,
  role: UserRole,
  filters: IEventApplicationFilters
): IEventApplicationFilters => {
  const out: IEventApplicationFilters = {
    eventId: filters.eventId,
    status: filters.status,
  };

  if (role !== UserRole.ADMIN) {
    out.userId = requesterId;
    return out;
  }

  if (filters.userId) {
    out.userId = filters.userId;
  }
  return out;
};

// Create an event-only application and revive a soft-deleted row if it already exists.
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
      const existing = await EventApplicationRepository.getAnyEventApplicationByEventIdAndUserId(
        payload.eventId,
        userId
      );
      if (existing?.deletedAt) {
        const revived = await EventApplicationRepository.reviveEventApplication(existing.id, payload.note);
        await rewardUserContribution(userId, EVENT_CONTRIBUTION_SCORE.APPLY);
        return revived;
      }
      throw new ApiError(StatusCodes.CONFLICT, 'You already applied to this event.');
    }
    throw error;
  }
};

// List event applications with optional event/status filters.
const getEventApplicationList = async (
  requesterId: string,
  role: UserRole,
  filters: IEventApplicationFilters,
  options: PaginationOptions
) => {
  if (filters.userId && role !== UserRole.ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only admins can filter by userId.');
  }

  const effective = resolveListFilters(requesterId, role, filters);
  return EventApplicationRepository.getEventApplicationList(effective, options);
};

// Fetch one application by id with ownership check.
const getEventApplicationById = async (id: string, requesterId: string, role: UserRole) => {
  const row = await EventApplicationRepository.getEventApplicationById(id);
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Application not found.');
  }
  if (role !== UserRole.ADMIN && row.userId !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only view your own applications.');
  }
  return row;
};

// Non-admin users can only withdraw or edit note while Pending.
const updateEventApplication = async (
  id: string,
  requesterId: string,
  role: UserRole,
  payload: IUpdateEventApplicationPayload
) => {
  const existing = await EventApplicationRepository.getEventApplicationBare(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Application not found.');
  }

  if (role !== UserRole.ADMIN && existing.userId !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only update your own applications.');
  }

  if (role !== UserRole.ADMIN) {
    if (payload.status !== undefined && payload.status !== EventApplicationStatus.Withdrawn) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'You may only set status to Withdrawn on your own application.'
      );
    }
    if (
      payload.status === EventApplicationStatus.Withdrawn &&
      existing.status !== EventApplicationStatus.Pending
    ) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Only a pending application can be withdrawn.');
    }
    if (payload.note !== undefined && existing.status !== EventApplicationStatus.Pending) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'You can only edit the note while the application is pending.'
      );
    }
  }

  return EventApplicationRepository.updateEventApplicationById(id, payload);
};

// Soft-delete by applied id with ownership check.
const deleteEventApplication = async (id: string, requesterId: string, role: UserRole) => {
  const existing = await EventApplicationRepository.getEventApplicationBare(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Application not found.');
  }
  if (role !== UserRole.ADMIN && existing.userId !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own applications.');
  }
  return EventApplicationRepository.softDeleteEventApplication(id);
};

// Shortcut API for POST /events/:eventId/apply.
const applyToEvent = async (eventId: string, userId: string, note?: string | null) => {
  return createEventApplication(userId, { eventId, note });
};

// Shortcut API for DELETE /events/:eventId/apply.
const withdrawEventApplication = async (eventId: string, userId: string) => {
  const application = await EventApplicationRepository.getEventApplicationByEventIdAndUserId(
    eventId,
    userId
  );
  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No application found for this event.');
  }
  if (application.status !== EventApplicationStatus.Pending) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only a pending application can be withdrawn.');
  }
  return EventApplicationRepository.softDeleteEventApplication(application.id);
};

export const EventApplicationService = {
  createEventApplication,
  getEventApplicationList,
  getEventApplicationById,
  updateEventApplication,
  deleteEventApplication,
  applyToEvent,
  withdrawEventApplication,
};
