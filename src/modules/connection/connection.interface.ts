import { ConnectionStatus } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';

export interface IConnectionUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string | null;
}

export interface IConnection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
  requester: IConnectionUser;
  receiver: IConnectionUser;
}

export interface ICreateConnectionPayload {
  receiverId: string;
}

export interface IConnectionQuery {
  options: PaginationOptions;
}
