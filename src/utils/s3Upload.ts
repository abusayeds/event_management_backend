import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import config from '../config';
import awsConfig from '../config/aws';
import logger from '../config/logger';
import ApiError from './apiError';

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  originalName: string;
  mimeType: string;
  extension: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'webp', 'svg', 'ico'];

const getBucketName = (): string => config.aws.bucketName || awsConfig.bucket;

const getAwsCredentials = () => ({
  accessKeyId: config.aws.accessKeyId || awsConfig.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey || awsConfig.secretAccessKey,
});

const ensureS3Config = () => {
  const bucketName = getBucketName();
  const { accessKeyId, secretAccessKey } = getAwsCredentials();

  if (!bucketName || !accessKeyId || !secretAccessKey) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'AWS S3 is not configured properly. Please set AWS credentials and bucket name.'
    );
  }
};

const sanitizeBaseName = (originalName: string): string => {
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);

  return nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
};

const generateUniqueFilename = (originalName: string): string => {
  const ext = path.extname(originalName).toLowerCase();
  const safeBase = sanitizeBaseName(originalName) || 'image';
  const uniqueId = crypto.randomUUID().slice(0, 8);
  const timestamp = Date.now();

  return `${safeBase}-${timestamp}-${uniqueId}${ext}`;
};

const getFileExtension = (originalName: string): string =>
  path.extname(originalName).toLowerCase().replace('.', '');

const generateFileHash = (buffer: Buffer): string =>
  crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);

const validateImageFile = (file: Express.Multer.File): string => {
  const extension = getFileExtension(file.originalname);

  if (!IMAGE_EXTENSIONS.includes(extension)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Unsupported image type: ${extension}`);
  }

  if (!file.mimetype.startsWith('image/')) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid image mime type: ${file.mimetype}`);
  }

  if (file.size === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Image file is empty.');
  }

  if (file.size > awsConfig.s3.maxFileSize) {
    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const maxSizeMb = (awsConfig.s3.maxFileSize / (1024 * 1024)).toFixed(2);
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Image size (${fileSizeMb}MB) exceeds limit (${maxSizeMb}MB).`
    );
  }

  return extension;
};

const buildS3Url = (key: string): string => {
  const bucketName = getBucketName();

  if (awsConfig.s3.endpoint) {
    return `${awsConfig.s3.endpoint.replace(/\/$/, '')}/${bucketName}/${key}`;
  }

  return `https://${bucketName}.s3.${awsConfig.region}.amazonaws.com/${key}`;
};

export const createS3Client = () => {
  ensureS3Config();

  return new S3Client({
    region: config.aws.region || awsConfig.region,
    credentials: getAwsCredentials(),
    ...(awsConfig.s3.endpoint ? { endpoint: awsConfig.s3.endpoint } : {}),
    forcePathStyle: awsConfig.s3.forcePathStyle,
  });
};

const uploadBufferToS3 = async (
  buffer: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> => {
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // ACL: 'public-read',
      Metadata: metadata,
    })
  );

  return buildS3Url(key);
};

/**
 * Upload single image to S3
 */
export const uploadSingleFileToS3 = async (
  file: Express.Multer.File,
  folder: string = 'uploads'
): Promise<UploadResult> => {
  try {
    const extension = validateImageFile(file);
    const uniqueFilename = generateUniqueFilename(file.originalname);
    const key = `${folder}/images/${uniqueFilename}`;
    const fileHash = generateFileHash(file.buffer);

    const url = await uploadBufferToS3(file.buffer, key, file.mimetype, {
      originalName: file.originalname,
      hash: fileHash,
      uploadedAt: new Date().toISOString(),
      category: 'images',
    });

    return {
      url,
      key,
      size: file.buffer.length,
      originalName: file.originalname,
      mimeType: file.mimetype,
      extension,
    };
  } catch (error) {
    logger.error('Error uploading to S3', { error });
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to upload image to S3: ${error instanceof Error ? error.message : 'Unknown error.'}`
    );
  }
};

export const uploadMultipleFilesToS3 = async (
  files: Express.Multer.File[],
  folder: string = 'uploads'
): Promise<UploadResult[]> => {
  const uploadPromises = files.map(file => uploadSingleFileToS3(file, folder));
  return Promise.all(uploadPromises);
};

export const checkFileExists = async (key: string): Promise<boolean> => {
  try {
    const s3 = createS3Client();
    await s3.send(
      new HeadObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
};

export const deleteFileFromS3 = async (fileUrl: string): Promise<void> => {
  try {
    const url = new URL(fileUrl);
    const key = decodeURIComponent(url.pathname.slice(1));

    const s3 = createS3Client();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      })
    );
  } catch (error) {
    logger.error('Error deleting from S3', { error });
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to delete image from S3: ${error instanceof Error ? error.message : 'Unknown error.'}`
    );
  }
};

export const deleteImageFromS3 = async (key: string) => {
  try {
    const s3 = createS3Client();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      })
    );
  } catch (error) {
    logger.error('Error deleting from S3', { error });
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to delete image from S3: ${error instanceof Error ? error.message : 'Unknown error.'}`
    );
  }
};

/**
 * Generate presigned URL for direct image upload
 */
export const generatePresignedUrl = async (
  fileName: string,
  mimeType: string,
  folder = 'profiles'
) => {
  const extension = getFileExtension(fileName);

  if (!IMAGE_EXTENSIONS.includes(extension)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Unsupported image type: ${extension}`);
  }

  if (!mimeType.startsWith('image/')) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid image mime type: ${mimeType}`);
  }

  const s3 = createS3Client();
  const key = `${folder}/images/${generateUniqueFilename(fileName)}`;

  const presignedUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      ContentType: mimeType,
      // ACL: 'public-read',
    }),
    { expiresIn: awsConfig.s3.signedUrlExpiry }
  );

  return {
    key,
    presignedUrl,
    uploadUrl: buildS3Url(key),
    expiresIn: awsConfig.s3.signedUrlExpiry,
  };
};

export const replaceFileInS3 = async (
  oldFileUrl: string,
  newFile: Express.Multer.File,
  folder: string = 'uploads'
): Promise<UploadResult> => {
  const newUploadResult = await uploadSingleFileToS3(newFile, folder);

  try {
    await deleteFileFromS3(oldFileUrl);
  } catch (error) {
    logger.warn('Old file deletion failed (might not exist)', { error });
  }

  return newUploadResult;
};

export const s3Services = {
  uploadSingleFileToS3,
  uploadMultipleFilesToS3,
  deleteFileFromS3,
  replaceFileInS3,
  checkFileExists,
};
