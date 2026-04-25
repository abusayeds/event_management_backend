import { StatusCodes } from 'http-status-codes';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, uploadSingleFileToS3 } from '../../utils/s3Upload';
import { EventApplicationStatus, UserRole } from '../../../prisma/generated/enums';
import { UserRepository } from '../user/user.repository';
import {
  EVENT_CONTRIBUTION_SCORE,
  ICalendarDayFilters,
  ICalendarMonthFilters,
  ICreateEventPayload,
  IEventFilters,
  IFeedPriceFilters,
  IUpdateCurrentEventSessionPayload,
  IUpdateEventPayload,
} from './event.interface';
import { EventRepository } from './event.repository';
import { pickEventSessionForDetail } from './eventSessionScope.util';

const rewardContribution = async (userId: string, points: number) => {
  if (points > 0) {
    await UserRepository.incrementContributionScore(userId, points);
  }
};

const isNonEmptySessionPatch = (
  p: IUpdateCurrentEventSessionPayload | undefined
): p is IUpdateCurrentEventSessionPayload =>
  Boolean(p && typeof p === 'object' && Object.keys(p).length > 0);

const createEvent = async (
  userId: string,
  payload: ICreateEventPayload,
  file?: Express.Multer.File
) => {
  const program = await EventRepository.programExists(payload.programId);
  if (!program) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found.');
  }

  if (payload.eventSessions?.length) {
    const ids = payload.eventSessions
      .map(s => s.sessionId)
      .filter((id): id is string => Boolean(id));
    if (ids.length) {
      const ok = await EventRepository.sessionsExist(ids);
      if (!ok) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more sessionId values are invalid.');
      }
    }
  }

  let uploadedCoverUrl: string | undefined;
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'events');
    uploadedCoverUrl = uploaded.url;
  }

  const coverImage = uploadedCoverUrl ?? payload.coverImage?.trim();
  if (!coverImage) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Provide a cover image file (field coverImage) or coverImage URL in the body / data JSON.'
    );
  }

  const fullPayload: ICreateEventPayload = { ...payload, coverImage };

  try {
    const event = await EventRepository.createEvent(userId, fullPayload);
    await rewardContribution(userId, EVENT_CONTRIBUTION_SCORE.CREATE);
    return event;
  } catch (error) {
    if (uploadedCoverUrl) {
      await deleteFileFromS3(uploadedCoverUrl);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create event.');
  }
};

const listEvents = async (filters: IEventFilters, options: PaginationOptions) => {
  return EventRepository.getEvents(filters, options);
};

const listActiveEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getActiveEvents(options, price);
};

const listUpcomingEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getUpcomingEvents(options, price);
};

const listTodayEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getFeedToday(options, price);
};

const listHistoryEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getFeedHistory(options, price);
};

const getCalendarMonthFeed = async (
  year: number,
  month: number,
  filters: ICalendarMonthFilters
) => {
  return EventRepository.getCalendarMonth(year, month, filters);
};

const getCalendarDayFeed = async (
  dateStr: string,
  filters: ICalendarDayFilters,
  options: PaginationOptions
) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return EventRepository.getCalendarDayFeed(day, filters, options);
};

const getEventById = async (id: string) => {
  const event = await EventRepository.getEventById(id);
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  const { eventSessions, ...rest } = event;
  const eventSession = pickEventSessionForDetail(eventSessions ?? []);
  return { ...rest, eventSession };
};

const updateEvent = async (
  eventId: string,
  userId: string,
  payload: IUpdateEventPayload,
  file?: Express.Multer.File
) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  if (existing.isLocked) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'This event is locked and cannot be edited.');
  }

  if (payload.eventName !== undefined && payload.eventName !== existing.eventName) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Event name cannot be changed after creation.');
  }

  if (payload.programId) {
    const program = await EventRepository.programExists(payload.programId);
    if (!program) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found.');
    }
  }

  let uploadedCoverUrl: string | undefined;
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'events');
    uploadedCoverUrl = uploaded.url;
  }

  const mergedPayload: IUpdateEventPayload = uploadedCoverUrl
    ? { ...payload, coverImage: uploadedCoverUrl }
    : payload;

  const { repeatConfig, currentEventSession, ...rest } = mergedPayload;
  const cleaned = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  ) as Record<string, unknown>;

  const hasSessionPatch = isNonEmptySessionPatch(currentEventSession);
  const hasScalarUpdate = Object.keys(cleaned).length > 0;
  const hasRepeatUpdate = repeatConfig !== undefined;
  if (!hasScalarUpdate && !hasRepeatUpdate && !file && !hasSessionPatch) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'At least one field, repeatConfig, currentEventSession, or a cover image file is required to update an event.'
    );
  }

  const data: Record<string, unknown> = {
    ...cleaned,
    lastEditorId: userId,
    version: { increment: 1 },
  };
  delete data.eventName;

  try {
    const updated = await EventRepository.updateEventById(eventId, data);

    if (repeatConfig !== undefined) {
      if (repeatConfig === null) {
        await EventRepository.deleteRepeatConfigByEventId(eventId);
      } else {
        await EventRepository.upsertRepeatConfig(eventId, repeatConfig);
      }
    }

    if (hasSessionPatch && currentEventSession) {
      const sessionRow = await EventRepository.updateCurrentEventSessionForEvent(
        eventId,
        currentEventSession
      );
      if (!sessionRow) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          'No current event session found (isCurrentSession). Add sessions or mark one as current first.'
        );
      }
    }
    if (uploadedCoverUrl && existing.coverImage) {
      await deleteFileFromS3(existing.coverImage);
    }

    await rewardContribution(userId, EVENT_CONTRIBUTION_SCORE.UPDATE);
    return updated;
  } catch (error) {
    if (uploadedCoverUrl) {
      await deleteFileFromS3(uploadedCoverUrl);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update event.');
  }
};

const deleteEvent = async (eventId: string, userId: string, role: UserRole) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  if (existing.creatorId !== userId && role !== UserRole.ADMIN) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Only the event creator or an admin can delete this event.'
    );
  }
  return EventRepository.softDeleteEvent(eventId);
};

const listEventSessions = async (eventId: string) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  return EventRepository.listEventSessions(eventId);
};

const verifyEvent = async (eventId: string, userId: string) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  if (existing.isVerified) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This event is already verified.');
  }

  const updated = await EventRepository.verifyEvent(eventId, userId);
  await rewardContribution(userId, EVENT_CONTRIBUTION_SCORE.VERIFY);
  return updated;
};

const applyToEvent = async (eventId: string, userId: string, note?: string | null) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }

  const application = await EventRepository.findApplication(eventId, userId);

  if (!application) {
    const created = await EventRepository.createApplication(eventId, userId, note);
    await rewardContribution(userId, EVENT_CONTRIBUTION_SCORE.APPLY);
    return created;
  }

  if (application.status === EventApplicationStatus.Pending) {
    throw new ApiError(StatusCodes.CONFLICT, 'You already have a pending application for this event.');
  }
  if (application.status === EventApplicationStatus.Approved) {
    throw new ApiError(StatusCodes.CONFLICT, 'Your application is already approved.');
  }

  const reopened = await EventRepository.reapplyApplication(eventId, userId, note);
  await rewardContribution(userId, EVENT_CONTRIBUTION_SCORE.APPLY);
  return reopened;
};

const withdrawApplication = async (eventId: string, userId: string) => {
  const application = await EventRepository.findApplication(eventId, userId);
  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No application found for this event.');
  }
  if (application.status !== EventApplicationStatus.Pending) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only a pending application can be withdrawn.');
  }
  return EventRepository.withdrawApplication(eventId, userId);
};

const listEventApplications = async (eventId: string, requesterId: string, role: UserRole) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  if (existing.creatorId !== requesterId && role !== UserRole.ADMIN) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Only the event creator or an admin can view applications.'
    );
  }
  return EventRepository.listApplicationsForEvent(eventId);
};

export const EventService = {
  createEvent,
  listEvents,
  listActiveEvents,
  listUpcomingEvents,
  listTodayEvents,
  listHistoryEvents,
  getCalendarMonthFeed,
  getCalendarDayFeed,
  getEventById,
  updateEvent,
  deleteEvent,
  listEventSessions,
  verifyEvent,
  applyToEvent,
  withdrawApplication,
  listEventApplications,
};
