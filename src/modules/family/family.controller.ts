import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { FamilyService } from './family.services';

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
  const familyId = req.params.id as string;
  const result = await FamilyService.getFamily(familyId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family fetched successfully.',
    data: result,
  });
});
const updateFamily = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const familyId = req.params.id as string;
  const result = await FamilyService.updateFamily(familyId, req.body);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family updated successfully.',
    data: result,
  });
});
const deleteFamily = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const familyId = req.params.id as string;
  const result = await FamilyService.deleteFamily(familyId);
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
