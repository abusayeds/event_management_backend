import { FamilyRole } from '../../../prisma/generated/enums';

export interface IFamily {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  createdBy: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateFamilyPayload {
  name: string;
  description?: string;
  imageUrl?: string;
  createdBy: string;
  familyMembers: {
    userId: string;
    role: FamilyRole;
  };
}

export interface IFamilyFilters {
  searchTerm?: string;
}
