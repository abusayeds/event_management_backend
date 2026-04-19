import { FamilyRole } from '../../../prisma/generated/enums';

export interface IFamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  createdAt: string;
  updatedAt: string;
}
