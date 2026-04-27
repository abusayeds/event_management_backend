import {
  DonationPaymentStatus,
  DonationProvider,
  DonationType,
} from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';

export interface ICreateDonationPayload {
  provider: DonationProvider;
  providerTransactionId: string;
  donationType?: DonationType;
  amount: string | number;
  currency?: string;
  note?: string;
  rawPayload?: unknown;
}

export interface IDonationFilters {
  userId?: string;
  username?: string;
  date?: string | Date;
  paymentStatus?: DonationPaymentStatus;
  provider?: DonationProvider;
}

export interface IDonationListQuery {
  filters: IDonationFilters;
  options: PaginationOptions;
}

export interface IStripeWebhookResult {
  accepted: boolean;
  eventType: string;
  provider: DonationProvider;
  providerTransactionId?: string;
  message: string;
}
