import { StatusCodes } from 'http-status-codes';
import { UserRole } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, uploadSingleFileToS3 } from '../../utils/s3Upload';
import { rewardUserContribution } from '../user/contributionReward';
import {
  EVENT_CONTRIBUTION_SCORE,
  ICreateEventPayload,
  IEventFilters,
  IFeedPriceFilters,
  IUpdateEventPayload,
} from './event.interface';
import { diffEventForEditLog } from './eventEditLogDiff.util';
import { EventRepository } from './event.repository';
import { pickEventSessionForDetail } from './eventSessionScope.util';
import { hasCurrentSessionPatchBody } from './eventUpdateSession.util';

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
    await rewardUserContribution(userId, EVENT_CONTRIBUTION_SCORE.CREATE);
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

const getEvents = async (filters: IEventFilters, options: PaginationOptions) => {
  return EventRepository.getEvents(filters, options);
};

const getActiveEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getActiveEvents(options, price);
};

const getUpcomingEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getUpcomingEvents(options, price);
};

const getTodayEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getFeedToday(options, price);
};

const getHistoryEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getFeedHistory(options, price);
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

  // Snapshot before writes so EditLog can store previous values.
  const auditBefore = await EventRepository.getEventAuditSnapshot(eventId);
  if (!auditBefore) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
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

  const hasSessionPatch = hasCurrentSessionPatchBody(currentEventSession);
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

    // Repeat and current-session rows live outside `event`; update them after the main row.
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

    // One EditLog row per successful PATCH when at least one tracked field actually changed.
    const editLogPayload = diffEventForEditLog({
      before: auditBefore,
      scalarPatch: cleaned,
      repeatInPayload: hasRepeatUpdate,
      incomingRepeat: repeatConfig,
      sessionPatchRequested: hasSessionPatch,
    });
    if (editLogPayload) {
      await EventRepository.createEditLog({
        eventId,
        version: editLogPayload.newVersion,
        editorId: userId,
        changedFields: editLogPayload.changedFields,
        previousValues: editLogPayload.previousValues,
      });
    }

    await rewardUserContribution(userId, EVENT_CONTRIBUTION_SCORE.UPDATE);
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

const getEventSessions = async (eventId: string) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  return EventRepository.getEventSessions(eventId);
};

const verifyEvent = async (eventId: string, userId: string) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  const updated = await EventRepository.verifyCurrentSessionForEvent(eventId);
  if (!updated) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No current event session found (isCurrentSession). Add sessions or mark one as current first.'
    );
  }
  await rewardUserContribution(userId, EVENT_CONTRIBUTION_SCORE.VERIFY);
  return updated;
};

const verifyEventSession = async (eventId: string, eventSessionId: string, userId: string) => {
  const existing = await EventRepository.getEventBare(eventId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  const updated = await EventRepository.verifyEventSessionById(eventId, eventSessionId);
  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event session not found for this event.');
  }
  await rewardUserContribution(userId, EVENT_CONTRIBUTION_SCORE.VERIFY);
  return updated;
};

export const EventService = {
  createEvent,
  getEvents,
  getActiveEvents,
  getUpcomingEvents,
  getTodayEvents,
  getHistoryEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getEventSessions,
  verifyEvent,
  verifyEventSession,
};
