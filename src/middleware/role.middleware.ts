import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import ApiError from '../utils/apiError';

// User role enum
enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

/**
 * Role-based access control middleware
 */
const requireRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required'));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(
        new ApiError(
          StatusCodes.FORBIDDEN,
          'Forbidden: You do not have the required role to access this resource'
        )
      );
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Middleware to check if user is manager or admin
 */
const requireManagerOrAdmin = requireRole(UserRole.MANAGER, UserRole.ADMIN);

export { requireAdmin, requireManagerOrAdmin, requireRole };

