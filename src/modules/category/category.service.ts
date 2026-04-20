import { StatusCodes } from 'http-status-codes';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import {
    ICategoryFilters,
    ICreateCategoryPayload,
    IUpdateCategoryPayload,
} from './category.interface';
import { CategoryRepository } from './category.repository';

const createCategory = async (payload: ICreateCategoryPayload) => {
  // Step:1 Normalize category name
  const normalizedName = payload.name.trim();

  // Step:2 Check duplicate category name
  const existing = await CategoryRepository.getCategoryByName(normalizedName);
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Category name already exists.');
  }

  // Step:3 Create new category
  return CategoryRepository.createCategory({
    ...payload,
    name: normalizedName,
  });
};

const getAllCategories = async (filters: ICategoryFilters, options: PaginationOptions) => {
  // Step:1 Fetch categories with filters and pagination
  return CategoryRepository.getAllCategories(filters, options);
};

const getCategoryById = async (id: string) => {
  // Step:1 Fetch category by id
  const category = await CategoryRepository.getCategoryById(id);

  // Step:2 Throw not found when category does not exist or deleted
  if (!category) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found.');
  }

  // Step:3 Return category details
  return category;
};

const updateCategory = async (id: string, payload: IUpdateCategoryPayload) => {
  // Step:1 Ensure category exists
  const existing = await CategoryRepository.getCategoryById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found.');
  }

  // Step:2 Check name uniqueness if updating name
  if (payload.name) {
    const normalizedName = payload.name.trim();
    if (normalizedName !== existing.name) {
      const duplicate = await CategoryRepository.getCategoryByName(normalizedName, id);
      if (duplicate) {
        throw new ApiError(StatusCodes.CONFLICT, 'Category name already exists.');
      }
    }
    payload.name = normalizedName;
  }

  // Step:3 Update and return category
  return CategoryRepository.updateCategoryById(id, payload);
};

const deleteCategory = async (id: string) => {
  // Step:1 Ensure category exists
  const existing = await CategoryRepository.getCategoryById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found.');
  }

  // Step:2 Soft delete category
  return CategoryRepository.softDeleteCategoryById(id);
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
