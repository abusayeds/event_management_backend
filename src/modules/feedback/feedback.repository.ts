import { UserFeedbackCategory, UserFeedbackStatus } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import { ICreateFeedbackPayload, IFeedbackAdminUpdatePayload, IFeedbackFilters } from './feedback.interface';

const feedbackAuthorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const;

export const feedbackListSelect = {
  id: true,
  userId: true,
  subject: true,
  message: true,
  category: true,
  status: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
  user: { select: feedbackAuthorSelect },
} as const;

const create = async (userId: string, payload: ICreateFeedbackPayload) => {
  return database.userFeedback.create({
    data: {
      userId,
      message: payload.message.trim(),
      subject: payload.subject?.trim() || null,
      category: payload.category ?? UserFeedbackCategory.GENERAL,
    },
    select: {
      id: true,
      userId: true,
      subject: true,
      message: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

const findById = async (id: string) => {
  return database.userFeedback.findUnique({
    where: { id },
    select: feedbackListSelect,
  });
};

const findManyForUser = async (
  userId: string,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where = { userId };

  const [rows, total] = await Promise.all([
    database.userFeedback.findMany({
      where,
      select: {
        id: true,
        subject: true,
        message: true,
        category: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take,
      orderBy,
    }),
    database.userFeedback.count({ where }),
  ]);

  return createPaginationResult(rows, total, pagination);
};

const findManyForAdmin = async (
  filters: IFeedbackFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);

  const where: {
    status?: UserFeedbackStatus;
    userId?: string;
    category?: UserFeedbackCategory;
  } = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.category) {
    where.category = filters.category;
  }

  const [rows, total] = await Promise.all([
    database.userFeedback.findMany({
      where,
      select: feedbackListSelect,
      skip,
      take,
      orderBy,
    }),
    database.userFeedback.count({ where }),
  ]);

  return createPaginationResult(rows, total, pagination);
};

const updateById = async (id: string, data: IFeedbackAdminUpdatePayload) => {
  return database.userFeedback.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.adminNote !== undefined ? { adminNote: data.adminNote } : {}),
    },
    select: feedbackListSelect,
  });
};

export const FeedbackRepository = {
  create,
  findById,
  findManyForUser,
  findManyForAdmin,
  updateById,
};
