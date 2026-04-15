import { UserGender, UserStatus } from '../../../prisma/generated/enums';

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  gender: UserGender;
  birthdate: string;
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
  username: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  birthdate: string;
  location: string;
  country: string;
  state: string;
  city: string;
  email: string;
  password: string;
  // Optional fields for  Owner create family members
  relationShip?: string;
  accountId?: string;
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
  email?: string;
  status?: UserStatus;
  search?: string;
  roleId?: string;
  createdById?: string;
}
