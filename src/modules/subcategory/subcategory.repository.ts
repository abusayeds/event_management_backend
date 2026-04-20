import { database } from '../../config/database';
import {
    createPaginationQuery,
    createPaginationResult,
    PaginationOptions,
    PaginationResult,
    parsePaginationOptions,
} from '../../utils/paginate';
import {
    ICreateSubcategoryPayload,
    ISubcategory,
    ISubcategoryFilters,
    IUpdateSubcategoryPayload,
} from './subcategory.interface';

// Subcategory list select
export const subcategoryListSelect = {
  id: true,
  categoryId: true,
  name: true,
  imageUrl: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

// Subcategory full select
export const subcategoryFullSelect = {
  id: true,
  categoryId: true,
  name: true,
  imageUrl: true,
  description: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

// Create subcategory
const createSubcategory = async (payload: ICreateSubcategoryPayload) => {
  return database.subcategory.create({
    data: payload,
    select: subcategoryListSelect,
  });
};

// Get subcategory by id
const getSubcategoryById = async (id: string) => {
  return database.subcategory.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    select: subcategoryFullSelect,
  });
};

// Get subcategory by name
const getSubcategoryByName = async (name: string, excludeId?: string) => {
  return database.subcategory.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: subcategoryFullSelect,
  });
};

// Get all subcategories with filters and pagination
const getAllSubcategories = async (
  filters: ISubcategoryFilters,
  options: PaginationOptions
): Promise<PaginationResult<ISubcategory>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: any = {
    isDeleted: false,
  };

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

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

  const [subcategories, total] = await Promise.all([
    database.subcategory.findMany({
      where,
      select: subcategoryListSelect,
      skip,
      take,
      orderBy,
    }),
    database.subcategory.count({ where }),
  ]);

  return createPaginationResult(subcategories as ISubcategory[], total, pagination);
};

// Update subcategory by id
const updateSubcategoryById = async (id: string, payload: IUpdateSubcategoryPayload) => {
  return database.subcategory.update({
    where: { id },
    data: payload,
    select: subcategoryListSelect,
  });
};

// Soft delete subcategory by id
const softDeleteSubcategoryById = async (id: string) => {
  return database.subcategory.update({
    where: { id },
    data: { isDeleted: true },
    select: subcategoryListSelect,
  });
};

// Check category exists and active
const getCategoryById = async (id: string) => {
  return database.category.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
    },
  });
};

export const SubcategoryRepository = {
  createSubcategory,
  getSubcategoryById,
  getSubcategoryByName,
  getAllSubcategories,
  updateSubcategoryById,
  softDeleteSubcategoryById,
  getCategoryById,
};
