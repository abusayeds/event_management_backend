import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { UserService } from './user.service';

// Create new user (admin only)
const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId: actorId } = req.user!;
  const user = await UserService.createUser(req.body, actorId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'User created successfully.',
    data: user,
  });
});

// Get all users with filters and pagination
const getAllUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, ['username', 'date']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await UserService.getAllUsers(filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Users fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// Get user by ID
const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id: userId } = req.params;
  const user = await UserService.getUserById(userId as string);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User fetched successfully.',
    data: user,
  });
});

// Get authenticated user's own profile
const getMyProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const user = await UserService.getMyProfile(userId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User fetched successfully.',
    data: user,
  });
});

// Update own profile with optional profile picture upload
const updateMyProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.user!;
  const user = await UserService.updateMyProfile(userId, req.body, req.file);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User updated successfully.',
    data: user,
  });
});

const getEditOptions = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const data = await UserService.getEditOptions();
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Edit account options fetched successfully.',
    data,
  });
});

// Update user by ID with authorization checks
const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: userId } = req.params;
  const { userId: actorId, role: actorRole } = req.user!;

  const user = await UserService.updateUser(userId as string, req.body, actorId, actorRole, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User updated successfully.',
    data: user,
  });
});

// Update user status (ACTIVE, BANNED, DELETED)
const updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: userId } = req.params;
  const { userId: actorId } = req.user!;
  const { status } = req.body;
  const user = await UserService.updateUserStatus(userId as string, status, actorId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User status updated successfully.',
    data: user,
  });
});

// Delete user by ID (admin or self)
const deleteUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: targetUserId } = req.params;
  const { userId: actorId, role: actorRole } = req.user!;
  await UserService.deleteUser(targetUserId as string, actorId, actorRole);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User deleted successfully.',
  });
});

// Delete authenticated user's own account
const deleteMyAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId: actorId, role: actorRole } = req.user!;
  await UserService.deleteUser(actorId as string, actorId, actorRole);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User deleted successfully.',
  });
});

// METHOD 2: Get Presigned URL (Future - for direct S3 upload)
// const getProfilePicturePresignedUrl = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
//   const { id: userId } = req.params;
//   const { fileName, mimeType } = req.body;
//
//   const presignedData = await UserService.getProfilePicturePresignedUrl(userId as string, fileName, mimeType);
//
//   apiResponse(res, {
//     success: true,
//     statusCode: StatusCodes.OK,
//     message: 'Presigned URL generated successfully.',
//     data: presignedData,
//   });
// });

// Check if username is already taken
const checkUsernameExists = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.query;
  if (typeof username !== 'string') {
    return apiResponse(res, {
      success: false,
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Username query parameter is required and must be a string.',
    });
  }
  const exists = await UserService.checkUsernameExists(username);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Username existence checked successfully.',
    data: { exists },
  });
});

export const UserController = {
  createUser,
  getAllUsers,
  getMyProfile,
  updateMyProfile,
  getEditOptions,
  getUserById,
  checkUsernameExists,
  updateUser,
  updateUserStatus,
  deleteUserById,
  deleteMyAccount,
};
