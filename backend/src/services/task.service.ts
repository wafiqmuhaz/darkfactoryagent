import { PrismaClient, TaskStatus, TaskPriority } from '@prisma/client';
import { emitTaskCreated, emitTaskUpdated, emitTaskDeleted } from '../websocket/socket';

const prisma = new PrismaClient();

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId: string;
  parentTaskId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
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
        parentTaskId: input.parentTaskId,
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

  async listTasks(projectId: string, filter?: { status?: TaskStatus; priority?: TaskPriority }) {
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

  async updateTaskStatus(taskId: string, status: TaskStatus) {
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
