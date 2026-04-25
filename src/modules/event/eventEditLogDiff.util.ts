import { Prisma } from '../../../prisma/generated/client';
import type { IUpdateEventPayload } from './event.interface';
import type { EventAuditSnapshot } from './event.repository';

const EDIT_LOG_SCALAR_FIELDS = [
  'programId',
  'organizer',
  'location',
  'eventPortal',
  'registrationPortal',
  'description',
  'note',
  'isPublished',
  'isActive',
  'isLocked',
  'coverImage',
] as const;

export type EventEditLogPayload = {
  newVersion: number;
  changedFields: string[];
  previousValues: Prisma.InputJsonValue;
};

const toJsonColumnValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(
    JSON.stringify(value, (_k, val) => (typeof val === 'bigint' ? val.toString() : val))
  ) as Prisma.InputJsonValue;

const sameScalar = (before: unknown, after: unknown): boolean => {
  if (before === after) return true;
  if (before == null && after == null) return true;
  if (before == null || after == null) return false;
  if (typeof before === 'object' && typeof after === 'object' && before && after) {
    if ('equals' in before && typeof (before as { equals?: (x: unknown) => boolean }).equals === 'function') {
      try {
        return Boolean((before as { equals: (x: unknown) => boolean }).equals(after));
      } catch {
        return String(before) === String(after);
      }
    }
  }
  return false;
};

const sameRepeatJson = (before: unknown, incoming: unknown): boolean => {
  try {
    return JSON.stringify(before ?? null) === JSON.stringify(incoming ?? null);
  } catch {
    return false;
  }
};
export function diffEventForEditLog(args: {
  before: EventAuditSnapshot;
  scalarPatch: Record<string, unknown>;
  repeatInPayload: boolean;
  incomingRepeat: IUpdateEventPayload['repeatConfig'];
  sessionPatchRequested: boolean;
}): EventEditLogPayload | null {
  const changedFields: string[] = [];
  const previousValues: Record<string, unknown> = {};

  for (const key of EDIT_LOG_SCALAR_FIELDS) {
    if (!(key in args.scalarPatch)) continue;
    const nextVal = args.scalarPatch[key];
    const prevVal = args.before[key];
    if (!sameScalar(prevVal, nextVal)) {
      changedFields.push(key);
      previousValues[key] = prevVal ?? null;
    }
  }

  if (args.repeatInPayload && !sameRepeatJson(args.before.repeatConfig, args.incomingRepeat)) {
    changedFields.push('repeatConfig');
    previousValues.repeatConfig = args.before.repeatConfig ?? null;
  }

  if (args.sessionPatchRequested) {
    changedFields.push('currentEventSession');
    previousValues.currentEventSession = args.before.eventSessions[0] ?? null;
  }

  if (!changedFields.length) return null;

  return {
    changedFields,
    previousValues: toJsonColumnValue(previousValues),
    newVersion: args.before.version + 1,
  };
}
