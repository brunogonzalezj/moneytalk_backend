import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/AppError';

const limiter = (windowMs: number, limit: number, message: string, byUser = false) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    // Tests hit these endpoints many times in a row
    skip: () => env.NODE_ENV === 'test',
    // Authenticated endpoints are limited per user, the rest per IP. ipKeyGenerator groups
    // IPv6 clients by /56 subnet so rotating addresses can't dodge the limit
    keyGenerator: byUser
      ? (req) => {
          const userId = (req as AuthenticatedRequest).user?.id;
          return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? '');
        }
      : undefined,
    handler: (_req, _res, next) => next(AppError.tooManyRequests(message)),
  });

// Per IP: people signing up together on one network (or behind one proxy) share it, so it leaves room for that
export const authLimiter = limiter(60_000, 30, 'Demasiados intentos. Espera un minuto e intenta de nuevo.');

export const aiLimiter = limiter(60_000, 10, 'Demasiadas solicitudes a la IA. Espera un minuto.', true);
