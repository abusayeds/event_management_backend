import { z } from 'zod';
import {
  DonationPaymentStatus,
  DonationProvider,
  DonationType,
} from '../../../prisma/generated/enums';

const createDonation = z.object({
  body: z.object({
    provider: z.nativeEnum(DonationProvider),
    providerTransactionId: z.string().trim().min(1),
    donationType: z.nativeEnum(DonationType).optional(),
    amount: z.coerce.number().positive(),
    currency: z.string().trim().min(1).max(10).optional(),
    note: z.string().trim().max(1000).optional(),
    rawPayload: z.any().optional(),
  }),
});

const getMyDonations = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const getDonationsForAdmin = z.object({
  query: z.object({
    userId: z.string().optional(),
    username: z.string().optional(),
    date: z.coerce.date().optional(),
    paymentStatus: z.nativeEnum(DonationPaymentStatus).optional(),
    provider: z.nativeEnum(DonationProvider).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const DonationValidation = {
  createDonation,
  getMyDonations,
  getDonationsForAdmin,
};
