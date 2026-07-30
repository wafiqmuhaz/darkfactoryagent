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
    err.message === 'Username already taken' ||
    err.message === 'User already has a project'
  ) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err.message === 'Invalid email or password') {
    res.status(401).json({ error: err.message });
    return;
  }

  if (
    err.message === 'User not found' ||
    err.message === 'Project not found' ||
    err.message === 'Task not found' ||
    err.message === 'Agent not found' ||
    err.message === 'Agent run not found' ||
    err.message === 'Company not found' ||
    err.message === 'Manager not found'
  ) {
    res.status(404).json({ error: err.message });
    return;
  }

  // Bad references the caller can fix by choosing a different value.
  if (err.message === 'Agent cannot report to itself' || err.message.startsWith('Unknown skill: ')) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Path validation failures are the caller's input problem, not a server fault.
  if (err.message.startsWith('Project path does not exist')) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}
