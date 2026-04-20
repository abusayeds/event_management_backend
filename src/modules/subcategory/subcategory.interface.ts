import { PaginationOptions } from '../../interfaces';

// Subcategory domain model
export interface ISubcategory {
  id: string;
  categoryId: string;
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create subcategory payload
export interface ICreateSubcategoryPayload {
  categoryId: string;
  name: string;
  imageUrl?: string;
  description?: string;
}

// Update subcategory payload
export interface IUpdateSubcategoryPayload {
  categoryId?: string;
  name?: string;
  imageUrl?: string;
  description?: string;
}

// Subcategory query filters
export interface ISubcategoryFilters {
  search?: string;
  name?: string;
  categoryId?: string;
}

// Subcategory list query shape
export interface ISubcategoryQuery {
  filters: ISubcategoryFilters;
  options: PaginationOptions;
}
