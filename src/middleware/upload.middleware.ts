import { Request } from 'express';
import multer from 'multer';

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpg', 'image/heic', 'image/jpeg', 'image/png', 'image/webp'];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only JPEG, HEIC, PNG, and WEBP are allowed.'));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: imageFileFilter,
});
