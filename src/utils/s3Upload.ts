import AWS from 'aws-sdk';
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

  return new AWS.S3({
    credentials: {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
    },
    region: awsConfig.region,
    ...(awsConfig.s3.endpoint ? { endpoint: awsConfig.s3.endpoint } : {}),
    s3ForcePathStyle: awsConfig.s3.forcePathStyle,
    signatureVersion: 'v4',
  });
};

/**
 * METHOD 1: Backend Relay Upload (Current)
 * File uploaded to backend, then relayed to S3
 */
export const uploadImageToS3 = async (
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
  folder = 'profiles'
) => {
  const s3 = createS3Client();
  const extension = originalName.includes('.') ? originalName.split('.').pop()?.toLowerCase() : '';
  const safeName = sanitizeFileName(originalName);
  const key = `${folder}/${Date.now()}-${safeName}${extension ? `.${extension}` : ''}`;

  const result = await s3
    .upload({
      Bucket: awsConfig.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'public-read',
    })
    .promise();

  return {
    key,
    url: result.Location,
  };
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

  const presignedUrl = await s3.getSignedUrlPromise('putObject', {
    Bucket: awsConfig.bucket,
    Key: key,
    ContentType: mimeType,
    Expires: awsConfig.s3.signedUrlExpiry,
    ACL: 'public-read',
  });

  return {
    key,
    presignedUrl,
    uploadUrl: `https://${awsConfig.bucket}.s3.amazonaws.com/${key}`,
    expiresIn: awsConfig.s3.signedUrlExpiry,
  };
};
