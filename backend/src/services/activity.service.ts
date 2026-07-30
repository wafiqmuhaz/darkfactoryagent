import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { emitActivityLog } from '../websocket/socket';

const prisma = new PrismaClient();

export type ActivityType =
  | 'task_created'
  | 'task_status'
  | 'task_success'
  | 'task_failed'
  | 'agent_run'
  | 'adapter'
  | 'skill'
  | 'routine'
  | 'system'
  | 'error';

export interface LogInput {
  type: ActivityType | string;
  message: string;
  /** Stored as a JSON string — Prisma has no JSON column on SQLite here. */
  metadata?: Record<string, unknown>;
  taskId?: string;
  projectId?: string;
  agentId?: string;
}

export class ActivityService {
  /**
   * Persist an activity entry and push it to the project's socket room.
   * Logging is best-effort: a failure here must never break the caller's work.
   */
  async log(input: LogInput) {
    try {
      const activity = await prisma.activity.create({
        data: {
          type: input.type,
          message: input.message,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          taskId: input.taskId,
          projectId: input.projectId,
          agentId: input.agentId,
        },
      });

      if (input.projectId) {
        try {
          emitActivityLog(input.projectId, activity);
        } catch {
          // Socket server may not be initialized in worker-only mode.
        }
      }

      return activity;
    } catch (error: any) {
      logger.warn(`Activity log failed (${input.type}): ${error.message}`);
      return null;
    }
  }

  async list(filter: { projectId?: string; taskId?: string; type?: string; limit?: number; page?: number } = {}) {
    const limit = filter.limit ?? 50;
    const page = filter.page ?? 1;

    const where: Record<string, unknown> = {};
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.taskId) where.taskId = filter.taskId;
    if (filter.type) where.type = filter.type;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);

    return { activities, total, page, limit };
  }

  /** Activity entries grouped by task, for rendering logs on Kanban cards. */
  async listByTasks(taskIds: string[], limitPerTask = 5) {
    if (taskIds.length === 0) return {};

    const activities = await prisma.activity.findMany({
      where: { taskId: { in: taskIds } },
      orderBy: { createdAt: 'desc' },
      // Fetch generously, then trim per task — SQLite has no per-group limit.
      take: taskIds.length * limitPerTask * 4,
    });

    const grouped: Record<string, typeof activities> = {};
    for (const activity of activities) {
      if (!activity.taskId) continue;
      const bucket = (grouped[activity.taskId] ??= []);
      if (bucket.length < limitPerTask) bucket.push(activity);
    }
    return grouped;
  }
}

export const activityService = new ActivityService();
