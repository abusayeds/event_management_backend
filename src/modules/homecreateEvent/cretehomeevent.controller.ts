import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces';
import asyncHandler from '../../utils/asyncHandler';
import apiResponse from '../../utils/apiResponse';
import { HomeEventService } from './cretehomeevent.service';

const createHomeEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const result = await HomeEventService.createHomeEvent(req.body, userId);

  apiResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Home event created successfully',
    data: result,
  });
});

const getHomeEventById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const eventId = req.params.id as string;
  const result = await HomeEventService.getHomeEventById(eventId, userId);

  apiResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Home event retrieved successfully',
    data: result,
  });
});

const getAllHomeEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const result = await HomeEventService.getAllHomeEvents(userId);

  apiResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Home events retrieved successfully',
    data: result,
  });
});

const updateHomeEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const eventId = req.params.id as string;
  const result = await HomeEventService.updateHomeEvent(eventId, req.body, userId);

  apiResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Home event updated successfully',
    data: result,
  });
});

const deleteHomeEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const eventId = req.params.id as string;
  await HomeEventService.deleteHomeEvent(eventId, userId);

  apiResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Home event deleted successfully',
    data: null,
  });
});

export const HomeEventController = {
  createHomeEvent,
  getHomeEventById,
  getAllHomeEvents,
  updateHomeEvent,
  deleteHomeEvent,
};
