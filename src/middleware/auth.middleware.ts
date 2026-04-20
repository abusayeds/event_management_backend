import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole, UserStatus } from '../../prisma/generated/enums';
import { cacheService } from '../cache/cache.service';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { IDecodedToken } from '../interfaces/token.interface';
import { UserRepository } from '../modules/user/user.repository';
import ApiError from '../utils/apiError';
import { verifyAccessToken } from '../utils/generateToken';

/**
 * Authentication middleware with role-based access control
 */
const auth =
  (...requiredRoles: UserRole[]) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Get authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authorization header is missing');
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

      // Check if token is blacklisted
      const isBlacklisted = await cacheService.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: 'Token has been invalidated.',
        });
      }

      // Verify token and get decoded user
      const verifiedUser = verifyAccessToken(token) as IDecodedToken;

      // Always re-check live user status from DB for protected routes.
      const currentUser = await UserRepository.getUserById(verifiedUser.userId);
      if (!currentUser) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not found or token is invalid');
      }

      if (currentUser.status !== UserStatus.ACTIVE) {
        if (currentUser.status === UserStatus.BANNED) {
          throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been banned.');
        }

        throw new ApiError(StatusCodes.FORBIDDEN, 'Your account is not active.');
      }

      req.user = {
        ...verifiedUser,
        role: currentUser.role,
        email: currentUser.email,
      };

      // Role-based access control
      if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role as UserRole)) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'Forbidden: You do not have the required role to access this resource'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

/**
 * Middleware to check if user is admin
 */
const requireAdmin = auth(UserRole.ADMIN);

/**
 * Middleware to check if user has specific role(s)
 */
const requireRole = (...roles: UserRole[]) => auth(...roles);

export { auth, requireAdmin, requireRole };
