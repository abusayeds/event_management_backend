import { FamilyRole } from '../../../prisma/generated/enums';

// Family domain model with ownership and metadata
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

// Create family payload with initial member as owner
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

// Family query filter parameters
export interface IFamilyFilters {
  searchTerm?: string;
}
