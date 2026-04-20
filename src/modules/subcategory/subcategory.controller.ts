import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { SubcategoryService } from './subcategory.service';

// Create subcategory
const createSubcategory = asyncHandler(async (req: Request, res: Response) => {
  const result = await SubcategoryService.createSubcategory(req.body, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Subcategory created successfully.',
    data: result,
  });
});

// Get all subcategories
const getAllSubcategories = asyncHandler(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['search', 'name', 'categoryId']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await SubcategoryService.getAllSubcategories(filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Subcategories fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// Get subcategory by id
const getSubcategoryById = asyncHandler(async (req: Request, res: Response) => {
  const subcategoryId = req.params.id as string;
  const result = await SubcategoryService.getSubcategoryById(subcategoryId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Subcategory fetched successfully.',
    data: result,
  });
});

// Update subcategory by id
const updateSubcategory = asyncHandler(async (req: Request, res: Response) => {
  const subcategoryId = req.params.id as string;
  const result = await SubcategoryService.updateSubcategory(subcategoryId, req.body, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Subcategory updated successfully.',
    data: result,
  });
});

// Soft delete subcategory by id
const deleteSubcategory = asyncHandler(async (req: Request, res: Response) => {
  const subcategoryId = req.params.id as string;
  const result = await SubcategoryService.deleteSubcategory(subcategoryId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Subcategory deleted successfully.',
    data: result,
  });
});

export const SubcategoryController = {
  createSubcategory,
  getAllSubcategories,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
};
