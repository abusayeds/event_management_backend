import { UserGender, UserRole, UserStatus } from '../../../prisma/generated/enums';

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  gender: UserGender;
  birthDate: Date;
  profilePicture?: string | null;
  location: string;
  country: string;
  state: string;
  city: string;
  skills: string[];
  role: UserRole;
  status: UserStatus;
  isIndependent: boolean;
  isEmailVerified: boolean;
  createdByOwner?: string | null;
  contributionScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateUserPayload {
  accountId?: string;
  username?: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  isEmailVerified?: boolean;
  birthDate: string;
  location: string;
  country: string;
  state: string;
  city: string;
  email: string;
  password: string;
  // Optional fields for  Owner create family members
  skills?: string[];
  isIndependent?: boolean;
  createdById?: string;
}

export interface IUpdateUserPayload {
  username?: string;
  firstName?: string;
  lastName?: string;
  gender?: UserGender;
  birthDate?: string;
  location?: string;
  country?: string;
  state?: string;
  city?: string;
  email?: string;
  skills?: string[];
  isIndependent?: boolean;
  profilePicture?: string;
}

export interface IUserFilters {
  fullName?: string;
  username?: string;
  email?: string;
  status?: UserStatus;
  search?: string;
  role?: string;
  roleId?: string;
  createdByOwner?: string;
  createdById?: string;
}
