import { Prisma } from '../../../prisma/generated/client';
import { AppliedResourceType, UserAppliedStatus } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import {
  ICreateEventApplicationPayload,
  IUpdateEventApplicationPayload,
  IEventApplicationFilters,
} from './eventApplication.interface';

/** Prisma `select` for list/detail rows (user + application fields). */
export const eventApplicationSelect = {
  id: true,
  userId: true,
  resourceType: true,
  resourceId: true,
  status: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      profilePicture: true,
    },
  },
} as const;

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'status']);

// Create an event application row in user_applied (resourceType is always Event).
const createEventApplication = async (userId: string, payload: ICreateEventApplicationPayload) => {
  return database.userApplied.create({
    data: {
      userId,
      resourceType: AppliedResourceType.Event,
      resourceId: payload.eventId,
      note: payload.note ?? null,
    },
    select: eventApplicationSelect,
  });
};

// Full row for GET by id (soft-deleted rows excluded).
const getEventApplicationById = async (id: string) => {
  return database.userApplied.findFirst({
    where: { id, deletedAt: null },
    select: eventApplicationSelect,
  });
};

// Minimal row for auth checks before update/delete.
const getEventApplicationBare = async (id: string) => {
  return database.userApplied.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, status: true },
  });
};

// Paginated list with optional filters (caller supplies effective `userId` for non-admins).
const getEventApplicationList = async (
  filters: IEventApplicationFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const sortField = SORT_FIELDS.has(pagination.sortBy) ? pagination.sortBy : 'createdAt';
  const { skip, take } = createPaginationQuery({ ...pagination, sortBy: sortField });
  const orderBy = { [sortField]: pagination.sortOrder } as Prisma.UserAppliedOrderByWithRelationInput;

  const where: Prisma.UserAppliedWhereInput = {
    deletedAt: null,
    resourceType: AppliedResourceType.Event,
  };

  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.eventId) {
    where.resourceId = filters.eventId;
  }
  if (filters.status) {
    where.status = filters.status;
  }

  const [data, total] = await Promise.all([
    database.userApplied.findMany({
      where,
      select: eventApplicationSelect,
      skip,
      take,
      orderBy,
    }),
    database.userApplied.count({ where }),
  ]);

  return createPaginationResult(data, total, pagination);
};

// Patch status and/or note (same select shape as list).
const updateEventApplicationById = async (id: string, payload: IUpdateEventApplicationPayload) => {
  const data: Prisma.UserAppliedUpdateInput = {};
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.note !== undefined) data.note = payload.note;

  return database.userApplied.update({
    where: { id },
    data,
    select: eventApplicationSelect,
  });
};

// Soft delete for user-initiated "remove" from the list.
const softDeleteEventApplication = async (id: string) => {
  return database.userApplied.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true, deletedAt: true },
  });
};

// Read one event-application row by event+user (used by apply/withdraw by event route).
const getEventApplicationByEventIdAndUserId = async (eventId: string, userId: string) => {
  return database.userApplied.findFirst({
    where: {
      userId,
      resourceType: AppliedResourceType.Event,
      resourceId: eventId,
      deletedAt: null,
    },
    select: eventApplicationSelect,
  });
};

// Read including soft-deleted row (used to revive a previously deleted application).
const getAnyEventApplicationByEventIdAndUserId = async (eventId: string, userId: string) => {
  return database.userApplied.findFirst({
    where: {
      userId,
      resourceType: AppliedResourceType.Event,
      resourceId: eventId,
    },
    select: { id: true, status: true, deletedAt: true },
  });
};

// Restore a soft-deleted application back to Pending.
const reviveEventApplication = async (id: string, note?: string | null) => {
  return database.userApplied.update({
    where: { id },
    data: {
      deletedAt: null,
      status: UserAppliedStatus.Pending,
      ...(note !== undefined ? { note } : {}),
    },
    select: eventApplicationSelect,
  });
};

export const EventApplicationRepository = {
  createEventApplication,
  getEventApplicationById,
  getEventApplicationBare,
  getEventApplicationList,
  updateEventApplicationById,
  softDeleteEventApplication,
  getEventApplicationByEventIdAndUserId,
  getAnyEventApplicationByEventIdAndUserId,
  reviveEventApplication,
};
