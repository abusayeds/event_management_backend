import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { ProgramService } from './program.service';

// Create program
const createProgram = asyncHandler(async (req: Request, res: Response) => {
  const result = await ProgramService.createProgram(req.body, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Program created successfully.',
    data: result,
  });
});

// Get all programs
const getAllPrograms = asyncHandler(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['search', 'name', 'categoryId', 'subcategoryId']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await ProgramService.getAllPrograms(filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Programs fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// Get program by id
const getProgramById = asyncHandler(async (req: Request, res: Response) => {
  const programId = req.params.id as string;
  const result = await ProgramService.getProgramById(programId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Program fetched successfully.',
    data: result,
  });
});

// Update program by id
const updateProgram = asyncHandler(async (req: Request, res: Response) => {
  const programId = req.params.id as string;
  const result = await ProgramService.updateProgram(programId, req.body, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Program updated successfully.',
    data: result,
  });
});

// Soft delete program by id
const deleteProgram = asyncHandler(async (req: Request, res: Response) => {
  const programId = req.params.id as string;
  const result = await ProgramService.deleteProgram(programId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Program deleted successfully.',
    data: result,
  });
});

export const ProgramController = {
  createProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
};
