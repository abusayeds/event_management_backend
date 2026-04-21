import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().min(1, 'Connection id is required'),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const sendConnectionRequest = z.object({
  body: z.object({
    receiverId: z.string().min(1, 'Receiver user id is required'),
  }),
});

const getAcceptedConnections = z.object({
  query: paginationQuerySchema,
});

const getIncomingPendingRequests = z.object({
  query: paginationQuerySchema,
});

const getOutgoingPendingRequests = z.object({
  query: paginationQuerySchema,
});

const acceptRequest = z.object({
  params: idParamSchema,
});

const rejectRequest = z.object({
  params: idParamSchema,
});

const cancelRequest = z.object({
  params: idParamSchema,
});

const removeConnection = z.object({
  params: idParamSchema,
});

export const ConnectionValidation = {
  sendConnectionRequest,
  getAcceptedConnections,
  getIncomingPendingRequests,
  getOutgoingPendingRequests,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeConnection,
};
