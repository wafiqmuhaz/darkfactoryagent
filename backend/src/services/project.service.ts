import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateProjectInput {
  name: string;
  description?: string;
  path: string;
  repoUrl?: string;
  branch?: string;
  language?: string;
  framework?: string;
  adapterType?: string;
  adapterModel?: string;
  ownerId: string;
}

export class ProjectService {
  async create(input: CreateProjectInput) {
    // One project per user. Enforced here rather than by a unique constraint so
    // the caller gets an actionable message instead of a Prisma error.
    const existing = await prisma.project.findFirst({ where: { ownerId: input.ownerId } });
    if (existing) {
      throw new Error('User already has a project');
    }

    // Validate the project path exists
    const resolvedPath = path.resolve(input.path);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Project path does not exist: ${resolvedPath}`);
    }

    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        path: resolvedPath,
        repoUrl: input.repoUrl,
        branch: input.branch || 'main',
        language: input.language,
        framework: input.framework,
        adapterType: input.adapterType,
        adapterModel: input.adapterModel,
        ownerId: input.ownerId,
      },
    });

    logger.info(`Project created: ${project.name}`, { projectId: project.id });
    return project;
  }

  async findAll(ownerId: string) {
    return prisma.project.findMany({
      where: { ownerId },
      include: {
        _count: { select: { tasks: true, agentRuns: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string, ownerId: string) {
    const project = await prisma.project.findFirst({
      where: { id, ownerId },
      include: {
        tasks: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { tasks: true, agentRuns: true, artifacts: true } },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return project;
  }

  async update(id: string, ownerId: string, data: Partial<CreateProjectInput>) {
    const project = await prisma.project.findFirst({ where: { id, ownerId } });
    if (!project) {
      throw new Error('Project not found');
    }

    if (data.path) {
      const resolvedPath = path.resolve(data.path);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Project path does not exist: ${resolvedPath}`);
      }
      data.path = resolvedPath;
    }

    return prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        path: data.path,
        repoUrl: data.repoUrl,
        branch: data.branch,
        language: data.language,
        framework: data.framework,
        adapterType: data.adapterType,
        adapterModel: data.adapterModel,
      },
    });
  }

  async delete(id: string, ownerId: string) {
    const project = await prisma.project.findFirst({ where: { id, ownerId } });
    if (!project) {
      throw new Error('Project not found');
    }

    // Tasks, routines, artifacts and the company link cascade via the schema.
    // Activity rows reference projectId as a plain column with no foreign key,
    // so they would otherwise be left behind as orphans.
    await prisma.activity.deleteMany({ where: { projectId: id } });
    await prisma.project.delete({ where: { id } });

    logger.info(`Project deleted: ${project.name}`, { projectId: id });
    return { id, name: project.name };
  }
}

export const projectService = new ProjectService();
