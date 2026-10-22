import { Request, Response, Router } from 'express';
import { UserRole } from '../../../prisma/generated/enums';
import { database } from '../../config/database';
import { auth } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import apiResponse from '../../utils/apiResponse';
import ApiError from '../../utils/apiError';
import asyncHandler from '../../utils/asyncHandler';
import {
  dashboardAsset,
  dashboardAssetFiles,
  DashboardAssetKey,
  saveDashboardAsset,
} from '../../utils/dashboardAssets';
import {
  deleteFileFromS3,
  getDefaultProfilePictureUrl,
  uploadSingleFileToS3,
} from '../../utils/s3Upload';

export const imageModels = {
  category: { field: 'imageUrl', name: 'name', folder: 'categories' },
  subcategory: { field: 'imageUrl', name: 'name', folder: 'subcategories' },
  program: { field: 'imageUrl', name: 'name', folder: 'programs' },
  event: { field: 'coverImage', name: 'eventName', folder: 'events' },
  user: { field: 'profilePicture', name: 'username', folder: 'profiles' },
  family: { field: 'imageUrl', name: 'name', folder: 'families' },
  notification: { field: 'image', name: 'title', folder: 'notifications' },
} as const;
type ImageModel = keyof typeof imageModels;
type Row = Record<string, unknown> & { id: string; category?: { name: string } };
interface ImageDelegate {
  findMany(args: object): Promise<Row[]>;
  findUnique(args: object): Promise<Row | null>;
  count(args: object): Promise<number>;
  updateMany(args: object): Promise<{ count: number }>;
}
const getModel = (value: unknown): ImageModel => {
  if (typeof value !== 'string' || !Object.hasOwn(imageModels, value))
    throw new ApiError(400, 'Unknown image model.');
  return value as ImageModel;
};
const delegate = (model: ImageModel) => database[model] as unknown as ImageDelegate;
const selectFor = (model: ImageModel) => ({
  id: true,
  [imageModels[model].name]: true,
  [imageModels[model].field]: true,
  ...(['subcategory', 'program'].includes(model) ? { category: { select: { name: true } } } : {}),
});
const serialize = (model: ImageModel, row: Row) => ({
  id: row.id,
  model,
  name: row[imageModels[model].name],
  field: imageModels[model].field,
  imageUrl: row[imageModels[model].field],
  ...(row.category ? { category: row.category } : {}),
});

export const MediaRoutes = Router();
// Login illustrations must be readable before authentication.
MediaRoutes.get(
  '/assets',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await Promise.all(
      (Object.keys(dashboardAssetFiles) as DashboardAssetKey[]).map(async key => ({
        id: key,
        name: key,
        imageUrl: await dashboardAsset(key),
      }))
    );
    apiResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Dashboard assets fetched.',
      data,
    });
  })
);
MediaRoutes.use(auth(UserRole.ADMIN));
MediaRoutes.patch(
  '/assets/:key',
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.params.key as string;
    if (!Object.hasOwn(dashboardAssetFiles, key))
      throw new ApiError(400, 'Unknown dashboard asset.');
    if (!req.file) throw new ApiError(400, 'Attach an image file in the image field.');
    const result = await uploadSingleFileToS3(req.file, 'dashboard');
    try {
      await saveDashboardAsset(key as DashboardAssetKey, result.url);
    } catch (error) {
      await deleteFileFromS3(result.url);
      throw error;
    }
    apiResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Dashboard asset saved.',
      data: { id: key, imageUrl: result.url },
    });
  })
);
// Includes archived records so the maintenance inventory does not hide images.
MediaRoutes.get(
  '/images/:model',
  asyncHandler(async (req: Request, res: Response) => {
    const model = getModel(req.params.model);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 100);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new ApiError(400, 'Invalid image inventory pagination.');
    const [rows, total] = await Promise.all([
      delegate(model).findMany({
        select: selectFor(model),
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      delegate(model).count({}),
    ]);
    const totalPages = Math.ceil(total / limit);
    apiResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Image inventory fetched.',
      data: rows.map(row => serialize(model, row)),
      meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  })
);
MediaRoutes.patch(
  '/images/:model/:id',
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    const model = getModel(req.params.model);
    const id = req.params.id as string;
    if (!req.file && !(model === 'user' && req.body?.useDefault === true))
      throw new ApiError(400, 'Attach an image file in the image field.');
    const repository = delegate(model);
    const row = await repository.findUnique({ where: { id }, select: selectFor(model) });
    if (!row) throw new ApiError(404, 'Image record not found.');
    const { field, folder } = imageModels[model];
    const result = req.file
      ? await uploadSingleFileToS3(req.file, folder)
      : { url: getDefaultProfilePictureUrl() };
    try {
      const changed = await repository.updateMany({
        where: { id, [field]: row[field] },
        data: { [field]: result.url, ...(model === 'event' ? { version: { increment: 1 } } : {}) },
      });
      if (!changed.count)
        throw new ApiError(409, 'Image changed during upload; reload and try again.');
    } catch (error) {
      if (req.file) await deleteFileFromS3(result.url);
      throw error;
    }
    // Old files may be shared by other records. Retain them for backup and recovery.
    apiResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Image uploaded and saved.',
      data: serialize(model, { ...row, [field]: result.url }),
    });
  })
);
