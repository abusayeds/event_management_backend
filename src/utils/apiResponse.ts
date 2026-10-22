import { Response } from 'express';
import { ApiResponse } from '../interfaces/response.interface';
import { serializeImageUrls } from './imageUrls';

const apiResponse = <T>(res: Response, options: Omit<ApiResponse<T>, 'timestamp'>): void => {
  const response: ApiResponse<T> = {
    ...options,
    data: serializeImageUrls(options.data),
    timestamp: new Date().toISOString(),
  };

  res.status(response.statusCode).json(response);
};

export default apiResponse;
