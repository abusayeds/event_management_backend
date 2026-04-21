import { ConnectionStatus, UserRole, UserStatus } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import { IConnection, IConnectionSuggestion } from './connection.interface';

const connectionUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
  profilePicture: true,
};

export const connectionSelect = {
  id: true,
  requesterId: true,
  receiverId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  requester: {
    select: connectionUserSelect,
  },
  receiver: {
    select: connectionUserSelect,
  },
};

const getUserById = async (userId: string) => {
  return database.user.findFirst({
    where: {
      id: userId,
      status: {
        not: UserStatus.DELETED,
      },
    },
    select: {
      id: true,
    },
  });
};

const findConnectionBetweenUsers = async (userAId: string, userBId: string) => {
  return database.connection.findFirst({
    where: {
      OR: [
        {
          requesterId: userAId,
          receiverId: userBId,
        },
        {
          requesterId: userBId,
          receiverId: userAId,
        },
      ],
    },
    select: connectionSelect,
  });
};

const createConnection = async (requesterId: string, receiverId: string) => {
  return database.connection.create({
    data: {
      requesterId,
      receiverId,
      status: ConnectionStatus.PENDING,
    },
    select: connectionSelect,
  });
};

const updateConnection = async (
  id: string,
  payload: {
    requesterId?: string;
    receiverId?: string;
    status?: ConnectionStatus;
  }
) => {
  return database.connection.update({
    where: { id },
    data: payload,
    select: connectionSelect,
  });
};

const getConnectionById = async (id: string) => {
  return database.connection.findFirst({
    where: { id },
    select: connectionSelect,
  });
};

const getReceivedPendingRequests = async (
  userId: string,
  options: PaginationOptions
): Promise<PaginationResult<IConnection>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = {
    receiverId: userId,
    status: ConnectionStatus.PENDING,
  };

  const [rows, total] = await Promise.all([
    database.connection.findMany({
      where,
      select: connectionSelect,
      skip,
      take,
      orderBy,
    }),
    database.connection.count({ where }),
  ]);

  return createPaginationResult(rows as IConnection[], total, pagination);
};

const getSentPendingRequests = async (
  userId: string,
  options: PaginationOptions
): Promise<PaginationResult<IConnection>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = {
    requesterId: userId,
    status: ConnectionStatus.PENDING,
  };

  const [rows, total] = await Promise.all([
    database.connection.findMany({
      where,
      select: connectionSelect,
      skip,
      take,
      orderBy,
    }),
    database.connection.count({ where }),
  ]);

  return createPaginationResult(rows as IConnection[], total, pagination);
};

const getAcceptedConnections = async (
  userId: string,
  options: PaginationOptions
): Promise<PaginationResult<IConnection>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = {
    status: ConnectionStatus.ACCEPTED,
    OR: [{ requesterId: userId }, { receiverId: userId }],
  };

  const [rows, total] = await Promise.all([
    database.connection.findMany({
      where,
      select: connectionSelect,
      skip,
      take,
      orderBy,
    }),
    database.connection.count({ where }),
  ]);

  return createPaginationResult(rows as IConnection[], total, pagination);
};

const getConnectionSuggestions = async (
  userId: string,
  options: PaginationOptions
): Promise<PaginationResult<IConnectionSuggestion>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = {
    id: { not: userId },
    role: { not: UserRole.ADMIN },
    status: UserStatus.ACTIVE,
    AND: [
      {
        sentConnections: {
          none: {
            receiverId: userId,
            status: { in: [ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED] },
          },
        },
      },
      {
        receivedConnections: {
          none: {
            requesterId: userId,
            status: { in: [ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED] },
          },
        },
      },
    ],
  };

  const [rows, total] = await Promise.all([
    database.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        location: true,
        country: true,
        state: true,
        city: true,
        sentConnections: {
          where: {
            receiverId: userId,
            status: { in: [ConnectionStatus.REJECTED, ConnectionStatus.CANCELED] },
          },
          select: { status: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        receivedConnections: {
          where: {
            requesterId: userId,
            status: { in: [ConnectionStatus.REJECTED, ConnectionStatus.CANCELED] },
          },
          select: { status: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      skip,
      take,
      orderBy,
    }),
    database.user.count({ where }),
  ]);

  const suggestions: IConnectionSuggestion[] = rows.map(row => {
    const sentRelation = row.sentConnections[0] ?? null;
    const receivedRelation = row.receivedConnections[0] ?? null;

    let relationStatus: 'REJECTED' | 'CANCELED' | null = null;

    if (sentRelation && receivedRelation) {
      relationStatus =
        sentRelation.updatedAt > receivedRelation.updatedAt
          ? (sentRelation.status as 'REJECTED' | 'CANCELED')
          : (receivedRelation.status as 'REJECTED' | 'CANCELED');
    } else if (sentRelation) {
      relationStatus = sentRelation.status as 'REJECTED' | 'CANCELED';
    } else if (receivedRelation) {
      relationStatus = receivedRelation.status as 'REJECTED' | 'CANCELED';
    }

    return {
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      profilePicture: row.profilePicture,
      location: row.location,
      country: row.country,
      state: row.state,
      city: row.city,
      relationStatus,
    };
  });

  return createPaginationResult(suggestions, total, pagination);
};

export const ConnectionRepository = {
  getUserById,
  findConnectionBetweenUsers,
  createConnection,
  updateConnection,
  getConnectionById,
  getReceivedPendingRequests,
  getSentPendingRequests,
  getAcceptedConnections,
  getConnectionSuggestions,
};
