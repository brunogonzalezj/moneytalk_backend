import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware
 * Catches all unhandled errors and sends a standardized error response
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    res.status(400).json({ error: 'Validation error', details: err.message });
    return;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Authentication error', details: err.message });
    return;
  }

  // Default to 500 server error
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
};
