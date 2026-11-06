import { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/tokens';

/**
 * Requires a valid "Authorization: Bearer <access token>" header and sets req.user.
 */
export const authMiddleware = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Falta el token de acceso'));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.id, email: payload.email, name: payload.name ?? '' };
    next();
  } catch {
    next(new AppError(401, 'TOKEN_INVALID', 'Sesión inválida o expirada'));
  }
};

/** Must run after authMiddleware. The role is read from the database, not the token. */
export const requireAdmin = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true } });
  if (user?.role !== 'admin') throw AppError.forbidden();
  next();
};
