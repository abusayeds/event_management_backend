import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import logger from '../config/logger';

const notFoundHandler = (req: Request, res: Response) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    statusCode: StatusCodes.NOT_FOUND,
    message: `Route ${req.originalUrl} not found. Please ensure you include the /api/v1/ prefix if calling the API.`,
    timestamp: new Date().toISOString(),
  });
};

export default notFoundHandler;
