import { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return AppError.conflict('Ya existe un registro con esos datos');
    if (err.code === 'P2025') return AppError.notFound();
    if (err.code === 'P2003') return AppError.badRequest('La referencia indicada no existe');
  }

  // Malformed JSON body (thrown by express.json)
  if (err instanceof SyntaxError && 'body' in err) {
    return AppError.badRequest('El cuerpo de la solicitud no es JSON válido');
  }

  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande');
  }

  return new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Intenta nuevamente.');
};

/**
 * Single error handler. Every error response has the shape
 * { error: { code, message, details? } } and never leaks internals.
 */
 
export const errorMiddleware = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const appError = toAppError(err);

  if (appError.status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${appError.status}`, err);
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
    },
  });
};
