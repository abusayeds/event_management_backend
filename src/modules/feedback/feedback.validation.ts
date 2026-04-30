import { z } from 'zod';
import { UserFeedbackCategory, UserFeedbackStatus } from '../../../prisma/generated/enums';

const idParamSchema = z.object({
  id: z.string().min(1, 'Feedback id is required'),
});

const createFeedback = z.object({
  body: z.object({
    message: z
      .string()
      .trim()
      .min(10, 'Message must be at least 10 characters')
      .max(8000, 'Message is too long'),
    subject: z.string().trim().max(200, 'Subject is too long').optional(),
    category: z.enum(Object.values(UserFeedbackCategory) as [string, ...string[]]).optional(),
  }),
});

const listMineQuery = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const listAllQuery = z.object({
  query: z.object({
    status: z.enum(Object.values(UserFeedbackStatus) as [string, ...string[]]).optional(),
    userId: z.string().uuid().optional(),
    category: z.enum(Object.values(UserFeedbackCategory) as [string, ...string[]]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const getById = z.object({
  params: idParamSchema,
});

const updateByAdmin = z.object({
  params: idParamSchema,
  body: z
    .object({
      status: z.enum(Object.values(UserFeedbackStatus) as [string, ...string[]]).optional(),
      adminNote: z.string().trim().max(4000).nullable().optional(),
    })
    .refine(data => data.status !== undefined || data.adminNote !== undefined, {
      message: 'At least one of status or adminNote is required.',
    }),
});

export const FeedbackValidation = {
  createFeedback,
  listMineQuery,
  listAllQuery,
  getById,
  updateByAdmin,
};
