import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });

  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'Validation error',
      details: JSON.parse(err.message),
    });
    return;
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(409).json({
      error: 'Database constraint violation',
      message: err.message,
    });
    return;
  }

  // Business logic errors
  if (
    err.message === 'Email already registered' ||
    err.message === 'Username already taken'
  ) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err.message === 'Invalid email or password') {
    res.status(401).json({ error: err.message });
    return;
  }

  if (err.message === 'User not found') {
    res.status(404).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}
