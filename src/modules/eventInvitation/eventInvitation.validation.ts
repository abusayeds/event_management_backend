import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().min(1, 'Invitation id is required'),
});

const eventIdParamSchema = z.object({
  eventId: z.string().min(1, 'Event id is required'),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const getShareConnections = z.object({
  params: eventIdParamSchema,
  query: paginationQuerySchema,
});

const getShareLink = z.object({
  params: eventIdParamSchema,
});

const inviteeIdsBody = z.object({
  inviteeIds: z
    .array(z.string().min(1, 'Invitee id is required'))
    .min(1, 'Select at least one connection to invite'),
  message: z
    .string()
    .trim()
    .max(500, 'Message must be 500 characters or less')
    .optional(),
});

const sendInvitations = z.object({
  params: eventIdParamSchema,
  body: inviteeIdsBody,
});

const sendInvitationsRoot = z.object({
  body: inviteeIdsBody.extend({
    eventId: z.string().min(1, 'Event id is required'),
  }),
});

const getReceivedInvitations = z.object({
  query: paginationQuerySchema,
});

const getSentInvitations = z.object({
  query: paginationQuerySchema.extend({
    eventId: z.string().min(1).optional(),
  }),
});

const respondToInvitation = z.object({
  params: idParamSchema,
});

const bulkRespond = z.object({
  body: z.object({}).optional(),
});

export const EventInvitationValidation = {
  getShareConnections,
  getShareLink,
  sendInvitations,
  sendInvitationsRoot,
  getReceivedInvitations,
  getSentInvitations,
  respondToInvitation,
  bulkRespond,
};
