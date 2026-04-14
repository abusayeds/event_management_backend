// User status enum
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export interface IUser {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  createdById?: string;
}

export interface IUpdateUserPayload {
  fullName?: string;
  email?: string;
}

export interface IUserFilters {
  fullName?: string;
  email?: string;
  status?: UserStatus;
  search?: string;
  roleId?: string;
  createdById?: string;
}
