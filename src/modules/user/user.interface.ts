import { UserGender, UserStatus } from '../../../prisma/generated/enums';

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  gender: UserGender;
  birthDate: string;
  profilePicture: string;
  location: string;
  country: string;
  state: string;
  city: string;
  skills: string[];
  relationShip: string;
  role: string;
  status: UserStatus;
  isIndependent: boolean;
  isEmailVerified: boolean;
  createdByOwner: boolean;
  contributionScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateUserPayload {
  accountId?: string;
  username?: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  birthDate: string;
  location: string;
  country: string;
  state: string;
  city: string;
  email: string;
  password: string;
  // Optional fields for  Owner create family members
  relationShip?: string;
  skills?: string[];
  isIndependent?: boolean;
  createdById?: string;
}

export interface IUpdateUserPayload {
  username?: string;
  firstName?: string;
  lastName?: string;
  gender?: UserGender;
  email?: string;
}

export interface IUserFilters {
  fullName?: string;
  username?: string;
  email?: string;
  status?: UserStatus;
  searchTerm?: string;
  role?: string;
  roleId?: string;
  createdByOwner?: string;
  createdById?: string;
}
