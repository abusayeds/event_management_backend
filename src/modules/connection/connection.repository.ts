import { ConnectionStatus, UserStatus } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
    createPaginationQuery,
    createPaginationResult,
    PaginationOptions,
    PaginationResult,
    parsePaginationOptions,
} from '../../utils/paginate';
import { IConnection } from './connection.interface';

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

const findAnyBetweenUsers = async (userAId: string, userBId: string) => {
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

const getIncomingPendingRequests = async (
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

const getOutgoingPendingRequests = async (
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

export const ConnectionRepository = {
  getUserById,
  findAnyBetweenUsers,
  createConnection,
  updateConnection,
  getConnectionById,
  getIncomingPendingRequests,
  getOutgoingPendingRequests,
  getAcceptedConnections,
};
