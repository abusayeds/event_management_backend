import { Response } from 'express';
import { ApiResponse } from '../interfaces/response.interface';

const apiResponse = <T>(
  res: Response,
  options: Omit<ApiResponse<T>, 'timestamp'>
): void => {
  const response: ApiResponse<T> = {
    ...options,
    timestamp: new Date().toISOString(),
  };

  res.status(response.statusCode).json(response);
};

export default apiResponse;
