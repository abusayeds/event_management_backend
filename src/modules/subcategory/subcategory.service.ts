import { StatusCodes } from 'http-status-codes';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, uploadSingleFileToS3 } from '../../utils/s3Upload';
import {
    ICreateSubcategoryPayload,
    ISubcategoryFilters,
    IUpdateSubcategoryPayload,
} from './subcategory.interface';
import { SubcategoryRepository } from './subcategory.repository';

const createSubcategory = async (
  payload: ICreateSubcategoryPayload,
  file?: Express.Multer.File
) => {
  // Step:1 Ensure category exists
  const category = await SubcategoryRepository.getCategoryById(payload.categoryId);
  if (!category) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found.');
  }

  // Step:2 Normalize and check duplicate subcategory name
  const normalizedName = payload.name.trim();
  const existing = await SubcategoryRepository.getSubcategoryByName(normalizedName);
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Subcategory name already exists.');
  }

  let uploadedImageUrl: string | undefined;

  // Step:3 Upload image if file is provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'subcategories');
    uploadedImageUrl = uploaded.url;
  }

  try {
    // Step:4 Create subcategory
    return await SubcategoryRepository.createSubcategory({
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

const getAllSubcategories = async (filters: ISubcategoryFilters, options: PaginationOptions) => {
  // Step:1 Fetch subcategories with filters and pagination
  return SubcategoryRepository.getAllSubcategories(filters, options);
};

const getSubcategoryById = async (id: string) => {
  // Step:1 Fetch subcategory by id
  const subcategory = await SubcategoryRepository.getSubcategoryById(id);

  // Step:2 Throw not found when subcategory does not exist or deleted
  if (!subcategory) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Subcategory not found.');
  }

  // Step:3 Return subcategory details
  return subcategory;
};

const updateSubcategory = async (
  id: string,
  payload: IUpdateSubcategoryPayload,
  file?: Express.Multer.File
) => {
  // Step:1 Ensure subcategory exists
  const existing = await SubcategoryRepository.getSubcategoryById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Subcategory not found.');
  }

  // Step:2 Ensure category exists if changing categoryId
  if (payload.categoryId && payload.categoryId !== existing.categoryId) {
    const category = await SubcategoryRepository.getCategoryById(payload.categoryId);
    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found.');
    }
  }

  // Step:3 Check name uniqueness if updating name
  if (payload.name) {
    const normalizedName = payload.name.trim();
    if (normalizedName !== existing.name) {
      const duplicate = await SubcategoryRepository.getSubcategoryByName(normalizedName, id);
      if (duplicate) {
        throw new ApiError(StatusCodes.CONFLICT, 'Subcategory name already exists.');
      }
    }
    payload.name = normalizedName;
  }

  // Step:4 Validate at least one field or file is provided
  if (!file && Object.keys(payload).length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'At least one field is required to update subcategory.'
    );
  }

  let uploadedImageUrl: string | undefined;

  // Step:5 Upload new image if file is provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'subcategories');
    uploadedImageUrl = uploaded.url;
    payload.imageUrl = uploadedImageUrl;
  }

  try {
    // Step:6 Update and return subcategory
    const updatedSubcategory = await SubcategoryRepository.updateSubcategoryById(id, payload);

    // Step:7 Remove old image after successful update
    if (uploadedImageUrl && existing.imageUrl) {
      await deleteFileFromS3(existing.imageUrl);
    }

    return updatedSubcategory;
  } catch (error) {
    // Step:8 Rollback new image if DB update fails
    if (uploadedImageUrl) {
      await deleteFileFromS3(uploadedImageUrl);
    }
    throw error;
  }
};

const deleteSubcategory = async (id: string) => {
  // Step:1 Ensure subcategory exists
  const existing = await SubcategoryRepository.getSubcategoryById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Subcategory not found.');
  }

  // Step:2 Best-effort image cleanup before soft delete
  if (existing.imageUrl) {
    try {
      await deleteFileFromS3(existing.imageUrl);
    } catch {
      // Ignore image cleanup failures so soft delete can still proceed.
    }
  }

  // Step:3 Soft delete subcategory
  return SubcategoryRepository.softDeleteSubcategoryById(id);
};

export const SubcategoryService = {
  createSubcategory,
  getAllSubcategories,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
};
