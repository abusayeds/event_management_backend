import { z } from 'zod';

// Family ID parameter validation for routes
const idParamSchema = z.object({
  id: z.string().min(1, 'Family id is required'),
});

// Create family validation with optional description and image
const createFamily = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Family name is required').max(100, 'Family name is too long'),
    description: z.string().trim().max(500, 'Description is too long').optional(),
    imageUrl: z.string().url('Invalid image URL').optional(),
  }),
});

// Get authenticated user's families with filtering and pagination
const getMyFamilies = z.object({
  query: z.object({
    searchTerm: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Get family by ID validation
const getFamily = z.object({
  params: idParamSchema,
});

// Update family with optional fields validation
const updateFamily = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, 'Family name cannot be empty').max(100).optional(),
      description: z.string().trim().max(500).optional(),
      imageUrl: z.string().url('Invalid image URL').optional(),
    })
    .refine((value: Record<string, unknown>) => Object.keys(value).length > 0, {
      message: 'At least one field is required to update family',
    }),
  params: idParamSchema,
});

// Delete family by ID validation
const deleteFamily = z.object({
  params: idParamSchema,
});

export const FamilyValidation = {
  createFamily,
  getMyFamilies,
  getFamily,
  updateFamily,
  deleteFamily,
};
