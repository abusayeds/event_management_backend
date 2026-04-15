import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import ApiError from '../utils/apiError';
import { buildCombinedMessage, formatZodField, formatZodMessage } from '../utils/zodErrorFormatter';

const globalErrorHandler: ErrorRequestHandler = (
  error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong!';
  let errorDetails = undefined;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    errorDetails = error.issues.map(issue => {
      const field = formatZodField(issue.path);
      return {
        field,
        message: formatZodMessage(issue, field),
      };
    });
    message = buildCombinedMessage(errorDetails.map(detail => detail.message));
  }
  // Handle custom API errors
  else if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Token expired';
  }
  // Handle Prisma errors
  else if (error.name === 'PrismaClientKnownRequestError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Database operation failed';
  } else if (error.name === 'PrismaClientUnknownRequestError') {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    message = 'Database error occurred';
  }
  // Handle network errors
  else if (error.name === 'FetchError') {
    statusCode = StatusCodes.SERVICE_UNAVAILABLE;
    message = 'External service unavailable';
  }
  // Generic error handling
  else if (error instanceof Error) {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    message = error.message || 'Something went wrong!';
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error);
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(errorDetails && { errors: errorDetails }),
    timestamp: new Date().toISOString(),
  });
};

export default globalErrorHandler;
