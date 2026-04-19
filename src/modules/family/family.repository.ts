import { IFilterOptions, IQueryParams } from './../../interfaces/api.interface';
import { database } from '../../config/database';
import { ICreateFamilyPayload, IFamily } from './family.interface';
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
  filters: IFilterOptions,
  options: PaginationOptions
) => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where: any = {
    createdBy: userId,
    isDeleted: false,
  };
  const [families, total] = await Promise.all([
    database.family.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        familyMembers: {
          where: {
            userId,
          },
        },
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
