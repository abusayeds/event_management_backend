import { StatusCodes } from 'http-status-codes';
import { FamilyRelationShip, UserRole } from '../../../prisma/generated/enums';
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
import {
  diffEventForEditLog,
  hasCurrentSessionPatchBody,
  pickEventSessionForDetail,
} from './event.helpers';
import { FamilyMemberRepository } from '../familyMember/familyMember.repository';
import { EventRepository } from './event.repository';

// POST /events
const createEvent = async (
  userId: string,
  payload: ICreateEventPayload,
  file?: Express.Multer.File
) => {
  const program = await EventRepository.programExists(payload.programId);
  if (!program) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found.');
  }
  if (payload.eventSession?.sessionId) {
    const ok = await EventRepository.sessionsExist([payload.eventSession.sessionId]);
    if (!ok) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'sessionId is invalid.');
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

// GET /events
const getEvents = async (filters: IEventFilters, options: PaginationOptions) => {
  return EventRepository.getEvents(filters, options);
};

// GET /events/feed/upcoming
const getUpcomingEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getUpcomingEvents(options, price);
};

// GET /events/feed/today
const getTodayEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getFeedToday(options, price);
};

// GET /events/feed/history
const getHistoryEvents = async (options: PaginationOptions, price?: IFeedPriceFilters) => {
  return EventRepository.getFeedHistory(options, price);
};

// GET /events/feed/by-family-relation
const getEventsByFamilyRelation = async (
  viewerId: string,
  relationShip: FamilyRelationShip,
  options: PaginationOptions,
  price?: IFeedPriceFilters
) => {
  const creatorIds = await FamilyMemberRepository.listCreatorUserIdsForFamilyRelationFeed(
    viewerId,
    relationShip
  );
  return EventRepository.listPublishedEventsByCreatorIds(creatorIds, options, price);
};

// GET /events/:eventId
const getEventById = async (id: string) => {
  const event = await EventRepository.getEventById(id);
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found.');
  }
  const { eventSession, ...rest } = event;
  const pickedEventSession = eventSession ? pickEventSessionForDetail([eventSession]) : null;
  return { ...rest, eventSession: pickedEventSession };
};

// PATCH /events/:eventId (also writes EditLog when tracked fields change)
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

  const { repeatConfig, currentEventSession, isVerified: verifyRequest, ...rest } = mergedPayload;
  const cleaned = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  ) as Record<string, unknown>;

  const hasSessionPatch = hasCurrentSessionPatchBody(currentEventSession);
  const hasScalarUpdate = Object.keys(cleaned).length > 0;
  const hasRepeatUpdate = repeatConfig !== undefined;
  const hasVerifyRequest = verifyRequest === true;
  if (!hasScalarUpdate && !hasRepeatUpdate && !file && !hasSessionPatch && !hasVerifyRequest) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'At least one field, repeatConfig, currentEventSession, isVerified, or a cover image file is required to update an event.'
    );
  }

  const data: Record<string, unknown> = {
    ...cleaned,
    lastEditorId: userId,
    version: { increment: 1 },
  };
  delete data.eventName;
  delete data.isVerified;

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
          'No event session found for this event. Create the event with eventSession or add session details first.'
        );
      }
    }
    if (hasVerifyRequest) {
      const verified = await EventRepository.verifyEventSessionForEvent(eventId);
      if (!verified) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          'No event session found for this event. Create the event with eventSession or add session details first.'
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

// DELETE /events/:eventId
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

export const EventService = {
  createEvent,
  getEvents,
  getUpcomingEvents,
  getTodayEvents,
  getHistoryEvents,
  getEventsByFamilyRelation,
  getEventById,
  updateEvent,
  deleteEvent,
};
