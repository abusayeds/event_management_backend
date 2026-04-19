import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { UserStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces/pagination.interface';
import ApiError from '../../utils/apiError';
import { normalizeUsername, prepareCreateUserPayload } from './user.helpers';
import { ICreateUserPayload, IUpdateUserPayload, IUserFilters } from './user.interface';
import { UserRepository } from './user.repository';

// Create User
const createUser = async (payload: ICreateUserPayload, actorId?: string) => {
  const preparedPayload = await prepareCreateUserPayload(payload);
  const createdByOwner = actorId ?? payload.createdById;

  // check email already exists
  const emailExists = await UserRepository.isEmailExists(preparedPayload.email);
  if (emailExists) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
  }

  // Hash password (skip if already hashed - prevents double hashing)
  const hashedPassword = await bcrypt.hash(preparedPayload.password, 12);

  // create user
  const user = await UserRepository.createUser({
    ...preparedPayload,
    createdById: createdByOwner,
    password: hashedPassword,
  });

  return user;
};

// Get All Users
const getAllUsers = async (filters: IUserFilters, options: PaginationOptions) => {
  return UserRepository.getAllUsers(filters, options);
};

// Get Single User
const getUserById = async (id: string) => {
  const user = await UserRepository.getUserByIdPublic(id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }
  return user;
};

// Update User
const updateUser = async (id: string, payload: IUpdateUserPayload, _actorId: string) => {
  // User existence check
  const existing = await UserRepository.isUserExists(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // when email update check if the new email is already taken by another user
  if (payload.email) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const emailExists = await UserRepository.isEmailExists(normalizedEmail, id);
    if (emailExists) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
    }

    payload.email = normalizedEmail;
  }

  if (payload.username) {
    const normalizedUsername = normalizeUsername(payload.username);

    if (!normalizedUsername) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'username format is invalid.');
    }

    const usernameExists = await UserRepository.isUsernameExists(normalizedUsername, id);
    if (usernameExists) {
      throw new ApiError(StatusCodes.CONFLICT, 'username already in use.');
    }

    payload.username = normalizedUsername;
  }

  const updated = await UserRepository.updateUserById(id, payload);

  return updated;
};

const updateUserStatus = async (id: string, status: UserStatus, actorId: string) => {
  // User existence check
  const existing = await UserRepository.isUserExists(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Self user status change check
  if (id === actorId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot change your own status.');
  }
  const updated = await UserRepository.updateUserStatus(id, status);
  return updated;
};

const updateUserIndependentStatus = async (
  userId: string,
  isIndependent: boolean,
  actorId: string
) => {
  // User existence check
  const existing = await UserRepository.isUserExists(userId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Self-only toggle for owner flow
  if (userId !== actorId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only update your own independence status.');
  }

  return UserRepository.updateUserIndependentStatus(userId, isIndependent);
};

// Delete User
const deleteUser = async (id: string, actorId: string) => {
  // User existence check
  const existing = await UserRepository.isUserExists(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // You cannot delete your own account check
  if (id === actorId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot delete your own account.');
  }

  await UserRepository.deleteUserById(id);
};

// Helper methods for auth service
const getUserByEmail = async (email: string) => {
  return UserRepository.getUserByEmail(email);
};

const getUserByIdForAuth = async (id: string) => {
  return UserRepository.getUserById(id);
};

const createUserFromAuth = async (userData: ICreateUserPayload) => {
  return createUser(userData);
};

const updateUserPassword = async (userId: string, hashedPassword: string) => {
  return UserRepository.updateUserPasswordById(userId, hashedPassword);
};

const checkUsernameExists = async (username: string, excludeUserId?: string): Promise<boolean> => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'username format is invalid.');
  }
  return UserRepository.isUsernameExists(normalizedUsername, excludeUserId);
};

export const UserService = {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  updateUserStatus,
  updateUserIndependentStatus,
  deleteUser,
  // Helper methods for auth
  getUserByEmail,
  getUserByIdForAuth,
  createUserFromAuth,
  updateUserPassword,
  checkUsernameExists,
};
