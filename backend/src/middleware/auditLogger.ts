import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import path from 'path';
import { AuthRequest } from './auth';

const auditLog = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'audit.log') 
    })
  ]
});

export const auditLogger = (req: AuthRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    auditLog.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.userId || 'anonymous',
      userAgent: req.headers['user-agent']
    });
  });
  
  next();
};
