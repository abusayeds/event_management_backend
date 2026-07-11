import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { UserGender, UserStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces/pagination.interface';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, generatePresignedUrl, uploadSingleFileToS3 } from '../../utils/s3Upload';
import { FamilyMemberRepository } from '../familyMember/familyMember.repository';
import {
  buildStartYearOptions,
  isStartYearAllowed,
  normalizeUsername,
  parseLegacySkillLabel,
  prepareCreateUserPayload,
  toSkillResponse,
} from './user.helpers';
import { ICreateUserPayload, IUpdateUserPayload, IUserFilters, IUserSkillInput } from './user.interface';
import { UserRepository } from './user.repository';

const shapeUserProfile = (user: Record<string, unknown>) => {
  const userSkills = Array.isArray(user.userSkills)
    ? (user.userSkills as Array<{
        id: string;
        programId: string | null;
        programName: string;
        startYear: number;
      }>).map(toSkillResponse)
    : [];

  const legacySkills = Array.isArray(user.skills) ? (user.skills as string[]) : [];

  const skills =
    userSkills.length > 0
      ? userSkills
      : legacySkills
          .map(parseLegacySkillLabel)
          .filter((s): s is IUserSkillInput => s !== null)
          .map((s, index) =>
            toSkillResponse({
              id: `legacy-${index}`,
              programId: null,
              programName: (s.program || '').trim(),
              startYear: s.startYear,
            })
          );

  return {
    ...user,
    skills,
    skillLabels: skills.map(s => s.label),
  };
};

const resolveSkillInputs = async (
  rawSkills: NonNullable<IUpdateUserPayload['skills']>
): Promise<Array<IUserSkillInput & { programName: string; programId: string | null }>> => {
  const inputs: IUserSkillInput[] = [];

  for (const item of rawSkills) {
    if (typeof item === 'string') {
      const parsed = parseLegacySkillLabel(item);
      if (parsed) {
        inputs.push(parsed);
      }
      continue;
    }
    inputs.push(item);
  }

  const resolved: Array<IUserSkillInput & { programName: string; programId: string | null }> = [];
  const seen = new Set<string>();

  for (const skill of inputs) {
    if (!isStartYearAllowed(skill.startYear)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `startYear must be within the last 100 years (up to ${new Date().getFullYear()}).`
      );
    }

    let programId: string | null = null;
    let programName = '';

    if (skill.programId?.trim()) {
      const program = await UserRepository.getProgramById(skill.programId.trim());
      if (!program) {
        throw new ApiError(StatusCodes.NOT_FOUND, `Program not found: ${skill.programId}`);
      }
      programId = program.id;
      programName = program.name;
    } else {
      const name = skill.program?.trim() || skill.skill?.trim();
      if (!name) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          'Each skill requires programId, program, or skill name.'
        );
      }
      const program = await UserRepository.findOrCreateProgramByName(name);
      programId = program.id;
      programName = program.name;
    }

    const key = programName.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    resolved.push({
      ...skill,
      programId,
      programName,
      startYear: skill.startYear,
    });
  }

  return resolved;
};

const applySkillsUpdate = async (userId: string, rawSkills: NonNullable<IUpdateUserPayload['skills']>) => {
  const resolved = await resolveSkillInputs(rawSkills);
  await UserRepository.replaceUserSkills(userId, resolved);
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
  // Step:3 Return user (raw public fields for auth/admin consumers)
  return user;
};

const getMyProfile = async (userId: string) => {
  // Step:1 Fetch authenticated user profile (public fields only)
  const user = await UserRepository.getUserByIdPublic(userId);
  // Step:2 Throw error if user not found
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.');
  }
  // Step:3 Return edit-account shaped profile
  return shapeUserProfile(user as unknown as Record<string, unknown>);
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

  const skillsPayload = payload.skills;
  delete payload.skills;

  // Step:6 Handle profile picture upload
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'profiles');
    if (uploaded?.url) {
      payload.profilePicture = uploaded.url;
      if (user?.profilePicture) {
        await deleteFileFromS3(user.profilePicture);
      }
    }
  } else {
    delete payload.profilePicture;
  }

  // Step:8 Update scalar profile fields (displayName, phoneNumber, etc.)
  await UserRepository.updateUserById(userId, payload);

  // Step:9 Replace skills when provided (program find-or-create + startYear last 100 years)
  if (skillsPayload !== undefined) {
    await applySkillsUpdate(userId, skillsPayload);
  }

  const refreshed = await UserRepository.getUserByIdPublic(userId);
  return shapeUserProfile(refreshed as unknown as Record<string, unknown>);
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

  // Step:9 Normalize / replace skills if updating
  const skillsPayload = payload.skills;
  delete payload.skills;

  // Step:10 Handle profile picture upload if file provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'profiles');
    payload.profilePicture = uploaded.url;
    // Step:11 Delete old profile picture from S3
    if (existing.profilePicture) {
      await deleteFileFromS3(existing.profilePicture);
    }
  }

  // Step:12 Update user in database
  await UserRepository.updateUserById(id, payload);

  if (skillsPayload !== undefined) {
    await applySkillsUpdate(id, skillsPayload);
  }

  const refreshed = await UserRepository.getUserByIdPublic(id);
  return shapeUserProfile(refreshed as unknown as Record<string, unknown>);
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

const getEditOptions = async () => {
  const programs = await UserRepository.listActivePrograms();
  return {
    startYears: buildStartYearOptions(),
    programs,
    genders: [
      { value: UserGender.MALE, label: 'Male' },
      { value: UserGender.FEMALE, label: 'Female' },
      { value: UserGender.OTHER, label: 'Other' },
    ],
  };
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
  getEditOptions,
  // Helper methods for auth
  getUserByEmail,
  getUserByIdForAuth,
  createUserFromAuth,
  updateUserPassword,
  checkUsernameExists,
  // Presigned URL (Future)
  getProfilePicturePresignedUrl,
};
