import {
  ConnectionStatus,
  InvitationStatus,
  UserStatus,
} from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import {
  IEventInvitation,
  IShareableConnection,
} from './eventInvitation.interface';

const invitationUserSelect = {
  id: true,
  accountId: true,
  username: true,
  firstName: true,
  lastName: true,
  displayName: true,
  profilePicture: true,
  contributionScore: true,
};

const invitationEventSelect = {
  id: true,
  eventName: true,
  coverImage: true,
};

export const eventInvitationSelect = {
  id: true,
  eventId: true,
  inviterId: true,
  inviteeId: true,
  message: true,
  status: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
  inviter: { select: invitationUserSelect },
  invitee: { select: invitationUserSelect },
  event: { select: invitationEventSelect },
};

const getEventById = async (eventId: string) => {
  return database.event.findFirst({
    where: {
      id: eventId,
      isDeleted: false,
      deletedAt: null,
    },
    select: {
      id: true,
      eventName: true,
      coverImage: true,
      isDisabled: true,
      isPublished: true,
      isActive: true,
      creatorId: true,
    },
  });
};

const getInvitationById = async (id: string) => {
  return database.eventInvitation.findFirst({
    where: { id },
    select: eventInvitationSelect,
  });
};

const findExistingInvitation = async (
  eventId: string,
  inviterId: string,
  inviteeId: string
) => {
  return database.eventInvitation.findFirst({
    where: { eventId, inviterId, inviteeId },
    select: eventInvitationSelect,
  });
};

const getAcceptedConnectionUserIds = async (userId: string) => {
  const connections = await database.connection.findMany({
    where: {
      status: ConnectionStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
    select: {
      requesterId: true,
      receiverId: true,
    },
  });

  return connections.map(connection =>
    connection.requesterId === userId ? connection.receiverId : connection.requesterId
  );
};

const getShareableConnections = async (
  userId: string,
  eventId: string,
  options: PaginationOptions
): Promise<PaginationResult<IShareableConnection>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take } = createPaginationQuery(pagination);
  const connectedUserIds = await getAcceptedConnectionUserIds(userId);

  if (connectedUserIds.length === 0) {
    return createPaginationResult([], 0, pagination);
  }

  const where = {
    id: { in: connectedUserIds },
    status: UserStatus.ACTIVE,
  };

  const [users, total, existingInvitations] = await Promise.all([
    database.user.findMany({
      where,
      select: invitationUserSelect,
      skip,
      take,
      orderBy: { firstName: 'asc' },
    }),
    database.user.count({ where }),
    database.eventInvitation.findMany({
      where: {
        eventId,
        inviterId: userId,
        inviteeId: { in: connectedUserIds },
      },
      select: {
        inviteeId: true,
        status: true,
      },
    }),
  ]);

  const invitationByInvitee = new Map(
    existingInvitations.map(invitation => [invitation.inviteeId, invitation.status])
  );

  const data: IShareableConnection[] = users.map(user => {
    const invitationStatus = invitationByInvitee.get(user.id) ?? null;
    return {
      ...user,
      alreadyInvited: invitationStatus === InvitationStatus.PENDING || invitationStatus === InvitationStatus.ACCEPTED,
      invitationStatus,
    };
  });

  return createPaginationResult(data, total, pagination);
};

const createInvitations = async (
  eventId: string,
  inviterId: string,
  inviteeIds: string[],
  message?: string
) => {
  const created: IEventInvitation[] = [];

  for (const inviteeId of inviteeIds) {
    const existing = await findExistingInvitation(eventId, inviterId, inviteeId);

    if (existing) {
      if (
        existing.status === InvitationStatus.DECLINED ||
        existing.status === InvitationStatus.EXPIRED
      ) {
        const reopened = await database.eventInvitation.update({
          where: { id: existing.id },
          data: {
            status: InvitationStatus.PENDING,
            message: message ?? existing.message,
            respondedAt: null,
          },
          select: eventInvitationSelect,
        });
        created.push(reopened as IEventInvitation);
      }
      continue;
    }

    const invitation = await database.eventInvitation.create({
      data: {
        eventId,
        inviterId,
        inviteeId,
        message,
        status: InvitationStatus.PENDING,
      },
      select: eventInvitationSelect,
    });
    created.push(invitation as IEventInvitation);
  }

  return created;
};

const getReceivedPendingInvitations = async (
  userId: string,
  options: PaginationOptions
): Promise<PaginationResult<IEventInvitation>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = {
    inviteeId: userId,
    status: InvitationStatus.PENDING,
  };

  const [rows, total] = await Promise.all([
    database.eventInvitation.findMany({
      where,
      select: eventInvitationSelect,
      skip,
      take,
      orderBy,
    }),
    database.eventInvitation.count({ where }),
  ]);

  return createPaginationResult(rows as IEventInvitation[], total, pagination);
};

const getSentInvitations = async (
  userId: string,
  options: PaginationOptions,
  eventId?: string
): Promise<PaginationResult<IEventInvitation>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = {
    inviterId: userId,
    ...(eventId ? { eventId } : {}),
  };

  const [rows, total] = await Promise.all([
    database.eventInvitation.findMany({
      where,
      select: eventInvitationSelect,
      skip,
      take,
      orderBy,
    }),
    database.eventInvitation.count({ where }),
  ]);

  return createPaginationResult(rows as IEventInvitation[], total, pagination);
};

const updateInvitationStatus = async (id: string, status: InvitationStatus) => {
  return database.eventInvitation.update({
    where: { id },
    data: {
      status,
      respondedAt: new Date(),
    },
    select: eventInvitationSelect,
  });
};

const bulkUpdateReceivedPending = async (userId: string, status: InvitationStatus) => {
  const result = await database.eventInvitation.updateMany({
    where: {
      inviteeId: userId,
      status: InvitationStatus.PENDING,
    },
    data: {
      status,
      respondedAt: new Date(),
    },
  });

  return result.count;
};

const getPendingReceivedCount = async (userId: string) => {
  return database.eventInvitation.count({
    where: {
      inviteeId: userId,
      status: InvitationStatus.PENDING,
    },
  });
};

export const EventInvitationRepository = {
  getEventById,
  getInvitationById,
  findExistingInvitation,
  getAcceptedConnectionUserIds,
  getShareableConnections,
  createInvitations,
  getReceivedPendingInvitations,
  getSentInvitations,
  updateInvitationStatus,
  bulkUpdateReceivedPending,
  getPendingReceivedCount,
};
