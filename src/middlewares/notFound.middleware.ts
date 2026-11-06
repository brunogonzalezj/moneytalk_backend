import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.path}`));
};
