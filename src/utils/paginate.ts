import {
  PaginationMeta,
  PaginationOptions,
  PaginationResult,
} from '../interfaces/pagination.interface';
export { PaginationMeta, PaginationOptions, PaginationResult };

const toPositiveInteger = (value: unknown, fallback: number): number => {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;

  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallback;
};

export const parsePaginationOptions = (options: PaginationOptions): Required<PaginationOptions> => {
  return {
    page: toPositiveInteger(options.page, 1),
    limit: toPositiveInteger(options.limit, 10),
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
