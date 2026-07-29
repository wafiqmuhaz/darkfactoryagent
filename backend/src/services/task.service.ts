import { PrismaClient } from '@prisma/client';
import { emitTaskCreated, emitTaskUpdated, emitTaskDeleted } from '../websocket/socket';

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
  projectId: string;
  parentTaskId?: string;
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
        projectId: input.projectId,
        parentId: input.parentTaskId,
      },
    });

    emitTaskCreated(task.projectId, task);
    return task;
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

  async updateTaskStatus(taskId: string, status: string) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    emitTaskUpdated(task.projectId, task);
    return task;
  }

  async deleteTask(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    await prisma.task.delete({
      where: { id: taskId },
    });

    emitTaskDeleted(task.projectId, taskId);
  }
}

export const taskService = new TaskService();
