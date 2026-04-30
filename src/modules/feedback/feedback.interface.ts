import { UserFeedbackCategory, UserFeedbackStatus } from '../../../prisma/generated/enums';

export interface ICreateFeedbackPayload {
  message: string;
  subject?: string;
  category?: UserFeedbackCategory;
}

export interface IFeedbackAdminUpdatePayload {
  status?: UserFeedbackStatus;
  adminNote?: string | null;
}

export interface IFeedbackFilters {
  status?: UserFeedbackStatus;
  userId?: string;
  category?: UserFeedbackCategory;
}
