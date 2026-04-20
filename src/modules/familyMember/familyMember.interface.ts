import { FamilyRole } from '../../../prisma/generated/enums';
import { ICreateUserPayload } from '../user/user.interface';

// Family member relationship with user and family
export interface IFamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  createdAt: string;
  updatedAt: string;
}

// Create family member relationship payload
export interface ICreateFamilyMemberPayload {
  familyId: string;
  userId: string;
  role: FamilyRole;
  relationShip?: string;
}

// Add family member with new user account creation
export interface IAddFamilyMemberWithUserPayload extends ICreateUserPayload {
  familyId: string;
  role?: FamilyRole;
  relationShip?: string;
}

// Family member query filter parameters
export interface IFamilyMemberFilters {
  role?: FamilyRole;
}

// Add family owner payload
export interface IAddFamilyOwnerPayload {
  familyId: string;
  newOwnerUserId: string;
}
