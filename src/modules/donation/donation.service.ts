import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { Prisma } from '../../../prisma/generated/client';
import { DonationPaymentStatus, DonationProvider } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import {
  ICreateDonationPayload,
  IDonationFilters,
  IStripeWebhookResult,
} from './donation.interface';
import { DonationRepository } from './donation.repository';

const validateProviderTransaction = (providerTransactionId: string) => {
  if (!providerTransactionId?.trim()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'providerTransactionId is required.');
  }
};

const createDonation = async (userId: string, payload: ICreateDonationPayload) => {
  validateProviderTransaction(payload.providerTransactionId);
  const existing = await DonationRepository.getByProviderAndTransactionId(
    payload.provider,
    payload.providerTransactionId
  );
  if (existing) {
    if (existing.userId !== userId) {
      throw new ApiError(StatusCodes.CONFLICT, 'This transaction already belongs to another user.');
    }
    return existing;
  }

  try {
    return await DonationRepository.createDonation(userId, payload);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const row = await DonationRepository.getByProviderAndTransactionId(
        payload.provider,
        payload.providerTransactionId
      );
      if (row) return row;
    }
    throw error;
  }
};

const getMyDonations = async (userId: string, options: PaginationOptions) => {
  return DonationRepository.getDonationsByUser(userId, options);
};

const getDonationsForAdmin = async (filters: IDonationFilters, options: PaginationOptions) => {
  return DonationRepository.getDonationListForAdmin(filters, options);
};

const processStripeWebhook = async (
  rawBody: Buffer,
  signature: string | undefined
): Promise<IStripeWebhookResult> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Stripe webhook is not configured.');
  }
  if (!signature) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Missing Stripe signature.');
  }

  const signatureParts = Object.fromEntries(
    signature.split(',').map(part => {
      const [k, v] = part.split('=');
      return [k, v];
    })
  );
  const timestamp = signatureParts.t;
  const v1 = signatureParts.v1;
  if (!timestamp || !v1) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Stripe webhook signature.');
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');
  if (expected !== v1) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Stripe webhook signature.');
  }

  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = JSON.parse(rawBody.toString('utf8')) as {
      type?: string;
      data?: { object?: { id?: string } };
    };
  } catch {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Stripe webhook payload.');
  }
  const eventType = String(event.type ?? '');
  const providerTransactionId = event.data?.object?.id;
  if (!providerTransactionId) {
    return { accepted: true, provider: DonationProvider.Stripe, eventType, message: 'No payment intent in event.' };
  }

  const matched = await DonationRepository.getByProviderAndTransactionId(
    DonationProvider.Stripe,
    providerTransactionId
  );
  if (!matched) {
    return {
      accepted: true,
      provider: DonationProvider.Stripe,
      eventType,
      providerTransactionId,
      message: 'Donation not found.',
    };
  }

  let nextStatus: DonationPaymentStatus | null = null;
  if (eventType === 'payment_intent.succeeded') nextStatus = DonationPaymentStatus.Succeeded;
  if (eventType === 'payment_intent.payment_failed') nextStatus = DonationPaymentStatus.Failed;
  if (eventType === 'charge.refunded') nextStatus = DonationPaymentStatus.Refunded;

  if (!nextStatus) {
    return {
      accepted: true,
      provider: DonationProvider.Stripe,
      eventType,
      providerTransactionId,
      message: 'Event ignored.',
    };
  }

  await DonationRepository.updateByProviderAndTransactionId(DonationProvider.Stripe, providerTransactionId, {
    paymentStatus: nextStatus,
    verifiedAt: nextStatus === DonationPaymentStatus.Succeeded ? new Date() : matched.verifiedAt,
    rawPayload: event as unknown as Prisma.InputJsonValue,
  });

  return {
    accepted: true,
    provider: DonationProvider.Stripe,
    eventType,
    providerTransactionId,
    message: 'Stripe webhook processed.',
  };
};

const getHeaderValue = (header: string | string[] | undefined): string => {
  if (Array.isArray(header)) return header[0] ?? '';
  return header ?? '';
};

const processStoreWebhook = async (
  provider: DonationProvider,
  headers: Record<string, string | string[] | undefined>,
  payload: Record<string, unknown>
): Promise<IStripeWebhookResult> => {
  const envSecret =
    provider === DonationProvider.Apple
      ? process.env.APPLE_DONATION_WEBHOOK_SECRET
      : process.env.GOOGLE_DONATION_WEBHOOK_SECRET;
  const signature = getHeaderValue(headers['x-donation-webhook-secret']);
  if (envSecret && signature !== envSecret) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, `${provider} webhook signature invalid.`);
  }

  const eventType = String(payload.eventType ?? payload.notificationType ?? 'unknown');
  const providerTransactionId = String(
    payload.transactionId ?? payload.originalTransactionId ?? payload.orderId ?? payload.purchaseToken ?? ''
  );
  if (!providerTransactionId) {
    return { accepted: true, provider, eventType, message: 'No transaction id in event.' };
  }

  const matched = await DonationRepository.getByProviderAndTransactionId(provider, providerTransactionId);
  if (!matched) {
    return { accepted: true, provider, eventType, providerTransactionId, message: 'Donation not found.' };
  }

  const eventLower = eventType.toLowerCase();
  let nextStatus: DonationPaymentStatus = DonationPaymentStatus.Succeeded;
  if (eventLower.includes('fail') || eventLower.includes('cancel')) nextStatus = DonationPaymentStatus.Failed;
  if (eventLower.includes('refund') || eventLower.includes('revoke')) nextStatus = DonationPaymentStatus.Refunded;

  await DonationRepository.updateByProviderAndTransactionId(provider, providerTransactionId, {
    paymentStatus: nextStatus,
    verifiedAt: nextStatus === DonationPaymentStatus.Succeeded ? new Date() : matched.verifiedAt,
    rawPayload: payload as Prisma.InputJsonValue,
  });

  return { accepted: true, provider, eventType, providerTransactionId, message: `${provider} webhook processed.` };
};

const processAppleWebhook = async (
  headers: Record<string, string | string[] | undefined>,
  payload: Record<string, unknown>
) => processStoreWebhook(DonationProvider.Apple, headers, payload);

const processGoogleWebhook = async (
  headers: Record<string, string | string[] | undefined>,
  payload: Record<string, unknown>
) => processStoreWebhook(DonationProvider.Google, headers, payload);

export const DonationService = {
  createDonation,
  getMyDonations,
  getDonationsForAdmin,
  processStripeWebhook,
  processAppleWebhook,
  processGoogleWebhook,
};
