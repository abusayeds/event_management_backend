import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StatusCodes } from 'http-status-codes';
import awsConfig from '../config/aws';
import ApiError from './apiError';

const sanitizeFileName = (fileName: string) => {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  return baseName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
};

const createS3Client = () => {
  if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey || !awsConfig.bucket) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'AWS S3 is not configured properly. Please set AWS credentials and bucket name.'
    );
  }

  return new S3Client({
    region: awsConfig.region,
    credentials: {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
    },
    ...(awsConfig.s3.endpoint ? { endpoint: awsConfig.s3.endpoint } : {}),
    forcePathStyle: awsConfig.s3.forcePathStyle,
  });
};

/**
 * METHOD 1: Backend Relay Upload (Current)
 * File uploaded to backend, then relayed to S3
 */
export const uploadImageToS3 = async (file: Express.Multer.File, folder: string = 'uploads') => {
  try {
    const s3 = createS3Client();
    const extension = file.originalname.includes('.')
      ? file.originalname.split('.').pop()?.toLowerCase()
      : '';
    const safeName = sanitizeFileName(file.originalname);
    const key = `${folder}/${Date.now()}-${safeName}${extension ? `.${extension}` : ''}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: awsConfig.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      })
    );

    const url = awsConfig.s3.endpoint
      ? `${awsConfig.s3.endpoint.replace(/\/$/, '')}/${awsConfig.bucket}/${key}`
      : `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`;

    return {
      key,
      url,
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to upload image to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const deleteImageFromS3 = async (key: string) => {
  try {
    const s3 = createS3Client();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: awsConfig.bucket,
        Key: key,
      })
    );
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to delete image from S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * METHOD 2: Presigned URL (Future)
 * Frontend directly uploads to S3 using signed URL
 */
export const generatePresignedUrl = async (
  fileName: string,
  mimeType: string,
  folder = 'profiles'
) => {
  const s3 = createS3Client();
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  const safeName = sanitizeFileName(fileName);
  const key = `${folder}/${Date.now()}-${safeName}${extension ? `.${extension}` : ''}`;

  const presignedUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      ContentType: mimeType,
      ACL: 'public-read',
    }),
    { expiresIn: awsConfig.s3.signedUrlExpiry }
  );

  return {
    key,
    presignedUrl,
    uploadUrl: `https://${awsConfig.bucket}.s3.amazonaws.com/${key}`,
    expiresIn: awsConfig.s3.signedUrlExpiry,
  };
};
