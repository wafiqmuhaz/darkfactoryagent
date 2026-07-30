import { PrismaClient } from '@prisma/client';
import { emitTaskCreated, emitTaskUpdated, emitTaskDeleted } from '../websocket/socket';
import { activityService } from './activity.service';
import { taskQueue, priorityToQueueWeight } from '../orchestrator/queue-client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Task status/priority are stored as String in Prisma schema
export type TaskStatusType = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'failed';
export type TaskPriorityType = 'low' | 'medium' | 'high' | 'critical';

export const TaskStatus = {
  BACKLOG: 'backlog' as const,
  TODO: 'todo' as const,
  IN_PROGRESS: 'in_progress' as const,
  REVIEW: 'review' as const,
  DONE: 'done' as const,
  FAILED: 'failed' as const,
};

export const TaskPriority = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  CRITICAL: 'critical' as const,
};

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  projectId: string;
  parentTaskId?: string;
  /** Set false to leave the task in the backlog instead of queueing it. */
  autoRun?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedAgentId?: string;
}

export class TaskService {
  async createTask(input: CreateTaskInput) {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: input.status || TaskStatus.BACKLOG,
        priority: input.priority || TaskPriority.MEDIUM,
        type: input.type || 'feature',
        projectId: input.projectId,
        parentId: input.parentTaskId,
      },
    });

    emitTaskCreated(task.projectId, task);

    await activityService.log({
      type: 'task_created',
      message: `Task created: ${task.title}`,
      metadata: { priority: task.priority, type: task.type },
      taskId: task.id,
      projectId: task.projectId,
    });

    // Creating a task is the trigger: push it onto the queue unless told otherwise.
    if (input.autoRun !== false) {
      await this.enqueueTask(task);
    }

    return task;
  }

  /**
   * Hand a task to the BullMQ worker. If Redis is unreachable the task stays
   * queued-in-spirit: it is marked todo and the failure is logged, so it can be
   * run manually from the board rather than silently disappearing.
   */
  async enqueueTask(task: { id: string; projectId: string; priority: string; title: string }) {
    try {
      const job = await taskQueue.add(
        'task-run',
        { agentType: 'adapter-exec', taskId: task.id, projectId: task.projectId },
        { priority: priorityToQueueWeight(task.priority) }
      );

      await this.updateTaskStatus(task.id, TaskStatus.TODO, `Queued for execution (job ${job.id})`);
      return { queued: true, jobId: job.id };
    } catch (error: any) {
      logger.warn(`Could not enqueue task ${task.id}: ${error.message}`);
      await activityService.log({
        type: 'error',
        message: `Queue unavailable — task not started: ${error.message}. Use Run on the task card once Redis is reachable.`,
        metadata: { taskId: task.id, error: error.message },
        taskId: task.id,
        projectId: task.projectId,
      });
      return { queued: false, error: error.message };
    }
  }

  async getTask(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subTasks: true,
        comments: true,
        artifacts: true,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  async listTasks(projectId: string, filter?: { status?: string; priority?: string }) {
    return prisma.task.findMany({
      where: {
        projectId,
        ...filter,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subTasks: true,
      }
    });
  }

  async updateTask(taskId: string, input: UpdateTaskInput) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: input,
    });

    emitTaskUpdated(task.projectId, task);
    return task;
  }

  async updateTaskStatus(taskId: string, status: string, note?: string) {
    const previous = await prisma.task.findUnique({ where: { id: taskId } });

    // Keep the lifecycle timestamps in step with the status transition.
    const data: Record<string, unknown> = { status };
    if (status === TaskStatus.IN_PROGRESS && !previous?.startedAt) data.startedAt = new Date();
    if (status === TaskStatus.DONE || status === TaskStatus.REVIEW) data.completedAt = new Date();

    const task = await prisma.task.update({ where: { id: taskId }, data });

    emitTaskUpdated(task.projectId, task);

    await activityService.log({
      type: 'task_status',
      message: note ?? `Task "${task.title}" moved ${previous?.status ?? 'unknown'} → ${status}`,
      metadata: { from: previous?.status ?? null, to: status },
      taskId: task.id,
      projectId: task.projectId,
    });

    return task;
  }

  /** Alias used by the queue worker. */
  async updateStatus(taskId: string, status: string, note?: string) {
    return this.updateTaskStatus(taskId, status, note);
  }

  async deleteTask(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    await prisma.task.delete({
      where: { id: taskId },
    });

    emitTaskDeleted(task.projectId, taskId);
  }

  /** Aggregate counts for the dashboard, read straight from the database. */
  async getStats(projectId?: string) {
    const where = projectId ? { projectId } : {};

    const [total, byStatus] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.groupBy({ by: ['status'], where, _count: { status: true } }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of byStatus) counts[row.status] = row._count.status;

    return {
      total,
      backlog: counts[TaskStatus.BACKLOG] ?? 0,
      todo: counts[TaskStatus.TODO] ?? 0,
      inProgress: counts[TaskStatus.IN_PROGRESS] ?? 0,
      review: counts[TaskStatus.REVIEW] ?? 0,
      done: counts[TaskStatus.DONE] ?? 0,
      failed: counts[TaskStatus.FAILED] ?? 0,
    };
  }
}

export const taskService = new TaskService();
