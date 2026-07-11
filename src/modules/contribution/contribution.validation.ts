import { z } from 'zod';
import { EventType } from '../../../prisma/generated/enums';
import { normalizeCategoryGroupSlug } from '../event/event.helpers';
import { CONTRIBUTION_TIME_RANGES } from './contribution.interface';

const listQueryFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(200).optional(),
  programId: z.string().trim().min(1).max(64).optional(),
  program: z.string().trim().max(200).optional(),
  type: z.nativeEnum(EventType).optional(),
  location: z.string().trim().max(300).optional(),
  categoryGroup: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine(
      val => val === undefined || val === '' || normalizeCategoryGroupSlug(val) !== null,
      'Invalid categoryGroup. Expected: 6year-10year, 11year-16year, or 17year+ (aliases like 6-10, 17+ accepted).'
    ),
  timeRange: z.enum(CONTRIBUTION_TIME_RANGES).optional(),
} as const;

const getContributionsValidationSchema = z.object({
  query: z.object(listQueryFields),
});

const getFilterOptionsValidationSchema = z.object({
  query: z.object({}).optional(),
});

export const ContributionValidation = {
  getContributionsValidationSchema,
  getFilterOptionsValidationSchema,
};
