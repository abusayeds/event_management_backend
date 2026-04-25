import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '../../../prisma/generated/enums';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { EventService } from './event.service';

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

const listEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  const result = await EventService.listEvents(filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const listActiveEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.listActiveEvents(options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Active events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const listUpcomingEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.listUpcomingEvents(options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Upcoming events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const listTodayEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.listTodayEvents(options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Today's events fetched successfully.",
    data: result.data,
    meta: result.meta,
  });
});

const listHistoryEvents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const price = pick(req.query, ['priceMin', 'priceMax']);
  const result = await EventService.listHistoryEvents(options, price);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'History events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const getCalendarMonthFeed = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, ['programId', 'priceMin', 'priceMax']);
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const result = await EventService.getCalendarMonthFeed(year, month, filters);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Calendar month summary fetched successfully.',
    data: result,
  });
});

const getCalendarDayFeed = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, ['programId', 'priceMin', 'priceMax']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const dateStr = String(req.query.date);
  const result = await EventService.getCalendarDayFeed(dateStr, filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Events for the selected day fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const getEventById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await EventService.getEventById(req.params.eventId as string);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event fetched successfully.',
    data: result,
  });
});

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

const listEventSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await EventService.listEventSessions(req.params.eventId as string);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event sessions fetched successfully.',
    data: result,
  });
});

const verifyEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventService.verifyEvent(req.params.eventId as string, userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event verified successfully.',
    data: result,
  });
});

const applyToEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventService.applyToEvent(req.params.eventId as string, userId, req.body?.note);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application submitted successfully.',
    data: result,
  });
});

const withdrawApplication = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await EventService.withdrawApplication(req.params.eventId as string, userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Application withdrawn successfully.',
    data: result,
  });
});

const listEventApplications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const requesterId = req.user!.userId;
  const role = req.user!.role as UserRole;
  const result = await EventService.listEventApplications(req.params.eventId as string, requesterId, role);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Event applications fetched successfully.',
    data: result,
  });
});

export const EventController = {
  createEvent,
  listEvents,
  listActiveEvents,
  listUpcomingEvents,
  listTodayEvents,
  listHistoryEvents,
  getCalendarMonthFeed,
  getCalendarDayFeed,
  getEventById,
  updateEvent,
  deleteEvent,
  listEventSessions,
  verifyEvent,
  applyToEvent,
  withdrawApplication,
  listEventApplications,
};
