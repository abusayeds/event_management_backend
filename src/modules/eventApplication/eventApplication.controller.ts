import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { EventApplicationService } from './eventApplication.service';

const getEventApplicationByUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const search = pick(req.query, ['search']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await EventApplicationService.getEventApplicationByUser(userId, {
    search: search.search as string | undefined,
    options,
  });

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User applications fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});
const deleteApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventApplicationService.deleteApplication(req.params.appliedId as string, userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application removed successfully.',
    data: result,
  });
});

const createEventApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventApplicationService.createEventApplication(
    userId,
    req.body
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application submitted successfully.',
    data: result,
  });
});

export const EventApplicationController = {
  createEventApplication,
  getEventApplicationByUser,
  deleteApplication,
};
