import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { UserStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces/pagination.interface';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, generatePresignedUrl, uploadSingleFileToS3 } from '../../utils/s3Upload';
import { FamilyMemberRepository } from '../familyMember/familyMember.repository';
import { normalizeUsername, prepareCreateUserPayload } from './user.helpers';
import { ICreateUserPayload, IUpdateUserPayload, IUserFilters } from './user.interface';
import { UserRepository } from './user.repository';

const normalizeSkills = (skills: string[]) => {
  const cleanedSkills = skills.map(skill => skill.trim()).filter(skill => skill.length > 0);

  return Array.from(new Set(cleanedSkills));
};

// Create User
const createUser = async (payload: ICreateUserPayload, actorId?: string) => {
  // Step:1 Prepare payload with normalized email, username, and account ID
  const preparedPayload = await prepareCreateUserPayload(payload);
  const createdByOwner = actorId ?? payload.createdById;

  // Step:2 Check if email already exists in database
  const emailExists = await UserRepository.isEmailExists(preparedPayload.email);
  if (emailExists) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
  }

  // Step:3 Hash password with bcrypt
  const hashedPassword = await bcrypt.hash(preparedPayload.password, 12);

  // Step:4 Create user in database with prepared data
  const user = await UserRepository.createUser({
    ...preparedPayload,
    createdById: createdByOwner,
    password: hashedPassword,
  });

  // Step:5 Return created user
  return user;
};

// Get All Users
const getAllUsers = async (filters: IUserFilters, options: PaginationOptions) => {
  // Step:1 Fetch users from repository with filters and pagination
  return UserRepository.getAllUsers(filters, options);
};

// Get Single User
const getUserById = async (id: string) => {
  // Step:1 Fetch user from repository (public fields only)
  const user = await UserRepository.getUserByIdPublic(id);
  // Step:2 Throw error if user not found
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }
  // Step:3 Return user
  return user;
};

const getMyProfile = async (userId: string) => {
  // Step:1 Fetch authenticated user profile (public fields only)
  const user = await UserRepository.getUserByIdPublic(userId);
  // Step:2 Throw error if user not found
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }
  // Step:3 Return user profile
  return user;
};

const updateMyProfile = async (
  userId: string,
  payload: IUpdateUserPayload,
  file?: Express.Multer.File
) => {
  // Step:1 Check user exists
  const user = await UserRepository.getUserById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Step:2 Block family-managed members from editing their own profile
  if (!user.hasSeparateAccount) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your profile is managed by your family owner. You cannot edit it until your account is activated.'
    );
  }

  // ✅ Step:3 Check email uniqueness
  if (payload.email) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const emailExists = await UserRepository.isEmailExists(normalizedEmail, userId);
    if (emailExists) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
    }
    payload.email = normalizedEmail;
  }

  // ✅ Step:4 Check username uniqueness
  if (payload.username) {
    const normalizedUsername = normalizeUsername(payload.username);
    if (!normalizedUsername) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'username format is invalid.');
    }
    const usernameExists = await UserRepository.isUsernameExists(normalizedUsername, userId);
    if (usernameExists) {
      throw new ApiError(StatusCodes.CONFLICT, 'username already in use.');
    }
    payload.username = normalizedUsername;
  }

  // ✅ Step:5 Normalize skills
  if (payload.skills) {
    payload.skills = normalizeSkills(payload.skills);
  }

  // Step:6 Handle profile picture upload
  let profilePictureUrl: string | undefined;
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'profiles');
    profilePictureUrl = uploaded?.url;
    // Step:7 Delete old profile picture from S3 if exists
    if (user?.profilePicture) {
      await deleteFileFromS3(user.profilePicture);
    }
  }

  // Step:8 Prepare update payload with profile picture URL
  payload = {
    ...payload,
    profilePicture: profilePictureUrl,
  };

  // Step:9 Update user in database
  return UserRepository.updateUserById(userId, payload);
};

// Update User
const updateUser = async (
  id: string,
  payload: IUpdateUserPayload,
  actorId: string,
  actorRole: string,
  file?: Express.Multer.File | undefined
) => {
  //Step:1 Check target user exists
  const existing = await UserRepository.getUserById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Step:2 Check actor user exists
  const actor = await UserRepository.getUserById(actorId);
  if (!actor) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Actor user not found.');
  }

  // Step:3 Determine if actor is admin or updating self
  const isAdmin = actorRole === 'ADMIN';
  const isSelfUpdate = id === actorId;

  // Step:4 If not admin and not self, check family ownership for authorization
  if (!isAdmin && !isSelfUpdate) {
    const ownerControlsTarget = await FamilyMemberRepository.isOwnerOfMember(actorId, id);
    if (!ownerControlsTarget) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Only admins, yourself, or your family owner can update this profile.'
      );
    }

    // Step:5 Prevent owner from updating independent users
    if (existing.hasSeparateAccount) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Independent users can only update their own profile.'
      );
    }
  }

  // Step:6 Prevent non-admin/self from changing independence status
  if (payload.hasSeparateAccount !== undefined && !isAdmin && !isSelfUpdate) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Only the user or an admin can change independent status.'
    );
  }

  // Step:7 Check email uniqueness if updating email
  if (payload.email) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const emailExists = await UserRepository.isEmailExists(normalizedEmail, id);
    if (emailExists) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already in use.');
    }
    payload.email = normalizedEmail;
  }

  // Step:8 Check username uniqueness if updating username
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

  // Step:9 Normalize skills array if updating
  if (payload.skills) {
    payload.skills = normalizeSkills(payload.skills);
  }

  // Step:10 Handle profile picture upload if file provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'profiles');
    payload.profilePicture = uploaded.url;
    // Step:11 Delete old profile picture from S3
    if (existing.profilePicture) {
      await deleteFileFromS3(existing.profilePicture);
    }
  }

  // Step:12 Validate at least one field is provided
  if (Object.keys(payload).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one field is required to update user.');
  }

  // Step:13 Update user in database
  const updated = await UserRepository.updateUserById(id, payload);
  return updated;
};

const updateUserStatus = async (id: string, status: UserStatus, actorId: string) => {
  // Step:1 Check user exists
  const existing = await UserRepository.getUserById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Step:2 Prevent user from changing own status
  if (id === actorId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot change your own status.');
  }

  // Step:3 Update user status in database
  const updated = await UserRepository.updateUserStatus(id, status);
  return updated;
};

const calculateAge = (birthDate: Date): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const updateUserIndependentStatus = async (
  userId: string,
  hasSeparateAccount: boolean,
  actorId: string,
  options?: {
    allowOwnerOverride?: boolean;
  }
) => {
  // Step:1 Check user exists
  const existing = await UserRepository.getUserById(userId);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Step:2 Determine if update is self or owner override
  const isSelfUpdate = userId === actorId;

  if (isSelfUpdate) {
    // Step:3 Self-activation requires user to be 18 or older
    if (hasSeparateAccount) {
      const age = calculateAge(existing.birthDate);
      if (age < 18) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'You must be 18 or older to activate your independent account.'
        );
      }
    }
  } else {
    // Step:4 Verify owner override is allowed
    if (!options?.allowOwnerOverride) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'You can only update your own independence status.'
      );
    }

    // Step:5 Check if actor is family owner of target
    const ownerControlsTarget = await FamilyMemberRepository.isOwnerOfMember(actorId, userId);
    if (!ownerControlsTarget) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Only family owner can update this user independent status.'
      );
    }

    // Step:6 Prevent owner from re-controlling an already-independent user
    if (existing.hasSeparateAccount) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'User is already independent and cannot be controlled by owner.'
      );
    }
  }

  // Step:7 Update independence status in database
  return UserRepository.updateUserIndependentStatus(userId, hasSeparateAccount);
};

// Delete User
const deleteUser = async (id: string, actorId: string, actorRole: string) => {
  // Step:1 Check if actor is admin
  const isAdmin = actorRole === 'ADMIN';

  // Step:2 Prevent non-admin from deleting other users
  if (!isAdmin && id !== actorId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own account.');
  }

  // Step:3 Check user exists
  const existing = await UserRepository.getUserById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  // Step:4 Soft delete user (set status to DELETED)
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
