import { PaginationOptions } from '../../interfaces';

// Category domain model
export interface ICategory {
  id: string;
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create category payload
export interface ICreateCategoryPayload {
  name: string;
  imageUrl?: string;
  description?: string;
}

// Update category payload
export interface IUpdateCategoryPayload {
  name?: string;
  imageUrl?: string;
  description?: string;
}

// Category query filters
export interface ICategoryFilters {
  search?: string;
  name?: string;
}

// Category list query shape
export interface ICategoryQuery {
  filters: ICategoryFilters;
  options: PaginationOptions;
}
