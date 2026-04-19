import { database } from '../../config/database';
import { ICreateFamilyPayload, IFamilyFilters } from './family.interface';
import { PaginationOptions } from '../../interfaces';
import { createPaginationQuery, parsePaginationOptions } from '../../utils';

const createFamily = async (payload: ICreateFamilyPayload) => {
  const family = await database.family.create({
    data: {
      name: payload.name,
      description: payload.description,
      createdBy: payload.createdBy,
      familyMembers: {
        create: {
          userId: payload.familyMembers.userId,
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
    userId,
  };

  if (filters.searchTerm) {
    where.OR = [{ family: { name: { contains: filters.searchTerm, mode: 'insensitive' } } }];
  }

  const [families, total] = await Promise.all([
    database.familyMember.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        family: true,
      },
    }),
    database.family.count({ where }),
  ]);

  return {
    data: families,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
};

const getFamily = async (familyId: string) => {
  const family = await database.family.findUnique({
    where: {
      id: familyId,
      isDeleted: false,
    },
    include: {
      familyMembers: {
        include: {
          user: true,
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
