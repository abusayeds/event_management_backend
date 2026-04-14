import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const notFoundHandler = (req: Request, res: Response) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    statusCode: StatusCodes.NOT_FOUND,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
};

export default notFoundHandler;
