import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { AppError } from '../utils/AppError';

/**
 * Runs express-validator chains and turns failures into a 400 VALIDATION_ERROR.
 */
export const validate =
  (chains: ValidationChain[]): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
    // No endpoint takes a list: a repeated query parameter or an array in the body is rejected outright,
    // so a field can never arrive as [value] and slip past a scalar check
    const listField = [req.query, req.body].flatMap((source) =>
      source && typeof source === 'object' ? Object.entries(source as Record<string, unknown>).filter(([, value]) => Array.isArray(value)) : []
    );
    if (Array.isArray(req.body) || listField.length) {
      next(AppError.validation(listField.map(([field]) => ({ field, message: 'No se aceptan listas en este campo' }))));
      return;
    }

    await Promise.all(chains.map((chain) => chain.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) {
      next();
      return;
    }

    const details = result.array().map((error) => ({
      field: error.type === 'field' ? error.path : undefined,
      message: String(error.msg),
    }));
    next(AppError.validation(details));
  };
