import { FamilyRelationShip, FamilyRole } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { PaginationOptions } from '../../interfaces';
import { createPaginationQuery, createPaginationResult, parsePaginationOptions } from '../../utils';
import { ICreateFamilyMemberPayload, IFamilyMemberFilters } from './familyMember.interface';

const addFamilyMember = async (payload: ICreateFamilyMemberPayload) => {
  const familyMember = await database.familyMember.create({
    data: {
      familyId: payload.familyId,
      userId: payload.userId,
      role: payload.role,
      relationShip: payload.relationShip,
    },
  });
  return familyMember;
};

const getFamilyMemberByFamilyAndUser = async (familyId: string, userId: string) => {
  return database.familyMember.findFirst({
    where: {
      familyId,
      userId,
    },
  });
};

const getFamilyMemberByFamilyAndEmail = async (familyId: string, email: string) => {
  return database.familyMember.findFirst({
    where: {
      familyId,
      user: {
        email,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
};

const updateMemberRole = async (familyId: string, userId: string, role: FamilyRole) => {
  const familyMember = await database.familyMember.updateMany({
    where: {
      familyId,
      userId,
    },
    data: {
      role,
    },
  });
  return familyMember;
};

const removeFamilyMember = async (familyId: string, userId: string) => {
  const familyMember = await database.familyMember.deleteMany({
    where: {
      familyId,
      userId,
    },
  });
  return familyMember;
};

const getFamilyMembersByFamilyId = async (
  familyId: string,
  filters: IFamilyMemberFilters,
  options: PaginationOptions
) => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = {
    familyId,
    ...(filters.role ? { role: filters.role } : {}),
  };

  const [familyMembers, total] = await Promise.all([
    database.familyMember.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    }),
    database.familyMember.count({ where }),
  ]);

  return createPaginationResult(familyMembers, total, pagination);
};

const isOwnerOfMember = async (ownerUserId: string, memberUserId: string): Promise<boolean> => {
  const membership = await database.familyMember.findFirst({
    where: {
      userId: ownerUserId,
      role: FamilyRole.OWNER,
      family: {
        isDeleted: false,
        familyMembers: {
          some: {
            userId: memberUserId,
          },
        },
      },
    },
    select: { id: true },
  });

  return !!membership;
};

const areUsersInSameFamily = async (userA: string, userB: string): Promise<boolean> => {
  if (userA === userB) {
    return true;
  }
  const aFamilies = await database.familyMember.findMany({
    where: { userId: userA, family: { isDeleted: false } },
    select: { familyId: true },
  });
  if (aFamilies.length === 0) {
    return false;
  }
  const familyIds = aFamilies.map(m => m.familyId);
  const shared = await database.familyMember.findFirst({
    where: { userId: userB, familyId: { in: familyIds }, family: { isDeleted: false } },
    select: { id: true },
  });
  return !!shared;
};

const listCreatorUserIdsForFamilyRelationFeed = async (
  viewerId: string,
  relationShip: FamilyRelationShip
): Promise<string[]> => {
  if (relationShip === FamilyRelationShip.Self) {
    return [viewerId];
  }

  const myFamilies = await database.familyMember.findMany({
    where: { userId: viewerId, family: { isDeleted: false } },
    select: { familyId: true },
  });
  const familyIds = [...new Set(myFamilies.map(m => m.familyId))];
  if (familyIds.length === 0) {
    return [];
  }

  const rows = await database.familyMember.findMany({
    where: {
      familyId: { in: familyIds },
      userId: { not: viewerId },
      relationShip,
      family: { isDeleted: false },
    },
    select: { userId: true },
  });

  return [...new Set(rows.map(r => r.userId))];
};

export const FamilyMemberRepository = {
  addFamilyMember,
  getFamilyMemberByFamilyAndUser,
  getFamilyMemberByFamilyAndEmail,
  updateMemberRole,
  removeFamilyMember,
  getFamilyMembersByFamilyId,
  isOwnerOfMember,
  areUsersInSameFamily,
  listCreatorUserIdsForFamilyRelationFeed,
};
