import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import { UserSettingsService } from './userSettings.service';

const getMySettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await UserSettingsService.getMySettings(req.user!.userId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User settings fetched successfully.',
    data: result,
  });
});

const updateMySettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await UserSettingsService.updateMySettings(req.user!.userId, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User settings updated successfully.',
    data: result,
  });
});

const getOptions = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const result = UserSettingsService.getOptions();
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User settings options fetched successfully.',
    data: result,
  });
});

export const UserSettingsController = {
  getMySettings,
  updateMySettings,
  getOptions,
};
