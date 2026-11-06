import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/AppError';

const limiter = (windowMs: number, max: number, message: string, byUser = false) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Tests hit these endpoints many times in a row
    skip: () => env.NODE_ENV === 'test',
    // Authenticated endpoints are limited per user, the rest per IP
    keyGenerator: byUser
      ? (req) => String((req as AuthenticatedRequest).user?.id ?? req.ip)
      : undefined,
    handler: (_req, _res, next) => next(AppError.tooManyRequests(message)),
  });

export const authLimiter = limiter(60_000, 10, 'Demasiados intentos. Espera un minuto e intenta de nuevo.');

export const aiLimiter = limiter(60_000, 10, 'Demasiadas solicitudes a la IA. Espera un minuto.', true);
