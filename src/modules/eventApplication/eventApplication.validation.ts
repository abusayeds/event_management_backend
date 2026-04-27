import { z } from 'zod';

const createEventApplication = z.object({
  body: z.object({
    eventId: z.string().min(1, 'eventId is required'),
    note: z.string().max(1000).optional().nullable(),
  }),
});

const getEventApplicationByUser = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const deleteApplication = z.object({
  params: z.object({
    appliedId: z.string().min(1, 'appliedId is required'),
  }),
});

export const EventApplicationValidation = {
  createEventApplication,
  getEventApplicationByUser,
  deleteApplication,
};
