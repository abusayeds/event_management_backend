import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '../../../prisma/generated/enums';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
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
  const filters = pick(req.query, [
    'search',
    'programId',
    'eventType',
    'location',
    'groupCriteria',
    'timeRangeFrom',
    'timeRangeTo',
    'sessionScope',
    'priceMin',
    'priceMax',
  ]);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await EventService.getEvents(filters, options);

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

// GET /events/feed/family — optional memberUserId (omit = logged-in user’s created events)
const getFamilyFeedEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const filters = pick(req.query, ['action']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await EventService.getFamilyFeedEvents(userId, filters, options);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family-scoped events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// GET /events/:eventId
const getEventById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await EventService.getEventById(req.params.eventId as string);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event fetched successfully.',
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
  getFamilyFeedEvents,
  getUpcomingEvents,
  getTodayEvents,
  getHistoryEvents,
  getEventById,
  updateEvent,
  deleteEvent,
};
