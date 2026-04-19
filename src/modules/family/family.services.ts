import { StatusCodes } from 'http-status-codes';
import { FamilyRole } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import ApiError from '../../utils/apiError';
import { ICreateFamilyPayload, IFamilyFilters } from './family.interface';
import { FamilyRepository } from './family.repository';
import { UserRepository } from '../user/user.repository';

const createFamily = async (userId: string, payload: Partial<ICreateFamilyPayload>) => {
  // Step 1 : Check user  exist
  const user = await UserRepository.getUserById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }
  // Step 2: Check if a family with the same name already exists
  const existingFamily = await FamilyRepository.getFamilyByName(payload.name!);
  if (existingFamily) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Family with this name already exists! Please choose a different name.'
    );
  }
  //   Step 3: Create family Body
  const familyBody = {
    name: payload.name || 'My Family',
    description: payload.description,
    createdBy: userId,
    familyMembers: {
      userId: userId,
      role: FamilyRole.OWNER,
    },
  };
  const result = await FamilyRepository.createFamily(familyBody);
  return result;
};

const getMyFamilies = async (
  userId: string,
  filters: IFamilyFilters,
  options: PaginationOptions
) => {
  const result = await FamilyRepository.getMyFamilies(userId, filters, options);
  return result;
};
const getFamily = async (familyId: string) => {
  const result = await FamilyRepository.getFamily(familyId);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found');
  }
  return result;
};
const updateFamily = async (familyId: string, payload: Partial<ICreateFamilyPayload>) => {
  // Step 1: Check if family exist
  const existingFamily = await FamilyRepository.getFamily(familyId);
  if (!existingFamily) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found');
  }
  //   Step 2: If name is being updated, check if another family with the same name exists
  if (payload.name && payload.name !== existingFamily.name) {
    const familyWithSameName = await FamilyRepository.getFamilyByName(payload.name);
    if (familyWithSameName) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Another family with this name already exists! Please choose a different name.'
      );
    }
  }
  const result = await FamilyRepository.updateFamily(familyId, payload);
  return result;
};

const deleteFamily = async (familyId: string) => {
  // Step 1: Check if family exist
  const existingFamily = await FamilyRepository.getFamily(familyId);
  if (!existingFamily) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Family not found');
  }
  //   Step 2: Soft delete the family
  const result = await FamilyRepository.deleteFamily(familyId);
  return result;
};
export const FamilyService = {
  createFamily,
  getMyFamilies,
  getFamily,
  updateFamily,
  deleteFamily,
};
