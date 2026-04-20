import { FamilyRole } from '../../../prisma/generated/enums';
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

  const where: any = {
    familyId,
  };
  if (filters.role) {
    where.role = filters.role;
  }

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

export const FamilyMemberRepository = {
  addFamilyMember,
  getFamilyMemberByFamilyAndUser,
  getFamilyMemberByFamilyAndEmail,
  updateMemberRole,
  removeFamilyMember,
  getFamilyMembersByFamilyId,
  isOwnerOfMember,
};
