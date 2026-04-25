import { z } from 'zod';
import { UserAppliedStatus } from '../../../prisma/generated/enums';

const appliedIdParam = z.object({
  appliedId: z.string().min(1, 'appliedId is required'),
});

const eventIdParam = z.object({
  eventId: z.string().min(1, 'eventId is required'),
});

const getEventApplicationList = z.object({
  query: z.object({
    userId: z.string().min(1).optional(),
    eventId: z.string().min(1).optional(),
    status: z.nativeEnum(UserAppliedStatus).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const getEventApplicationById = z.object({
  params: appliedIdParam,
});

const updateEventApplication = z.object({
  params: appliedIdParam,
  body: z
    .object({
      status: z.nativeEnum(UserAppliedStatus).optional(),
      note: z.string().max(2000).optional().nullable(),
    })
    .refine(data => Object.keys(data).length > 0, 'At least one field is required.'),
});

const deleteEventApplication = z.object({
  params: appliedIdParam,
});

const applyToEvent = z.object({
  params: eventIdParam,
  body: z
    .object({
      note: z.string().max(1000).optional().nullable(),
    })
    .default({}),
});

const withdrawEventApplication = z.object({
  params: eventIdParam,
});

export const EventApplicationValidation = {
  getEventApplicationList,
  getEventApplicationById,
  updateEventApplication,
  deleteEventApplication,
  applyToEvent,
  withdrawEventApplication,
};
