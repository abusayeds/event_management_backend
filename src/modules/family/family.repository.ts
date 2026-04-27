import { FamilyRelationShip } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { PaginationOptions } from '../../interfaces';
import { createPaginationQuery, createPaginationResult, parsePaginationOptions } from '../../utils';
import { ICreateFamilyPayload, IFamilyFilters } from './family.interface';

const createFamily = async (payload: ICreateFamilyPayload) => {
  const family = await database.family.create({
    data: {
      name: payload.name,
      description: payload.description,
      createdBy: payload.createdBy,
      familyMembers: {
        create: {
          userId: payload.familyMembers.userId,
          relationShip: FamilyRelationShip.Self,
          role: payload.familyMembers.role,
        },
      },
    },
  });
  return family;
};

const getMyFamilies = async (
  userId: string,
  filters: IFamilyFilters,
  options: PaginationOptions
) => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: any = {
    isDeleted: false,
    familyMembers: {
      some: {
        userId,
      },
    },
  };

  if (filters.searchTerm) {
    where.name = {
      contains: filters.searchTerm,
      mode: 'insensitive',
    };
  }

  const [families, total] = await Promise.all([
    database.family.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        creator: {
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
    database.family.count({ where }),
  ]);

  return createPaginationResult(families, total, pagination);
};

const getFamily = async (familyId: string) => {
  const family = await database.family.findUnique({
    where: {
      id: familyId,
      isDeleted: false,
    },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePicture: true,
        },
      },
    },
  });
  return family;
};
const getFamilyByName = async (name: string) => {
  const family = await database.family.findFirst({
    where: {
      name,
      isDeleted: false,
    },
  });
  return family;
};

const updateFamily = async (familyId: string, payload: Partial<ICreateFamilyPayload>) => {
  const family = await database.family.update({
    where: {
      id: familyId,
    },
    data: {
      name: payload.name,
      description: payload.description,
    },
  });
  return family;
};

const deleteFamily = async (familyId: string) => {
  const family = await database.family.update({
    where: {
      id: familyId,
    },
    data: {
      isDeleted: true,
    },
  });
  return family;
};

export const FamilyRepository = {
  createFamily,
  getMyFamilies,
  getFamily,
  updateFamily,
  deleteFamily,
  getFamilyByName,
};
