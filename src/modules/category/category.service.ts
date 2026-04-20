import { StatusCodes } from 'http-status-codes';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, uploadSingleFileToS3 } from '../../utils/s3Upload';
import {
    ICategoryFilters,
    ICreateCategoryPayload,
    IUpdateCategoryPayload,
} from './category.interface';
import { CategoryRepository } from './category.repository';

const createCategory = async (payload: ICreateCategoryPayload, file?: Express.Multer.File) => {
  // Step:1 Normalize category name
  const normalizedName = payload.name.trim();

  // Step:2 Check duplicate category name
  const existing = await CategoryRepository.getCategoryByName(normalizedName);
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Category name already exists.');
  }

  let uploadedImageUrl: string | undefined;

  // Step:3 Upload category image if file is provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'categories');
    uploadedImageUrl = uploaded.url;
  }

  try {
    // Step:4 Create new category
    return CategoryRepository.createCategory({
      ...payload,
      name: normalizedName,
      imageUrl: uploadedImageUrl ?? payload.imageUrl,
    });
  } catch (error) {
    // Step:5 Rollback uploaded image if DB create fails
    if (uploadedImageUrl) {
      await deleteFileFromS3(uploadedImageUrl);
    }
    throw error;
  }
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

const updateCategory = async (
  id: string,
  payload: IUpdateCategoryPayload,
  file?: Express.Multer.File
) => {
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

  // Step:3 Validate at least one updatable field is provided
  if (!file && Object.keys(payload).length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'At least one field is required to update category.'
    );
  }

  let uploadedImageUrl: string | undefined;

  // Step:4 Upload new category image if file is provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'categories');
    uploadedImageUrl = uploaded.url;
    payload.imageUrl = uploadedImageUrl;
  }

  try {
    // Step:5 Update and return category
    const updatedCategory = await CategoryRepository.updateCategoryById(id, payload);

    // Step:6 Remove old image after successful update
    if (uploadedImageUrl && existing.imageUrl) {
      await deleteFileFromS3(existing.imageUrl);
    }

    return updatedCategory;
  } catch (error) {
    // Step:7 Rollback newly uploaded image if update fails
    if (uploadedImageUrl) {
      await deleteFileFromS3(uploadedImageUrl);
    }
    throw error;
  }
};

const deleteCategory = async (id: string) => {
  // Step:1 Ensure category exists
  const existing = await CategoryRepository.getCategoryById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found.');
  }

  // Step:2 Best-effort cleanup of category image from S3
  if (existing.imageUrl) {
    try {
      await deleteFileFromS3(existing.imageUrl);
    } catch {
      // Intentionally ignore image cleanup failure to avoid blocking category deletion.
    }
  }

  // Step:3 Soft delete category
  return CategoryRepository.softDeleteCategoryById(id);
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
