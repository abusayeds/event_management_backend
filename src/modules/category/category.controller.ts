import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import apiResponse from '../../utils/apiResponse';
import asyncHandler from '../../utils/asyncHandler';
import pick from '../../utils/pick';
import { CategoryService } from './category.service';

// Create category
const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const result = await CategoryService.createCategory(req.body, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Category created successfully.',
    data: result,
  });
});

// Get all categories
const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['search', 'name']);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);

  const result = await CategoryService.getAllCategories(filters, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Categories fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// Get category by id with events
const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = req.params.id as string;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await CategoryService.getCategoryById(categoryId, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Category fetched successfully.',
    data: result,
  });
});

// Update category by id
const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = req.params.id as string;
  const result = await CategoryService.updateCategory(categoryId, req.body, req.file);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Category updated successfully.',
    data: result,
  });
});

// Get paginated events under a category
const getCategoryEvents = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = req.params.id as string;
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await CategoryService.getCategoryEvents(categoryId, options);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Category events fetched successfully.',
    data: result.data,
    meta: result.meta,
  });
});

// Soft delete category by id
const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = req.params.id as string;
  const result = await CategoryService.deleteCategory(categoryId);

  apiResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Category deleted successfully.',
    data: result,
  });
});

export const CategoryController = {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryEvents,
  updateCategory,
  deleteCategory,
};
