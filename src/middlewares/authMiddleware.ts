import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { verifyToken } from '../utils/generateTokens';

/**
 * Middleware to authenticate requests using JWT
 * Verifies the access token from the Authorization header
 * and attaches user information to the request object
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = verifyToken(token);

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        name: ''  // Not included in token for security, but required by UserPayload type
      };

      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    next(error);
  }
};
