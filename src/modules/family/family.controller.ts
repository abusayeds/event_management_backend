import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../utils/asyncHandler';
import apiResponse from '../../utils/apiResponse';
import { FamilyService } from './family.services';
import { AuthenticatedRequest } from '../../interfaces';
import { Response } from 'express';
import pick from '../../utils/pick';

const createFamily = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const result = await FamilyService.createFamily(userId, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Family created successfully.',
    data: result,
  });
});
const getMyFamilies = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const filters = pick(req.query, ['searchTerm']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await FamilyService.getMyFamilies(userId, filters, options);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Families fetched successfully.',
    data: result,
  });
});
const getFamily = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: familyId } = req.params;
  const result = await FamilyService.getFamily(familyId as string);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family fetched successfully.',
    data: result,
  });
});
const updateFamily = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: familyId } = req.params;
  const result = await FamilyService.updateFamily(familyId as string, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family updated successfully.',
    data: result,
  });
});
const deleteFamily = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: familyId } = req.params;
  const result = await FamilyService.deleteFamily(familyId as string);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family deleted successfully.',
    data: result,
  });
});
export const FamilyController = {
  createFamily,
  getMyFamilies,
  getFamily,
  updateFamily,
  deleteFamily,
};
