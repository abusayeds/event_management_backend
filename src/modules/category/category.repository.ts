import { database } from '../../config/database';
import {
    createPaginationQuery,
    createPaginationResult,
    PaginationOptions,
    PaginationResult,
    parsePaginationOptions,
} from '../../utils/paginate';
import {
    ICategory,
    ICategoryFilters,
    ICreateCategoryPayload,
    IUpdateCategoryPayload,
} from './category.interface';

// Category list select
export const categoryListSelect = {
  id: true,
  name: true,
  imageUrl: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

// Category full select
export const categoryFullSelect = {
  id: true,
  name: true,
  imageUrl: true,
  description: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

// Create category
const createCategory = async (payload: ICreateCategoryPayload) => {
  return database.category.create({
    data: payload,
    select: categoryListSelect,
  });
};

// Get category by id (non-deleted only)
const getCategoryById = async (id: string) => {
  return database.category.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    select: categoryFullSelect,
  });
};

// Get category by name (case-insensitive, non-deleted only)
const getCategoryByName = async (name: string, excludeId?: string) => {
  return database.category.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: categoryFullSelect,
  });
};

// Get all categories with filters and pagination
const getAllCategories = async (
  filters: ICategoryFilters,
  options: PaginationOptions
): Promise<PaginationResult<ICategory>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: any = {
    isDeleted: false,
  };

  if (filters.name) {
    where.name = {
      contains: filters.name,
      mode: 'insensitive',
    };
  }

  if (filters.search) {
    where.OR = [
      {
        name: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
    ];
  }

  const [categories, total] = await Promise.all([
    database.category.findMany({
      where,
      select: categoryListSelect,
      skip,
      take,
      orderBy,
    }),
    database.category.count({ where }),
  ]);

  return createPaginationResult(categories as ICategory[], total, pagination);
};

// Update category by id
const updateCategoryById = async (id: string, payload: IUpdateCategoryPayload) => {
  return database.category.update({
    where: { id },
    data: payload,
    select: categoryListSelect,
  });
};

// Soft delete category by id
const softDeleteCategoryById = async (id: string) => {
  return database.category.update({
    where: { id },
    data: { isDeleted: true },
    select: categoryListSelect,
  });
};

export const CategoryRepository = {
  createCategory,
  getCategoryById,
  getCategoryByName,
  getAllCategories,
  updateCategoryById,
  softDeleteCategoryById,
};
