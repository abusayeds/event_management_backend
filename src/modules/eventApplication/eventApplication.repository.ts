import { Prisma } from '../../../prisma/generated/client';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import {
  ICreateEventApplicationPayload,
  IGetEventApplicationByUserQuery,
} from './eventApplication.interface';

/** Prisma `select` for list/detail rows (user + application fields). */
export const eventApplicationSelect = {
  id: true,
  userId: true,
  eventId: true,
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
  event: {
    select: {
      id: true,
      eventName: true,
      coverImage: true,
    },
  },
} as const;

// Create an event application row in event_applied.
const createEventApplication = async (userId: string, payload: ICreateEventApplicationPayload) => {
  return database.eventApplied.create({
    data: {
      userId,
      eventId: payload.eventId,
      note: payload.note ?? null,
    },
    select: eventApplicationSelect,
  });
};

const getEventApplicationByUser = async (
  userId: string,
  query: IGetEventApplicationByUserQuery
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(query.options);
  const { skip, take } = createPaginationQuery(pagination);
  const orderBy = { [pagination.sortBy]: pagination.sortOrder } as Prisma.EventAppliedOrderByWithRelationInput;

  const where: Prisma.EventAppliedWhereInput = {
    userId,
    deletedAt: null,
  };
  if (query.search?.trim()) {
    where.event = {
      eventName: {
        contains: query.search.trim(),
        mode: 'insensitive',
      },
    };
  }

  const [data, total] = await Promise.all([
    database.eventApplied.findMany({
      where,
      select: eventApplicationSelect,
      orderBy,
      skip,
      take,
    }),
    database.eventApplied.count({ where }),
  ]);

  return createPaginationResult(data, total, pagination);
};

const getEventApplicationBare = async (id: string) => {
  return database.eventApplied.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, eventId: true },
  });
};

const deleteApplication = async (id: string) => {
  return database.eventApplied.update({
    where: { id },
    data: { deletedAt: new Date(), note: null },
    select: eventApplicationSelect,
  });
};

export const EventApplicationRepository = {
  createEventApplication,
  getEventApplicationByUser,
  getEventApplicationBare,
  deleteApplication,
};
