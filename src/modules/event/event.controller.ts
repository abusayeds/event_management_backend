import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { FamilyRelationShip, UserRole } from '../../../prisma/generated/enums';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import ApiError from '../../utils/apiError';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { EventService } from './event.service';

// POST /events
const createEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventService.createEvent(userId, req.body, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Event created successfully.',
    data: result,
  });
});

// GET /events
const getEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, ['eventName', 'filterType']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const role = req.user!.role as UserRole;
  const result = await EventService.getEvents(filters, options, role);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// GET /events/feed/upcoming
const getUpcomingEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.getUpcomingEvents(options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Upcoming events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// GET /events/feed/today
const getTodayEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.getTodayEvents(options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Today's events fetched successfully.",
    data: result.data,
    meta: result.meta,
  });
});

// GET /events/feed/history
const getHistoryEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.getHistoryEvents(options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'History events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// GET /events/feed/by-family-relation
const getEventsByFamilyRelation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const rawRelationShip = req.query.relationShip as string;

  if (!rawRelationShip || !Object.values(FamilyRelationShip).includes(rawRelationShip as FamilyRelationShip)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `relationShip query parameter is required and must be one of: ${Object.values(FamilyRelationShip).join(', ')}`
    );
  }

  const relationShip = rawRelationShip as FamilyRelationShip;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.getEventsByFamilyRelation(userId, relationShip, options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// GET /events/:eventId
const getEventById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user!.role as UserRole;
  const result = await EventService.getEventById(req.params.eventId as string, role);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event fetched successfully.',
    data: result,
  });
});

// GET /events/:eventId/edit-logs/:editLogId
const getEventEditLogById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await EventService.getEventEditLogById(
    req.params.eventId as string,
    req.params.editLogId as string
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event edit log fetched successfully.',
    data: result,
  });
});

// PATCH /events/:eventId/disabled
const setEventDisabled = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const adminUserId = req.user!.userId;
  const { isDisabled } = req.body as { isDisabled: boolean };
  const result = await EventService.setEventDisabledByAdmin(
    req.params.eventId as string,
    adminUserId,
    isDisabled
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: isDisabled ? 'Event disabled successfully.' : 'Event enabled successfully.',
    data: result,
  });
});

// PATCH /events/:eventId
const updateEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventService.updateEvent(
    req.params.eventId as string,
    userId,
    req.body,
    req.file
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event updated successfully.',
    data: result,
  });
});

// DELETE /events/:eventId
const deleteEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const role = req.user!.role as UserRole;
  const result = await EventService.deleteEvent(req.params.eventId as string, userId, role);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event deleted successfully.',
    data: result,
  });
});

export const EventController = {
  createEvent,
  getEvents,
  getUpcomingEvents,
  getTodayEvents,
  getHistoryEvents,
  getEventsByFamilyRelation,
  getEventById,
  getEventEditLogById,
  setEventDisabled,
  updateEvent,
  deleteEvent,
};
