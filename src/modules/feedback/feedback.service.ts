import { StatusCodes } from 'http-status-codes';
import { PaginationOptions } from '../../interfaces/pagination.interface';
import ApiError from '../../utils/apiError';
import {
  ICreateFeedbackPayload,
  IFeedbackAdminUpdatePayload,
  IFeedbackFilters,
} from './feedback.interface';
import { FeedbackRepository } from './feedback.repository';

const createFeedback = async (userId: string, payload: ICreateFeedbackPayload) => {
  return FeedbackRepository.create(userId, payload);
};

const getMyFeedbacks = async (userId: string, options: PaginationOptions) => {
  return FeedbackRepository.findManyForUser(userId, options);
};

const getAllFeedbacks = async (filters: IFeedbackFilters, options: PaginationOptions) => {
  return FeedbackRepository.findManyForAdmin(filters, options);
};

const getFeedbackById = async (id: string, actorId: string, actorRole: string) => {
  const row = await FeedbackRepository.findById(id);
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Feedback not found.');
  }
  const isAdmin = actorRole === 'ADMIN';
  if (!isAdmin && row.userId !== actorId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only view your own feedback.');
  }
  return row;
};

const updateFeedbackByAdmin = async (id: string, payload: IFeedbackAdminUpdatePayload) => {
  const existing = await FeedbackRepository.findById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Feedback not found.');
  }
  if (payload.status === undefined && payload.adminNote === undefined) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Provide at least one of status or adminNote.');
  }
  return FeedbackRepository.updateById(id, payload);
};

export const FeedbackService = {
  createFeedback,
  getMyFeedbacks,
  getAllFeedbacks,
  getFeedbackById,
  updateFeedbackByAdmin,
};
