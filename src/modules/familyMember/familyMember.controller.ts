import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { FamilyMemberService } from './familyMember.service';

const addFamilyMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.userId;
  const result = await FamilyMemberService.addFamilyMember(actorId, req.body);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Family member added successfully.',
    data: result,
  });
});

const getFamilyMembersByFamilyId = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.userId;
  const familyId = req.params.familyId as string;
  const filters = pick(req.query, ['role']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await FamilyMemberService.getFamilyMembersByFamilyId(
    actorId,
    familyId,
    filters,
    options
  );

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family members fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

const removeFamilyMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.userId;
  const familyId = req.params.familyId as string;
  const userId = req.params.userId as string;

  const result = await FamilyMemberService.removeFamilyMember(actorId, familyId, userId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family member removed successfully.',
    data: result,
  });
});

const addFamilyOwner = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorId = req.user!.userId;
  const result = await FamilyMemberService.addFamilyOwner(actorId, req.body);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Family owner added successfully.',
    data: result,
  });
});

const updateOwnerIndependentStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const actorId = req.user!.userId;
    const familyId = req.params.familyId as string;
    const { isIndependent } = req.body;

    const result = await FamilyMemberService.updateOwnerIndependentStatus(
      actorId,
      familyId,
      isIndependent
    );

    apiResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Owner independence status updated successfully.',
      data: result,
    });
  }
);

export const FamilyMemberController = {
  addFamilyMember,
  getFamilyMembersByFamilyId,
  removeFamilyMember,
  addFamilyOwner,
  updateOwnerIndependentStatus,
};
