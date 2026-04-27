import { UserGender, UserRole, UserStatus } from '../../../prisma/generated/enums';

// User domain model with all profile details
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

// Create user payload with optional owner-managed fields
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

// Update user payload with all optional fields
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

// User query filter parameters
export interface IUserFilters {
  username?: string;
  date?: string;
}
