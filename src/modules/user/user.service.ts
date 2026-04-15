import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { UserStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces/pagination.interface';
import ApiError from '../../utils/apiError';
import { ICreateUserPayload, IUpdateUserPayload, IUserFilters } from './user.interface';
import { UserRepository } from './user.repository';

const normalizeUsername = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._]/g, '');

const createUsernameBase = (payload: ICreateUserPayload): string => {
  const firstName = payload.firstName?.trim().toLowerCase() || '';
  const lastName = payload.lastName?.trim().toLowerCase() || '';
  const emailPrefix = payload.email?.split('@')[0]?.toLowerCase() || 'user';
  const base = normalizeUsername(`${firstName}${lastName}`) || normalizeUsername(emailPrefix);

  return base || 'user';
};

const randomDigits = (length: number): string => {
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += Math.floor(Math.random() * 10).toString();
  }
  return output;
};

const createUniqueAccountId = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const length = 8 + Math.floor(Math.random() * 5);
    const candidate = randomDigits(length);
    const exists = await UserRepository.isAccountIdExists(candidate);
    if (!exists) {
      return candidate;
    }
  }
  throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unable to generate unique account id.');
};

const resolveUsername = async (payload: ICreateUserPayload): Promise<string> => {
  const providedUsername = payload.username ? normalizeUsername(payload.username) : '';

  if (payload.username && !providedUsername) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'username format is invalid.');
  }

  if (providedUsername) {
    const exists = await UserRepository.isUsernameExists(providedUsername);
    if (exists) {
      throw new ApiError(StatusCodes.CONFLICT, 'username already in use.');
    }
    return providedUsername;
  }

  const base = createUsernameBase(payload);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : randomDigits(3 + Math.floor(Math.random() * 3));
    const candidate = `${base}${suffix}`;
    const exists = await UserRepository.isUsernameExists(candidate);
    if (!exists) {
      return candidate;
    }
  }

  throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unable to generate unique username.');
};

const prepareCreateUserPayload = async (
  payload: ICreateUserPayload
): Promise<ICreateUserPayload> => {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const username = await resolveUsername({ ...payload, email: normalizedEmail });
  const accountId = await createUniqueAccountId();

  return {
    ...payload,
    email: normalizedEmail,
    username,
    accountId,
  };
};

// Create User
const createUser = async (payload: ICreateUserPayload, _actorId?: string, _actorRole?: string) => {
  const preparedPayload = await prepareCreateUserPayload(payload);

  // check email already exists
  const emailExists = await UserRepository.isEmailExists(preparedPayload.email);
  if (emailExists) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(preparedPayload.password, 12);
  // create user
  const user = await UserRepository.createUser({
    ...preparedPayload,
    password: hashedPassword,
  });

  return user;
};

// Get All Users
const getAllUsers = async (
  actorId: string,
  actorRole: string,
  filters: IUserFilters,
  options: PaginationOptions
) => {
  if (actorRole !== 'ADMIN') {
    filters.createdById = actorId;
  }

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

export const UserService = {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  updateUserStatus,
  deleteUser,
  // Helper methods for auth
  getUserByEmail,
  getUserByIdForAuth,
  createUserFromAuth,
  updateUserPassword,
};
