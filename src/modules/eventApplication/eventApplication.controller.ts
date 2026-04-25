import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '../../../prisma/generated/enums';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { EventApplicationService } from './eventApplication.service';

const getEventApplicationList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = req.user!.userId;
  const role = req.user!.role as UserRole;
  const filters = pick(req.query, ['userId', 'eventId', 'status']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await EventApplicationService.getEventApplicationList(
    requesterId,
    role,
    filters,
    options
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Applications fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const getEventApplicationById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = req.user!.userId;
  const role = req.user!.role as UserRole;
  const result = await EventApplicationService.getEventApplicationById(
    req.params.appliedId as string,
    requesterId,
    role
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application fetched successfully.',
    data: result,
  });
});

const updateEventApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = req.user!.userId;
  const role = req.user!.role as UserRole;
  const result = await EventApplicationService.updateEventApplication(
    req.params.appliedId as string,
    requesterId,
    role,
    req.body
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application updated successfully.',
    data: result,
  });
});

const deleteEventApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = req.user!.userId;
  const role = req.user!.role as UserRole;
  const result = await EventApplicationService.deleteEventApplication(
    req.params.appliedId as string,
    requesterId,
    role
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application removed successfully.',
    data: result,
  });
});

const applyToEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventApplicationService.applyToEvent(
    req.params.eventId as string,
    userId,
    req.body?.note
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application submitted successfully.',
    data: result,
  });
});

const withdrawEventApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventApplicationService.withdrawEventApplication(
    req.params.eventId as string,
    userId
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application withdrawn successfully.',
    data: result,
  });
});

export const EventApplicationController = {
  getEventApplicationList,
  getEventApplicationById,
  updateEventApplication,
  deleteEventApplication,
  applyToEvent,
  withdrawEventApplication,
};
