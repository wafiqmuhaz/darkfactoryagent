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

    // Agent rooms are independent of the project room — the agent detail page
    // watches one agent while the board may be watching a different project.
    socket.on('join_agent', (agentId: string) => {
      socket.join(`agent_${agentId}`);
      logger.info(`User ${socket.userId} joined agent room: ${agentId}`);
    });

    socket.on('leave_agent', (agentId: string) => {
      socket.leave(`agent_${agentId}`);
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

/** True when a socket server exists — worker-only processes have none. */
const hasIO = (): boolean => !!io;

/** Emit to a project room, silently skipping when no socket server is running. */
const emitToProject = (projectId: string, event: string, payload: unknown): void => {
  if (!hasIO()) return;
  io.to(`project_${projectId}`).emit(event, payload);
};

// Event emitters helpers
export const emitTaskCreated = (projectId: string, task: any) => {
  emitToProject(projectId, 'task:created', task);
};

export const emitTaskUpdated = (projectId: string, task: any) => {
  emitToProject(projectId, 'task:updated', task);
};

export const emitTaskDeleted = (projectId: string, taskId: string) => {
  emitToProject(projectId, 'task:deleted', { id: taskId });
};

export const emitActivityLog = (projectId: string, activity: any) => {
  emitToProject(projectId, 'activity:log', activity);
};

export const emitAgentStatus = (projectId: string, status: any) => {
  emitToProject(projectId, 'agent:status', status);
};

/** Emit to a single agent's room, skipping when no socket server is running. */
const emitToAgent = (agentId: string, event: string, payload: unknown): void => {
  if (!hasIO()) return;
  io.to(`agent_${agentId}`).emit(event, payload);
};

/** A run for this agent started, changed status, or finished. */
export const emitAgentRunUpdated = (agentId: string, payload: any) => {
  emitToAgent(agentId, 'agent:run_updated', payload);
};

/** The agent's own record changed — instructions, config, skills, identity. */
export const emitAgentUpdated = (agentId: string, payload: any) => {
  emitToAgent(agentId, 'agent:updated', payload);
};
