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
    console.log('🔍 Auth Middleware Debug:');
    console.log('Authorization header:', req.headers.authorization);

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No Bearer token found');
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    console.log('Extracted token:', token.substring(0, 50) + '...');

    try {
      const decoded = verifyToken(token);
      console.log('✅ Token decoded:', decoded);

      // ✅ ARREGLO: Usar decoded.id en lugar de decoded.userId
      req.user = {
        id: decoded.id,        // ← CAMBIO: era decoded.userId
        email: decoded.email,
        name: decoded.name || ''
      };

      console.log('✅ req.user set to:', req.user);
      next();
    } catch (error) {
      console.log('❌ Token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.log('❌ Auth middleware error:', error);
    next(error);
  }
};