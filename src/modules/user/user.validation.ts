import { z } from 'zod';
import { UserGender, UserStatus } from '../../../prisma/generated/enums';
import { strongPasswordSchema } from '../../utils/passwordPolicy';

// User ID parameter validation for routes
const idParamSchema = z.object({
  id: z.string().min(1, 'User id is required'),
});

// Parse skills input from various formats (array, JSON, comma-separated)
const parseSkillsInput = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(item => item.length > 0);
  }

  if (typeof value !== 'string') {
    return [];
  }

  if (value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(item => item.length > 0);
    }
  } catch {
    // If not JSON, treat as comma-separated skills.
  }

  return value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
};

// Reusable update schema for both updateUser and updateMyProfile
const updateUserBodySchema = z
  .object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30).optional(),
    firstName: z.string().trim().min(1, 'firstName cannot be empty').max(60).optional(),
    lastName: z.string().trim().min(1, 'lastName cannot be empty').max(60).optional(),
    gender: z.enum(Object.values(UserGender) as [string, ...string[]]).optional(),
    birthDate: z.string().min(1, 'birthDate cannot be empty').optional(),
    location: z.string().trim().min(1, 'location cannot be empty').optional(),
    country: z.string().trim().min(1, 'country cannot be empty').optional(),
    state: z.string().trim().min(1, 'state cannot be empty').optional(),
    city: z.string().trim().min(1, 'city cannot be empty').optional(),
    email: z.string().email('Invalid email address').optional(),
    isIndependent: z.boolean().optional(),
    profilePicture: z.string().trim().min(1).optional(),
    skills: z
      .union([z.array(z.string().trim().min(1, 'Each skill must be non-empty')), z.string().trim()])
      .optional()
      .transform(value => parseSkillsInput(value)),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: 'At least one field is required to update user',
  });

// Create user validation with profile and authentication fields
const createUser = z.object({
  body: z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30).optional(),
    firstName: z.string().trim().min(1, 'firstName is required').max(60, 'firstName is too long'),
    lastName: z.string().trim().min(1, 'lastName is required').max(60, 'lastName is too long'),
    gender: z.enum(Object.values(UserGender) as [string, ...string[]]),
    birthDate: z.string().min(1, 'birthDate is required'),
    location: z.string().trim().min(1, 'location is required'),
    country: z.string().trim().min(1, 'country is required'),
    state: z.string().trim().min(1, 'state is required'),
    city: z.string().trim().min(1, 'city is required'),
    email: z.string().email('Invalid email address'),
    password: strongPasswordSchema,
    skills: z.array(z.string()).optional(),
    isIndependent: z.boolean().optional(),
    createdById: z.string().optional(),
  }),
});

// Get all users with filtering, pagination, and sorting
const getAllUsers = z.object({
  query: z.object({
    fullName: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    status: z.enum(Object.values(UserStatus) as [string, ...string[]]).optional(),
    role: z.string().optional(),
    roleId: z.string().optional(),
    createdByOwner: z.string().optional(),
    createdById: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Get user by ID parameter validation
const getUserById = z.object({
  params: idParamSchema,
});

// Update user by ID validation
const updateUser = z.object({
  body: updateUserBodySchema,
  params: idParamSchema,
});

// Update own profile validation
const updateMyProfile = z.object({
  body: updateUserBodySchema,
});

// Update user account status validation
const updateUserStatus = z.object({
  body: z.object({
    status: z.enum(Object.values(UserStatus) as [string, ...string[]]),
  }),
  params: idParamSchema,
});

// Delete user by ID validation
const deleteUser = z.object({
  params: idParamSchema,
});

// Check username availability validation
const checkUsernameExists = z.object({
  query: z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30),
  }),
});

// METHOD 2: Presigned URL validation (Future)
const getPresignedUrl = z.object({
  body: z.object({
    fileName: z.string().trim().min(1, 'fileName is required').max(255),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }),
  params: idParamSchema,
});

export const UserValidation = {
  createUser,
  getAllUsers,
  getUserById,
  checkUsernameExists,
  updateUser,
  updateUserStatus,
  deleteUser,
  updateMyProfile,
  getPresignedUrl,
};
