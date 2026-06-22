import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import { WelcomeService } from './welcome.service';

const upsertPage = asyncHandler(async (req: Request, res: Response) => {
  const result = await WelcomeService.upsertPage(req.params.key as string, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Welcome page saved successfully.',
    data: result,
  });
});

const getPage = asyncHandler(async (req: Request, res: Response) => {
  const result = await WelcomeService.getPage(req.params.key as string);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.id
      ? 'Welcome page fetched successfully.'
      : 'Welcome page not created yet. Empty template returned.',
    data: result,
  });
});

export const WelcomeController = {
  upsertPage,
  getPage,
};
