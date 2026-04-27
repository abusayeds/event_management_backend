import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { FamilyRole } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { FamilyRepository } from '../family/family.repository';
import { prepareCreateUserPayload } from '../user/user.helpers';
import { UserRepository, userListSelect } from '../user/user.repository';
import { UserService } from '../user/user.service';
import {
  IAddFamilyMemberWithUserPayload,
  IAddFamilyOwnerPayload,
  IFamilyMemberFilters,
} from './familyMember.interface';
import { FamilyMemberRepository } from './familyMember.repository';

const addFamilyMember = async (actorId: string, payload: IAddFamilyMemberWithUserPayload) => {
  const { familyId, role, relationShip, ...userPayload } = payload;

  // Step:1 Ensure family exists
  const family = await FamilyRepository.getFamily(familyId);
  if (!family) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found.');
  }

  // Step:2 Only family owner can add members
  const actorMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    actorId
  );
  if (!actorMembership || actorMembership.role !== FamilyRole.OWNER) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only family owner can add members.');
  }

  // Step:3 Check existing user by email
  const normalizedEmail = userPayload.email.trim().toLowerCase();
  const existingUser = await UserRepository.getUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'A user with this email already exists.');
  }

  // Step:4 Prepare all non-DB work before the transaction (username/accountId generation, hashing)
  const preparedPayload = await prepareCreateUserPayload({
    ...userPayload,
    email: normalizedEmail,
    isIndependent: false,
    isEmailVerified: true,
  });
  const hashedPassword = await bcrypt.hash(preparedPayload.password, 12);

  // Step:5 Atomically create user + family member in a single transaction
  const { createdById: _createdById, accountId, username, birthDate, password: _plainPass, ...userRest } = preparedPayload;

  const result = await database.$transaction(async tx => {
    const createdUser = await tx.user.create({
      data: {
        ...userRest,
        accountId: accountId!,
        username: username!,
        birthDate: new Date(birthDate),
        createdByOwner: actorId,
        password: hashedPassword,
      },
      select: userListSelect,
    });

    const familyMember = await tx.familyMember.create({
      data: {
        familyId,
        userId: createdUser.id,
        role: role ?? FamilyRole.MEMBER,
        relationShip,
      },
    });

    return { familyMember, user: createdUser };
  });

  return result;
};

const getFamilyMembersByFamilyId = async (
  actorId: string,
  familyId: string,
  filters: IFamilyMemberFilters,
  options: PaginationOptions
) => {
  // Step:1 Ensure family exists
  const family = await FamilyRepository.getFamily(familyId);
  if (!family) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found.');
  }

  // Step:2 Ensure requester is a member of this family
  const actorMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    actorId
  );
  if (!actorMembership) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a member of this family.');
  }

  // Step:3 Fetch family members with filters and pagination
  return FamilyMemberRepository.getFamilyMembersByFamilyId(familyId, filters, options);
};

const removeFamilyMember = async (actorId: string, familyId: string, userId: string) => {
  // Step:1 Ensure family exists
  const family = await FamilyRepository.getFamily(familyId);
  if (!family) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found.');
  }

  // Step:2 Only owner can remove members
  const actorMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    actorId
  );
  if (!actorMembership || actorMembership.role !== FamilyRole.OWNER) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only family owner can remove members.');
  }

  // Step:3 Prevent self-remove for owner
  if (actorId === userId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Owner cannot remove self. Transfer ownership first.'
    );
  }

  // Step:4 Ensure target membership exists
  const targetMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    userId
  );
  if (!targetMembership) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family member not found.');
  }

  // Step:5 Remove family member from database
  return FamilyMemberRepository.removeFamilyMember(familyId, userId);
};

const addFamilyOwner = async (actorId: string, payload: IAddFamilyOwnerPayload) => {
  const { familyId, newOwnerUserId } = payload;

  // Step:1 Ensure family exists
  const family = await FamilyRepository.getFamily(familyId);
  if (!family) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found.');
  }
  // Step:2 Ensure requester is current owner
  const actorMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    actorId
  );
  if (!actorMembership || actorMembership.role !== FamilyRole.OWNER) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only current owner can add another owner.');
  }

  // Step:3 Prevent no-op transfer
  if (actorId === newOwnerUserId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You are already the owner.');
  }

  // Step:4 New owner must be a member
  const newOwnerMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    newOwnerUserId
  );
  if (!newOwnerMembership) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Target user is not a family member.');
  }

  // Step:5 Promote the target member to OWNER and keep current owner as OWNER
  await FamilyMemberRepository.updateMemberRole(familyId, newOwnerUserId, FamilyRole.OWNER);

  // Step:6 Return previous and new owner IDs
  return {
    previousOwnerUserId: actorId,
    newOwnerUserId,
  };
};

const updateOwnerIndependentStatus = async (
  actorId: string,
  familyId: string,
  targetUserId: string,
  isIndependent: boolean
) => {
  // Step:1 Ensure family exists
  const family = await FamilyRepository.getFamily(familyId);
  if (!family) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found.');
  }

  // Step:2 Ensure requester is current owner
  const actorMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    actorId
  );
  if (!actorMembership || actorMembership.role !== FamilyRole.OWNER) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only family owner can update independence status.');
  }

  // Step:3 Ensure target user is a member in this family
  const targetMembership = await FamilyMemberRepository.getFamilyMemberByFamilyAndUser(
    familyId,
    targetUserId
  );
  if (!targetMembership) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Target user is not a family member.');
  }

  // Step:4 Ensure target is an OWNER (only owners can have independence status changed)
  if (targetMembership.role !== FamilyRole.OWNER) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Independence status can only be updated for family owners.'
    );
  }

  // Step:5 Update owner's independence status via UserService
  return UserService.updateUserIndependentStatus(targetUserId, isIndependent, actorId, {
    allowOwnerOverride: true,
  });
};

export const FamilyMemberService = {
  addFamilyMember,
  getFamilyMembersByFamilyId,
  removeFamilyMember,
  addFamilyOwner,
  updateOwnerIndependentStatus,
};
