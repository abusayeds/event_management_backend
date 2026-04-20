import { z } from 'zod';

// Subcategory ID parameter validation
const idParamSchema = z.object({
  id: z.string().min(1, 'Subcategory id is required'),
});

// Create subcategory payload validation
const createSubcategory = z.object({
  body: z.object({
    categoryId: z.string().min(1, 'Category id is required'),
    name: z.string().trim().min(1, 'Subcategory name is required').max(100, 'Subcategory name is too long'),
    imageUrl: z.string().url('Invalid image URL').optional(),
    description: z.string().trim().max(500, 'Description is too long').optional(),
  }),
});

// Get all subcategories with filters and pagination
const getAllSubcategories = z.object({
  query: z.object({
    search: z.string().optional(),
    name: z.string().optional(),
    categoryId: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Get subcategory by ID validation
const getSubcategoryById = z.object({
  params: idParamSchema,
});

// Update subcategory payload validation
const updateSubcategory = z.object({
  body: z.object({
    categoryId: z.string().min(1, 'Category id cannot be empty').optional(),
    name: z.string().trim().min(1, 'Subcategory name cannot be empty').max(100).optional(),
    imageUrl: z.string().url('Invalid image URL').optional(),
    description: z.string().trim().max(500, 'Description is too long').optional(),
  }),
  params: idParamSchema,
});

// Delete subcategory by ID validation
const deleteSubcategory = z.object({
  params: idParamSchema,
});

export const SubcategoryValidation = {
  createSubcategory,
  getAllSubcategories,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
};
