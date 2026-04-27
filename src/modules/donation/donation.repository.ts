import { Prisma } from '../../../prisma/generated/client';
import { DonationPaymentStatus, DonationProvider } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import {
  createPaginationQuery,
  createPaginationResult,
  PaginationOptions,
  PaginationResult,
  parsePaginationOptions,
} from '../../utils/paginate';
import {
  IDonationFilters,
  ICreateDonationPayload,
} from './donation.interface';

const donationSelect = {
  id: true,
  userId: true,
  provider: true,
  providerTransactionId: true,
  donationType: true,
  amount: true,
  currency: true,
  note: true,
  paymentStatus: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      contributionScore: true,
    },
  },
} as const;

const createDonation = async (userId: string, payload: ICreateDonationPayload) => {
  return database.donationTransaction.create({
    data: {
      userId,
      provider: payload.provider,
      providerTransactionId: payload.providerTransactionId,
      donationType: payload.donationType,
      amount: new Prisma.Decimal(String(payload.amount)),
      currency: payload.currency ?? 'USD',
      note: payload.note ?? null,
      paymentStatus: DonationPaymentStatus.Pending,
      rawPayload: payload.rawPayload as Prisma.InputJsonValue | undefined,
    },
    select: donationSelect,
  });
};

const getByProviderAndTransactionId = async (
  provider: DonationProvider,
  providerTransactionId: string
) => {
  return database.donationTransaction.findFirst({
    where: { provider, providerTransactionId },
    select: donationSelect,
  });
};

const updateByProviderAndTransactionId = async (
  provider: DonationProvider,
  providerTransactionId: string,
  data: {
    paymentStatus: DonationPaymentStatus;
    verifiedAt?: Date | null;
    rawPayload?: Prisma.InputJsonValue | null;
  }
) => {
  await database.donationTransaction.updateMany({
    where: { provider, providerTransactionId },
    data: {
      paymentStatus: data.paymentStatus,
      verifiedAt: data.verifiedAt ?? null,
      rawPayload: data.rawPayload ?? undefined,
    },
  });
  return database.donationTransaction.findFirst({
    where: { provider, providerTransactionId },
    select: donationSelect,
  });
};

const getDonationsByUser = async (
  userId: string,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where: Prisma.DonationTransactionWhereInput = { userId };

  const [data, total] = await Promise.all([
    database.donationTransaction.findMany({
      where,
      select: donationSelect,
      skip,
      take,
      orderBy,
    }),
    database.donationTransaction.count({ where }),
  ]);

  return createPaginationResult(data, total, pagination);
};

const getDonationListForAdmin = async (
  filters: IDonationFilters,
  options: PaginationOptions
): Promise<PaginationResult<unknown>> => {
  const pagination = parsePaginationOptions(options);
  const { skip, take, orderBy } = createPaginationQuery(pagination);
  const where: Prisma.DonationTransactionWhereInput = {};

  if (filters.userId) where.userId = filters.userId;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.provider) where.provider = filters.provider;
  if (filters.username) {
    where.user = {
      username: {
        contains: filters.username,
        mode: 'insensitive',
      },
    };
  }
  if (filters.date) {
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.createdAt = { gte: start, lt: end };
  }

  const [data, total] = await Promise.all([
    database.donationTransaction.findMany({
      where,
      select: donationSelect,
      skip,
      take,
      orderBy,
    }),
    database.donationTransaction.count({ where }),
  ]);

  return createPaginationResult(data, total, pagination);
};


export const DonationRepository = {
  createDonation,
  getByProviderAndTransactionId,
  updateByProviderAndTransactionId,
  getDonationsByUser,
  getDonationListForAdmin,
};
