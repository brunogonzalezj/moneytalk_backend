import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { AppError } from '../utils/AppError';

/**
 * Runs express-validator chains and turns failures into a 400 VALIDATION_ERROR.
 */
export const validate =
  (chains: ValidationChain[]): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
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
