import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { DashboardService } from './dashboard.service';

const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const query = pick(req.query, ['recentDays']);
  const result = await DashboardService.getOverview(query);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Dashboard overview fetched successfully.',
    data: result,
  });
});

const getIncomeRatio = asyncHandler(async (req: Request, res: Response) => {
  const query = pick(req.query, ['year']);
  const result = await DashboardService.getIncomeRatio(query);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Income ratio fetched successfully.',
    data: result,
  });
});

const getUserRatio = asyncHandler(async (req: Request, res: Response) => {
  const query = pick(req.query, ['year', 'month']);
  const result = await DashboardService.getUserRatio(query);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User ratio fetched successfully.',
    data: result,
  });
});

export const DashboardController = {
  getOverview,
  getIncomeRatio,
  getUserRatio,
};
