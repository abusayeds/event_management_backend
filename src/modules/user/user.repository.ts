import { UserStatus } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import { ICreateUserPayload, IUpdateUserPayload, IUserFilters } from './user.interface';

// User full select
export const userFullSelect = {
  id: true,
  accountId: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  gender: true,
  birthDate: true,
  profilePicture: true,
  location: true,
  country: true,
  state: true,
  city: true,
  skills: true,
  role: true,
  status: true,
  isIndependent: true,
  createdByOwner: true,
  contributionScore: true,
};

// User list select
export const userListSelect = {
  id: true,
  accountId: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  status: true,
  createdAt: true,
  createdByOwner: true,
  role: true,
};

// Create User
const createUser = async (userData: ICreateUserPayload) => {
  const { createdById, accountId, username, birthDate, ...rest } = userData;
  if (!accountId) {
    throw new Error('accountId is required while creating user.');
  }
  if (!username) {
    throw new Error('username is required while creating user.');
  }

  return database.user.create({
    data: {
      ...rest,
      accountId,
      username,
      birthDate: new Date(birthDate),
      createdByOwner: createdById,
    },
    select: userListSelect,
  });
};

// Get User by ID
const getUserById = async (id: string) => {
  return database.user.findFirst({
    where: { id, status: { not: UserStatus.DELETED } },
    select: {
      ...userFullSelect,
      password: true,
    },
  });
};

// Get User by ID Public
const getUserByIdPublic = async (id: string) => {
  return database.user.findFirst({
    where: { id, status: { not: UserStatus.DELETED } },
    select: userFullSelect,
  });
};

// Get User by Email
const getUserByEmail = async (email: string) => {
  return database.user.findFirst({
    where: { email, status: { not: UserStatus.DELETED } },
    select: {
      ...userFullSelect,
      password: true,
    },
  });
};

// Get All Users with Filters + Pagination
const getAllUsers = async (
  filters: IUserFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: any = {};

  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = { not: UserStatus.DELETED };
  }

  // Search filter
  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { username: { contains: filters.search, mode: 'insensitive' } },
      { accountId: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.fullName) {
    where.OR = [
      ...(where.OR || []),
      { firstName: { contains: filters.fullName, mode: 'insensitive' } },
      { lastName: { contains: filters.fullName, mode: 'insensitive' } },
    ];
  }
  if (filters.email) {
    where.email = { contains: filters.email, mode: 'insensitive' };
  }
  if (filters.username) {
    where.username = { contains: filters.username, mode: 'insensitive' };
  }
  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.roleId) {
    where.role = filters.roleId;
  }
  if (filters.createdByOwner) {
    where.createdByOwner = filters.createdByOwner;
  }
  if (filters.createdById) {
    where.createdByOwner = filters.createdById;
  }

  const [users, total] = await Promise.all([
    database.user.findMany({
      where,
      select: userListSelect,
      skip,
      take,
      orderBy,
    }),
    database.user.count({ where }),
  ]);

  return createPaginationResult(users, total, pagination);
};

// Update User by ID
const updateUserById = async (id: string, data: IUpdateUserPayload) => {
  const { birthDate, ...rest } = data;

  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: {
      ...rest,
      ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
    },
    select: userListSelect,
  });
};

// Update User Status
const updateUserStatus = async (id: string, status: UserStatus) => {
  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: { status },
    select: userListSelect,
  });
};

const updateUserIndependentStatus = async (id: string, isIndependent: boolean) => {
  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: { isIndependent },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isIndependent: true,
      status: true,
      role: true,
    },
  });
};

const updateUserPasswordById = async (id: string, hashedPassword: string) => {
  return database.user.update({
    where: { id, status: { not: UserStatus.DELETED } },
    data: { password: hashedPassword },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
};

// Delete User (Hard Delete)
const deleteUserById = async (id: string) => {
  return database.user.update({
    where: { id },
    data: { status: 'DELETED' },
  });
};

// Email Exists Check 
const isEmailExists = async (email: string, excludeUserId?: string): Promise<boolean> => {
  const user = await database.user.findFirst({
    where: {
      email,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      status: { not: UserStatus.DELETED },
    },
    select: { id: true },
  });
  return !!user;
};

const isUsernameExists = async (username: string, excludeUserId?: string): Promise<boolean> => {
  const user = await database.user.findFirst({
    where: {
      username,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      status: { not: UserStatus.DELETED },
    },
    select: { id: true },
  });

  return !!user;
};

const isAccountIdExists = async (accountId: string): Promise<boolean> => {
  const user = await database.user.findFirst({
    where: { accountId, status: { not: UserStatus.DELETED } },
    select: { id: true },
  });

  return !!user;
};

// User Exists Check
const isUserExists = async (id: string): Promise<boolean> => {
  const user = await database.user.findUnique({
    where: { id, status: { not: UserStatus.DELETED } },
    select: { id: true },
  });
  return !!user;
};

export const UserRepository = {
  createUser,
  getUserById,
  getUserByIdPublic,
  getUserByEmail,
  getAllUsers,
  updateUserById,
  updateUserStatus,
  updateUserIndependentStatus,
  updateUserPasswordById,
  deleteUserById,
  isEmailExists,
  isUsernameExists,
  isAccountIdExists,
  isUserExists,
};
