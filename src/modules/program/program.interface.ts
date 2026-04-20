import { PaginationOptions } from '../../interfaces';

// Program domain model
export interface IProgram {
  id: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create program payload
export interface ICreateProgramPayload {
  categoryId?: string;
  subcategoryId?: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

// Update program payload
export interface IUpdateProgramPayload {
  categoryId?: string;
  subcategoryId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
}

// Program query filters
export interface IProgramFilters {
  search?: string;
  name?: string;
  categoryId?: string;
  subcategoryId?: string;
}

// Program list query shape
export interface IProgramQuery {
  filters: IProgramFilters;
  options: PaginationOptions;
}
