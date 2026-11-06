import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards rejected promises from async route handlers to the error middleware
 * (Express 4 does not do this on its own).
 */
export const asyncHandler =
  <Req extends Request = Request>(handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
