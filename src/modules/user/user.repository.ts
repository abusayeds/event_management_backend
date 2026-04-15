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
const userFullSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  password: true,
  gender: true,
  birthdate: true,
  profilePicture: true,
  location: true,
  country: true,
  state: true,
  city: true,
  skills: true,
  relationShip: true,
  role: true,
  status: true,
  isIndependent: true,
  isEmailVerified: true,
  createdByOwner: true,
  contributionScore: true,
};

// User list select
const userListSelect = {
  id: true,
  fullName: true,
  email: true,
  status: true,
  createdAt: true,
  createdById: true,
  role: true,
};

// Create User
const createUser = async (userData: ICreateUserPayload) => {
  return database.user.create({
    data: userData,
    select: userListSelect,
  });
};

// Get User by ID
const getUserById = async (id: string) => {
  return database.user.findFirst({
    where: { id },
    select: {
      ...userFullSelect,
      password: true,
    },
  });
};

// Get User by ID Public
const getUserByIdPublic = async (id: string) => {
  return database.user.findFirst({
    where: { id },
    select: userFullSelect,
  });
};

// Get User by Email
const getUserByEmail = async (email: string) => {
  return database.user.findFirst({
    where: { email },
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

  // Search filter
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.fullName) {
    where.fullName = { contains: filters.fullName, mode: 'insensitive' };
  }
  if (filters.email) {
    where.email = { contains: filters.email, mode: 'insensitive' };
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.roleId) {
    where.roleId = filters.roleId;
  }
  if (filters.createdById) {
    where.createdById = filters.createdById;
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
  return database.user.update({
    where: { id },
    data,
    select: userListSelect,
  });
};

// Update User Status
const updateUserStatus = async (id: string, status: UserStatus) => {
  return database.user.update({
    where: { id },
    data: { status },
    select: userListSelect,
  });
};

const updateUserPasswordById = async (id: string, hashedPassword: string) => {
  return database.user.update({
    where: { id },
    data: { password: hashedPassword },
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  });
};

// Delete User (Hard Delete)
const deleteUserById = async (id: string) => {
  return database.user.delete({
    where: { id },
  });
};

// Email Exists Check
const isEmailExists = async (email: string, excludeUserId?: string): Promise<boolean> => {
  const user = await database.user.findFirst({
    where: {
      email,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return !!user;
};

// User Exists Check
const isUserExists = async (id: string): Promise<boolean> => {
  const user = await database.user.findUnique({
    where: { id },
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
  updateUserPasswordById,
  deleteUserById,
  isEmailExists,
  isUserExists,
};
