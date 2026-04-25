import type { IUpdateCurrentEventSessionPayload } from './event.interface';

/** Client sent a non-empty `currentEventSession` object (not `{}`). */
export function hasCurrentSessionPatchBody(
  body: IUpdateCurrentEventSessionPayload | undefined
): body is IUpdateCurrentEventSessionPayload {
  return Boolean(body && typeof body === 'object' && Object.keys(body).length > 0);
}
