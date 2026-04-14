import { StatusCodes } from 'http-status-codes';

class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(message: string): ApiError {
    return new ApiError(StatusCodes.BAD_REQUEST, message);
  }

  public static unauthorized(message: string): ApiError {
    return new ApiError(StatusCodes.UNAUTHORIZED, message);
  }

  public static forbidden(message: string): ApiError {
    return new ApiError(StatusCodes.FORBIDDEN, message);
  }

  public static notFound(message: string): ApiError {
    return new ApiError(StatusCodes.NOT_FOUND, message);
  }

  public static conflict(message: string): ApiError {
    return new ApiError(StatusCodes.CONFLICT, message);
  }

  public static internalServer(message: string): ApiError {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message);
  }
}
export default ApiError;
