import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { UserStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces/pagination.interface';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, generatePresignedUrl, uploadSingleFileToS3 } from '../../utils/s3Upload';
import { normalizeUsername, prepareCreateUserPayload } from './user.helpers';
import { ICreateUserPayload, IUpdateUserPayload, IUserFilters } from './user.interface';
import { UserRepository } from './user.repository';

const normalizeSkills = (skills: string[]) => {
  const cleanedSkills = skills.map(skill => skill.trim()).filter(skill => skill.length > 0);

  return Array.from(new Set(cleanedSkills));
};

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

const getMyProfile = async (userId: string) => {
  const user = await UserRepository.getUserByIdPublic(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }
  return user;
};

const updateMyProfile = async (
  userId: string,
  payload: IUpdateUserPayload,
  file?: Express.Multer.File
) => {
  // Step 1 : Check user  exist
  const user = await UserRepository.getUserById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }
  // Step 2 : Handle profile picture upload if file is provided
  let profilePictureUrl: string | undefined;
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'profiles');
    profilePictureUrl = uploaded?.url;
    // Delete old profile picture from S3 if exists
    if (user?.profilePicture) {
      await deleteFileFromS3(user.profilePicture);
    }
  }
  // Step 3 : Prepare update payload
  payload = {
    ...payload,
    profilePicture: profilePictureUrl,
  };

  if (Object.keys(payload).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one field is required to update user.');
  }
  return UserRepository.updateUserById(userId, payload);
};

// Update User
const updateUser = async (
  id: string,
  payload: IUpdateUserPayload,
  actorId: string,
  file?: Express.Multer.File | undefined
) => {
  //Step 1 : User existence check
  const existing = await UserRepository.getUserById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Step 2 : Check actor existence
  const actor = await UserRepository.getUserById(actorId);
  if (!actor) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Actor user not found.');
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

  if (payload.skills) {
    payload.skills = normalizeSkills(payload.skills);
  }

  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'profiles');
    payload.profilePicture = uploaded.url;

    if (existing.profilePicture) {
      await deleteFileFromS3(existing.profilePicture);
    }
  }
  if (Object.keys(payload).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one field is required to update user.');
  }
  const updated = await UserRepository.updateUserById(id, payload);
  return updated;
};

const updateUserStatus = async (id: string, status: UserStatus, actorId: string) => {
  // User existence check
  const existing = await UserRepository.getUserById(id);
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
  const existing = await UserRepository.getUserById(userId);
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
const deleteUser = async (id: string) => {
  // User existence check
  const existing = await UserRepository.getUserById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
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

// METHOD 2: Presigned URL (Future)
const getProfilePicturePresignedUrl = async (
  userId: string,
  fileName: string,
  mimeType: string
) => {
  // User existence check
  const existing = await UserRepository.isUserExists(userId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Validate mime type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(mimeType)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid file type. Only JPG, PNG, and WEBP are allowed.'
    );
  }
  return generatePresignedUrl(fileName, mimeType, 'profiles');
};

export const UserService = {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  updateUserStatus,
  updateUserIndependentStatus,
  deleteUser,
  getMyProfile,
  updateMyProfile,
  // Helper methods for auth
  getUserByEmail,
  getUserByIdForAuth,
  createUserFromAuth,
  updateUserPassword,
  checkUsernameExists,
  // Presigned URL (Future)
  getProfilePicturePresignedUrl,
};
