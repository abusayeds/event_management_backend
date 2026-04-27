import { z } from 'zod';
import { FamilyRelationShip, FamilyRole, UserGender } from '../../../prisma/generated/enums';
import { strongPasswordSchema } from '../../utils/passwordPolicy';

// Family ID parameter validation for routes
const familyIdParamSchema = z.object({
  familyId: z.string().min(1, 'familyId is required'),
});

// Family ID and User ID parameter validation
const familyIdAndUserIdParamSchema = z.object({
  familyId: z.string().min(1, 'familyId is required'),
  userId: z.string().min(1, 'userId is required'),
});

// Add new family member with user account creation
const addFamilyMember = z.object({
  body: z.object({
    familyId: z.string().min(1, 'familyId is required'),
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
    relationShip: z.nativeEnum(FamilyRelationShip),
    skills: z.array(z.string()).optional(),
    role: z.enum(Object.values(FamilyRole) as [string, ...string[]]).optional(),
  }),
});

// Get family members with filtering and pagination
const getFamilyMembersByFamilyId = z.object({
  params: familyIdParamSchema,
  query: z.object({
    role: z.enum(Object.values(FamilyRole) as [string, ...string[]]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Remove family member from family
const removeFamilyMember = z.object({
  params: familyIdAndUserIdParamSchema,
});

// Add new family owner
const addFamilyOwner = z.object({
  body: z.object({
    familyId: z.string().min(1, 'familyId is required'),
    newOwnerUserId: z.string().min(1, 'newOwnerUserId is required'),
  }),
});

// Update family member independence status (owner only)
const updateOwnerIndependentStatus = z.object({
  params: familyIdParamSchema,
  body: z.object({
    targetUserId: z.string().min(1, 'targetUserId is required'),
    isIndependent: z.boolean(),
  }),
});

export const FamilyMemberValidation = {
  addFamilyMember,
  getFamilyMembersByFamilyId,
  removeFamilyMember,
  addFamilyOwner,
  updateOwnerIndependentStatus,
};
