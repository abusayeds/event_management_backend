import { StatusCodes } from 'http-status-codes';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { deleteFileFromS3, uploadSingleFileToS3 } from '../../utils/s3Upload';
import { ICreateProgramPayload, IProgramFilters, IUpdateProgramPayload } from './program.interface';
import { ProgramRepository } from './program.repository';

const ensureProgramRelations = async (payload: {
  categoryId?: string;
  subcategoryId?: string;
}) => {
  // Step:1 Ensure at least one relationship target is provided
  if (!payload.categoryId && !payload.subcategoryId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Either categoryId or subcategoryId is required.'
    );
  }

  // Step:2 Validate category if provided
  let category: Awaited<ReturnType<typeof ProgramRepository.getCategoryById>> | null = null;
  if (payload.categoryId) {
    category = await ProgramRepository.getCategoryById(payload.categoryId);
    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found.');
    }
  }

  // Step:3 Validate subcategory if provided
  let subcategory: Awaited<ReturnType<typeof ProgramRepository.getSubcategoryById>> | null = null;
  if (payload.subcategoryId) {
    subcategory = await ProgramRepository.getSubcategoryById(payload.subcategoryId);
    if (!subcategory) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Subcategory not found.');
    }
  }

  // Step:4 Validate category and subcategory consistency if both exist
  if (category && subcategory && subcategory.categoryId !== category.id) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Provided subcategory does not belong to the provided category.'
    );
  }

  // Step:5 Auto-populate categoryId from subcategory when missing
  if (!payload.categoryId && subcategory) {
    payload.categoryId = subcategory.categoryId;
  }
};

const createProgram = async (payload: ICreateProgramPayload, file?: Express.Multer.File) => {
  // Step:1 Validate relationships
  await ensureProgramRelations(payload);

  // Step:2 Normalize and check duplicate name
  const normalizedName = payload.name.trim();
  const existing = await ProgramRepository.getProgramByName(normalizedName);
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Program name already exists.');
  }

  let uploadedImageUrl: string | undefined;

  // Step:3 Upload image if file is provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'programs');
    uploadedImageUrl = uploaded.url;
  }

  try {
    // Step:4 Create program
    return await ProgramRepository.createProgram({
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

const getAllPrograms = async (filters: IProgramFilters, options: PaginationOptions) => {
  // Step:1 Fetch programs with filters and pagination
  return ProgramRepository.getAllPrograms(filters, options);
};

const getProgramById = async (id: string) => {
  // Step:1 Fetch program by id
  const program = await ProgramRepository.getProgramById(id);

  // Step:2 Throw not found when program does not exist or deleted
  if (!program) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found.');
  }

  // Step:3 Return program details
  return program;
};

const updateProgram = async (
  id: string,
  payload: IUpdateProgramPayload,
  file?: Express.Multer.File
) => {
  // Step:1 Ensure program exists
  const existing = await ProgramRepository.getProgramById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found.');
  }

  // Step:2 Resolve effective relation values for validation
  const effectiveCategoryId = payload.categoryId ?? existing.categoryId ?? undefined;
  const effectiveSubcategoryId = payload.subcategoryId ?? existing.subcategoryId ?? undefined;
  await ensureProgramRelations({
    categoryId: effectiveCategoryId,
    subcategoryId: effectiveSubcategoryId,
  });

  // Step:3 Sync payload relation values after validation
  if (payload.categoryId !== undefined || payload.subcategoryId !== undefined) {
    payload.categoryId = effectiveCategoryId;
    payload.subcategoryId = effectiveSubcategoryId;
  }

  // Step:4 Check name uniqueness if changing name
  if (payload.name) {
    const normalizedName = payload.name.trim();
    if (normalizedName !== existing.name) {
      const duplicate = await ProgramRepository.getProgramByName(normalizedName, id);
      if (duplicate) {
        throw new ApiError(StatusCodes.CONFLICT, 'Program name already exists.');
      }
    }
    payload.name = normalizedName;
  }

  // Step:5 Validate at least one field or file is provided
  if (!file && Object.keys(payload).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one field is required to update program.');
  }

  let uploadedImageUrl: string | undefined;

  // Step:6 Upload new image if file is provided
  if (file) {
    const uploaded = await uploadSingleFileToS3(file, 'programs');
    uploadedImageUrl = uploaded.url;
    payload.imageUrl = uploadedImageUrl;
  }

  try {
    // Step:7 Update and return program
    const updatedProgram = await ProgramRepository.updateProgramById(id, payload);

    // Step:8 Remove old image after successful update
    if (uploadedImageUrl && existing.imageUrl) {
      await deleteFileFromS3(existing.imageUrl);
    }

    return updatedProgram;
  } catch (error) {
    // Step:9 Rollback newly uploaded image if DB update fails
    if (uploadedImageUrl) {
      await deleteFileFromS3(uploadedImageUrl);
    }
    throw error;
  }
};

const deleteProgram = async (id: string) => {
  // Step:1 Ensure program exists
  const existing = await ProgramRepository.getProgramById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Program not found.');
  }

  // Step:2 Best-effort image cleanup before soft delete
  if (existing.imageUrl) {
    try {
      await deleteFileFromS3(existing.imageUrl);
    } catch {
      // Ignore image cleanup failures so soft delete can still proceed.
    }
  }

  // Step:3 Soft delete program
  return ProgramRepository.softDeleteProgramById(id);
};

export const ProgramService = {
  createProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
};
