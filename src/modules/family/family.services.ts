import { StatusCodes } from 'http-status-codes';
import { FamilyRole } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { UserRepository } from '../user/user.repository';
import { ICreateFamilyPayload, IFamilyFilters } from './family.interface';
import { FamilyRepository } from './family.repository';

const createFamily = async (userId: string, payload: Partial<ICreateFamilyPayload>) => {
  // Step:1 Check user exists
  const user = await UserRepository.getUserById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }
  // Step:2 Check if a family with the same name already exists
  const existingFamily = await FamilyRepository.getFamilyByName(payload.name!);
  if (existingFamily) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Family with this name already exists! Please choose a different name.'
    );
  }
  //   Step:3 Create family body with creator as owner
  const familyBody = {
    name: payload.name || 'My Family',
    description: payload.description,
    createdBy: userId,
    familyMembers: {
      userId: userId,
      role: FamilyRole.OWNER,
    },
  };
  // Step:4 Create family in database
  const result = await FamilyRepository.createFamily(familyBody);
  // Step:5 Return created family
  return result;
};

const getMyFamilies = async (
  userId: string,
  filters: IFamilyFilters,
  options: PaginationOptions
) => {
  // Step:1 Fetch user's families from repository
  const result = await FamilyRepository.getMyFamilies(userId, filters, options);
  // Step:2 Return families with pagination
  return result;
};

const getFamily = async (familyId: string) => {
  // Step:1 Fetch family from repository by ID
  const result = await FamilyRepository.getFamily(familyId);
  // Step:2 Throw error if family not found
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found');
  }
  // Step:3 Return family details
  return result;
};

const updateFamily = async (familyId: string, payload: Partial<ICreateFamilyPayload>) => {
  // Step:1 Check if family exists
  const existingFamily = await FamilyRepository.getFamily(familyId);
  if (!existingFamily) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found');
  }
  //   Step:2 If name is being updated, check if another family with same name exists
  if (payload.name && payload.name !== existingFamily.name) {
    const familyWithSameName = await FamilyRepository.getFamilyByName(payload.name);
    if (familyWithSameName) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Another family with this name already exists! Please choose a different name.'
      );
    }
  }
  // Step:3 Update family in database
  const result = await FamilyRepository.updateFamily(familyId, payload);
  // Step:4 Return updated family
  return result;
};

const deleteFamily = async (familyId: string) => {
  // Step:1 Check if family exists
  const existingFamily = await FamilyRepository.getFamily(familyId);
  if (!existingFamily) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found');
  }
  //   Step:2 Soft delete the family (set isDeleted flag)
  const result = await FamilyRepository.deleteFamily(familyId);
  // Step:3 Return deletion result
  return result;
};
export const FamilyService = {
  createFamily,
  getMyFamilies,
  getFamily,
  updateFamily,
  deleteFamily,
};
