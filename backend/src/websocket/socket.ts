import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  projectId?: string;
}

let io: Server;

export const initWebSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);

    // Join a project-specific room
    socket.on('join_project', (projectId: string) => {
      if (socket.projectId) {
        socket.leave(`project_${socket.projectId}`);
      }
      socket.projectId = projectId;
      socket.join(`project_${projectId}`);
      logger.info(`User ${socket.userId} joined project room: ${projectId}`);
    });

    socket.on('leave_project', (projectId: string) => {
      socket.leave(`project_${projectId}`);
      if (socket.projectId === projectId) {
        socket.projectId = undefined;
      }
      logger.info(`User ${socket.userId} left project room: ${projectId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Event emitters helpers
export const emitTaskCreated = (projectId: string, task: any) => {
  getIO().to(`project_${projectId}`).emit('task:created', task);
};

export const emitTaskUpdated = (projectId: string, task: any) => {
  getIO().to(`project_${projectId}`).emit('task:updated', task);
};

export const emitTaskDeleted = (projectId: string, taskId: string) => {
  getIO().to(`project_${projectId}`).emit('task:deleted', { id: taskId });
};

export const emitAgentStatus = (projectId: string, status: any) => {
  getIO().to(`project_${projectId}`).emit('agent:status', status);
};
