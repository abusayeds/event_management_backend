import { z } from 'zod';

const getOverview = z.object({
  query: z.object({
    recentDays: z.coerce.number().int().min(1).max(365).optional(),
  }),
});

const getIncomeRatio = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(3000).optional(),
  }),
});

const getUserRatio = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(3000).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  }),
});

export const DashboardValidation = {
  getOverview,
  getIncomeRatio,
  getUserRatio,
};
