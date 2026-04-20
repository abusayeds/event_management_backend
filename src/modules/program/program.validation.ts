import { z } from 'zod';

// Program ID parameter validation
const idParamSchema = z.object({
  id: z.string().min(1, 'Program id is required'),
});

// Create program payload validation
const createProgram = z.object({
  body: z
    .object({
      categoryId: z.string().min(1, 'Category id cannot be empty').optional(),
      subcategoryId: z.string().min(1, 'Subcategory id cannot be empty').optional(),
      name: z.string().trim().min(1, 'Program name is required').max(120, 'Program name is too long'),
      description: z.string().trim().max(1000, 'Description is too long').optional(),
      imageUrl: z.string().url('Invalid image URL').optional(),
    })
    .refine(
      value => Boolean(value.categoryId || value.subcategoryId),
      'Either categoryId or subcategoryId is required'
    ),
});

// Get all programs with filters and pagination
const getAllPrograms = z.object({
  query: z.object({
    search: z.string().optional(),
    name: z.string().optional(),
    categoryId: z.string().optional(),
    subcategoryId: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Get program by ID validation
const getProgramById = z.object({
  params: idParamSchema,
});

// Update program payload validation
const updateProgram = z.object({
  body: z.object({
    categoryId: z.string().min(1, 'Category id cannot be empty').optional(),
    subcategoryId: z.string().min(1, 'Subcategory id cannot be empty').optional(),
    name: z.string().trim().min(1, 'Program name cannot be empty').max(120).optional(),
    description: z.string().trim().max(1000, 'Description is too long').optional(),
    imageUrl: z.string().url('Invalid image URL').optional(),
  }),
  params: idParamSchema,
});

// Delete program by ID validation
const deleteProgram = z.object({
  params: idParamSchema,
});

export const ProgramValidation = {
  createProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
};
