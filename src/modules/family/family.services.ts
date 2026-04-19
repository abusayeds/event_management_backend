import { FamilyRole } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';
import { ICreateFamilyPayload, IFamilyFilters } from './family.interface';
import { FamilyRepository } from './family.repository';

const createFamily = async (userId: string, payload: Partial<ICreateFamilyPayload>) => {
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
