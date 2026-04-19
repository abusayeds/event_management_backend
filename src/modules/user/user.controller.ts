import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { UserService } from './user.service';

// POST /api/users
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

// GET /api/users
const getAllUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filters = pick(req.query, [
    'fullName',
    'email',
    'status',
    'roleId',
    'createdById',
    'search',
  ]);
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

// GET /api/users/:id
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

// PATCH /api/users/:id
const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: userId } = req.params;
  const { userId: actorId } = req.user!;
  const user = await UserService.updateUser(userId as string, req.body, actorId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User updated successfully.',
    data: user,
  });
});

// PATCH /api/users/:id/status
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

// DELETE /api/users/:id
const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId: actorId } = req.user!;
  const { id: userId } = req.params;
  await UserService.deleteUser(userId as string, actorId);
  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User deleted successfully.',
  });
});

// checkUsernameExists
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
  getUserById,
  checkUsernameExists,
  updateUser,
  updateUserStatus,
  deleteUser,
};
