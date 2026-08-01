import { StatusCodes } from 'http-status-codes';
import ApiError from '../../utils/apiError';
import { HomeEventRepository } from './cretehomeevent.repository';
import { ICreateHomeEventPayload, IUpdateHomeEventPayload } from './cretehomeevent.interface';

const createHomeEvent = async (payload: ICreateHomeEventPayload, createdById: string) => {
  const startsAt = new Date(payload.startsAt);
  const endsAt = new Date(payload.endsAt);

  if (endsAt <= startsAt) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'endsAt must be after startsAt');
  }

  return HomeEventRepository.create(createdById, payload);
};

const getHomeEventById = async (id: string, requesterId: string) => {
  const event = await HomeEventRepository.findById(id);
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Home event not found');
  }
  // Only the creator may view their own home event
  if (event.createdById !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to view this home event');
  }
  return event;
};

const getAllHomeEvents = async (createdById: string) => {
  return HomeEventRepository.findAllByCreator(createdById);
};

const updateHomeEvent = async (
  id: string,
  payload: IUpdateHomeEventPayload,
  requesterId: string
) => {
  const event = await HomeEventRepository.findById(id);
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Home event not found');
  }
  if (event.createdById !== requesterId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You do not have permission to update this home event'
    );
  }

  // Validate updated date range when both sides are present
  const newStartsAt = payload.startsAt ? new Date(payload.startsAt) : event.startsAt;
  const newEndsAt = payload.endsAt ? new Date(payload.endsAt) : event.endsAt;
  if (newEndsAt <= newStartsAt) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'endsAt must be after startsAt');
  }

  return HomeEventRepository.updateById(id, payload);
};

const deleteHomeEvent = async (id: string, requesterId: string) => {
  const event = await HomeEventRepository.findById(id);
  if (!event) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Home event not found');
  }
  if (event.createdById !== requesterId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You do not have permission to delete this home event'
    );
  }
  return HomeEventRepository.deleteById(id);
};

export const HomeEventService = {
  createHomeEvent,
  getHomeEventById,
  getAllHomeEvents,
  updateHomeEvent,
  deleteHomeEvent,
};
