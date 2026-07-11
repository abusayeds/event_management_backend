import { InvitationStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';

export interface IEventInvitationUser {
  id: string;
  accountId: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  profilePicture?: string | null;
  contributionScore: number;
}

export interface IEventInvitationEvent {
  id: string;
  eventName: string;
  coverImage: string;
}

export interface IEventInvitation {
  id: string;
  eventId: string;
  inviterId: string;
  inviteeId: string;
  message: string | null;
  status: InvitationStatus;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  inviter: IEventInvitationUser;
  invitee: IEventInvitationUser;
  event: IEventInvitationEvent;
}

export interface IShareableConnection {
  id: string;
  accountId: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  profilePicture?: string | null;
  contributionScore: number;
  alreadyInvited: boolean;
  invitationStatus: InvitationStatus | null;
}

export interface ISendEventInvitationsPayload {
  inviteeIds: string[];
  message?: string;
}

export interface IEventInvitationQuery {
  options: PaginationOptions;
}
