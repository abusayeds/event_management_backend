import { z } from 'zod';

// Category ID parameter validation for routes
const idParamSchema = z.object({
  id: z.string().min(1, 'Category id is required'),
});

// Create category payload validation
const createCategory = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Category name is required').max(100, 'Category name is too long'),
    imageUrl: z.string().url('Invalid image URL').optional(),
    description: z.string().trim().max(500, 'Description is too long').optional(),
  }),
});

// Get all categories with optional filters and pagination
const getAllCategories = z.object({
  query: z.object({
    search: z.string().optional(),
    name: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Get single category by ID validation
const getCategoryById = z.object({
  params: idParamSchema,
});

// Update category payload validation
const updateCategory = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Category name cannot be empty').max(100).optional(),
    imageUrl: z.string().url('Invalid image URL').optional(),
    description: z.string().trim().max(500, 'Description is too long').optional(),
  }),
  params: idParamSchema,
});

// Delete category by ID validation
const deleteCategory = z.object({
  params: idParamSchema,
});

export const CategoryValidation = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
