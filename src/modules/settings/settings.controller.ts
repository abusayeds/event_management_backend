import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import { SettingsService } from './settings.service';

const addOrEditPage = asyncHandler(async (req: Request, res: Response) => {
  const result = await SettingsService.addOrEditPage(req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Settings page saved successfully.',
    data: result,
  });
});

const getPage = asyncHandler(async (req: Request, res: Response) => {
  const result = await SettingsService.getPage(req.params.key as string);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.id
      ? 'Settings page fetched successfully.'
      : 'Settings page not created yet. Empty template returned.',
    data: result,
  });
});

export const SettingsController = {
  addOrEditPage,
  getPage,
};
