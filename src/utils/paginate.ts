import {
  PaginationMeta,
  PaginationOptions,
  PaginationResult,
} from '../interfaces/pagination.interface';

export { PaginationMeta, PaginationOptions, PaginationResult };

export const parsePaginationOptions = (options: PaginationOptions): Required<PaginationOptions> => {
  return {
    search: options.search || '',
    page: options.page || 1,
    limit: options.limit || 10,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: options.sortOrder || 'desc',
  };
};

export const createPaginationQuery = (options: Required<PaginationOptions>) => {
  const { page, limit, sortBy, sortOrder } = options;
  const skip = (page - 1) * limit;

  return {
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
  };
};

export const createPaginationResult = <T>(
  data: T[],
  total: number,
  options: Required<PaginationOptions>
): PaginationResult<T> => {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  return {
    data,
    meta,
  };
};
