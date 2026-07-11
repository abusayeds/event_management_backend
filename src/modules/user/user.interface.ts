import { UserGender, UserRole, UserStatus } from '../../../prisma/generated/enums';

export interface IUserSkillInput {
  id?: string;
  programId?: string;
  /** Program name (e.g. Chess). Created if missing. */
  program?: string;
  /** Alias for program. */
  skill?: string;
  startYear: number;
}

export interface IUserSkillResponse {
  id: string;
  programId: string | null;
  programName: string;
  startYear: number;
  label: string;
}

// User domain model with all profile details
export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  displayName?: string | null;
  email: string;
  password: string;
  phoneNumber?: string | null;
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
  hasSeparateAccount: boolean;
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
  hasSeparateAccount?: boolean;
  createdById?: string;
}

// Update user payload with all optional fields
export interface IUpdateUserPayload {
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  gender?: UserGender;
  birthDate?: string;
  location?: string;
  country?: string;
  state?: string;
  city?: string;
  email?: string;
  phoneNumber?: string | null;
  skills?: string[] | IUserSkillInput[];
  hasSeparateAccount?: boolean;
  profilePicture?: string;
}

// User query filter parameters
export interface IUserFilters {
  username?: string;
  date?: string;
}
