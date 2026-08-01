import { database } from '../../config/database';
import { ICreateHomeEventPayload, IUpdateHomeEventPayload } from './cretehomeevent.interface';

/** Columns returned for every HomeEvent query. */
const homeEventSelect = {
  id: true,
  title: true,
  location: true,
  member: true,
  startsAt: true,
  endsAt: true,
  repeatFunction: true,
  url: true,
  note: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

const homeEventModel = () => database.homeEvent;

const create = async (createdById: string, payload: ICreateHomeEventPayload) => {
  return homeEventModel().create({
    data: {
      title: payload.title,
      location: payload.location,
      member: payload.member || null,
      startsAt: new Date(payload.startsAt),
      endsAt: new Date(payload.endsAt),
      repeatFunction: payload.repeatFunction ?? 'Never',
      url: payload.url || null,
      note: payload.note || null,
      createdById,
    },
    select: homeEventSelect,
  });
};

const findById = async (id: string) => {
  return homeEventModel().findUnique({
    where: { id },
    select: homeEventSelect,
  });
};

const findAllByCreator = async (createdById: string) => {
  return homeEventModel().findMany({
    where: { createdById },
    select: homeEventSelect,
    orderBy: { startsAt: 'asc' },
  });
};

const updateById = async (id: string, data: IUpdateHomeEventPayload) => {
  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.member !== undefined) updateData.member = data.member || null;
  if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
  if (data.endsAt !== undefined) updateData.endsAt = new Date(data.endsAt);
  if (data.repeatFunction !== undefined) updateData.repeatFunction = data.repeatFunction;
  if (data.url !== undefined) updateData.url = data.url || null;
  if (data.note !== undefined) updateData.note = data.note || null;

  return homeEventModel().update({
    where: { id },
    data: updateData,
    select: homeEventSelect,
  });
};

const deleteById = async (id: string) => {
  return homeEventModel().delete({ where: { id }, select: { id: true } });
};

export const HomeEventRepository = {
  create,
  findById,
  findAllByCreator,
  updateById,
  deleteById,
};
