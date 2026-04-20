import { database } from '../../config/database';
import {
    createPaginationQuery,
    createPaginationResult,
    PaginationOptions,
    PaginationResult,
    parsePaginationOptions,
} from '../../utils/paginate';
import { ICreateProgramPayload, IProgram, IProgramFilters, IUpdateProgramPayload } from './program.interface';

// Program list select
export const programListSelect = {
  id: true,
  categoryId: true,
  subcategoryId: true,
  name: true,
  description: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
};

// Program full select
export const programFullSelect = {
  id: true,
  categoryId: true,
  subcategoryId: true,
  name: true,
  description: true,
  imageUrl: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

// Create program
const createProgram = async (payload: ICreateProgramPayload) => {
  return database.program.create({
    data: payload,
    select: programListSelect,
  });
};

// Get program by id
const getProgramById = async (id: string) => {
  return database.program.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    select: programFullSelect,
  });
};

// Get program by name
const getProgramByName = async (name: string, excludeId?: string) => {
  return database.program.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: programFullSelect,
  });
};

// Get all programs with filters and pagination
const getAllPrograms = async (
  filters: IProgramFilters,
  options: PaginationOptions
): Promise<PaginationResult<IProgram>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: any = {
    isDeleted: false,
  };

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.subcategoryId) {
    where.subcategoryId = filters.subcategoryId;
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

  const [programs, total] = await Promise.all([
    database.program.findMany({
      where,
      select: programListSelect,
      skip,
      take,
      orderBy,
    }),
    database.program.count({ where }),
  ]);

  return createPaginationResult(programs as IProgram[], total, pagination);
};

// Update program by id
const updateProgramById = async (id: string, payload: IUpdateProgramPayload) => {
  return database.program.update({
    where: { id },
    data: payload,
    select: programListSelect,
  });
};

// Soft delete program by id
const softDeleteProgramById = async (id: string) => {
  return database.program.update({
    where: { id },
    data: { isDeleted: true },
    select: programListSelect,
  });
};

// Check active category by id
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

// Check active subcategory by id
const getSubcategoryById = async (id: string) => {
  return database.subcategory.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    select: {
      id: true,
      categoryId: true,
      name: true,
    },
  });
};

export const ProgramRepository = {
  createProgram,
  getProgramById,
  getProgramByName,
  getAllPrograms,
  updateProgramById,
  softDeleteProgramById,
  getCategoryById,
  getSubcategoryById,
};
