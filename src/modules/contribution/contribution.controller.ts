import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { CONTRIBUTION_LIST_QUERY_KEYS } from './contribution.interface';
import { ContributionService } from './contribution.service';

const getContributions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, [...CONTRIBUTION_LIST_QUERY_KEYS]);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await ContributionService.getContributions(filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Contributions fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const getFilterOptions = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const data = await ContributionService.getFilterOptions();

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Contribution filter options fetched successfully.',
    data,
  });
});

export const ContributionController = {
  getContributions,
  getFilterOptions,
};
