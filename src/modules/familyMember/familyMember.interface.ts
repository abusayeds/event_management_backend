import { FamilyRole } from '../../../prisma/generated/enums';
import { ICreateUserPayload } from '../user/user.interface';

export interface IFamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateFamilyMemberPayload {
  familyId: string;
  userId: string;
  role: FamilyRole;
  relationShip?: string;
}

export interface IAddFamilyMemberWithUserPayload extends ICreateUserPayload {
  familyId: string;
  role?: FamilyRole;
  relationShip?: string;
}

export interface IFamilyMemberFilters {
  role?: FamilyRole;
}

export interface IAddFamilyOwnerPayload {
  familyId: string;
  newOwnerUserId: string;
}
