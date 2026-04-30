import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { FeedbackService } from './feedback.service';

const createFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const data = await FeedbackService.createFeedback(userId, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Feedback submitted successfully.',
    data,
  });
});

const getMyFeedbacks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await FeedbackService.getMyFeedbacks(userId, options);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your feedback list fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const getAllFeedbacks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, ['status', 'userId', 'category']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await FeedbackService.getAllFeedbacks(filters, options);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Feedback list fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const getFeedbackById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { userId, role } = req.user!;
  const data = await FeedbackService.getFeedbackById(id as string, userId, role);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Feedback fetched successfully.',
    data,
  });
});

const updateFeedbackByAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const data = await FeedbackService.updateFeedbackByAdmin(id as string, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Feedback updated successfully.',
    data,
  });
});

export const FeedbackController = {
  createFeedback,
  getMyFeedbacks,
  getAllFeedbacks,
  getFeedbackById,
  updateFeedbackByAdmin,
};
