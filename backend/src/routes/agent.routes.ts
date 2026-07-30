import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { adapterManager } from '../adapters/manager';
import { config } from '../config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const agentRoutes = Router();

/**
 * Agent status is a single active adapter, not a roster of roles. The dashboard
 * and Agent Status page both read this.
 */
agentRoutes.get('/', authenticate, async (_req, res, next) => {
  try {
    // The project's adapter wins; otherwise fall back to the instance default.
    const project = await prisma.project.findFirst({ orderBy: { updatedAt: 'desc' } });
    const activeId = project?.adapterType || config.agents.adapterDefault;

    const descriptor = adapterManager.listAdapters().find((a) => a.id === activeId);
    const stored = await prisma.adapter.findUnique({ where: { name: activeId } });

    const runningRun = await prisma.agentRun.findFirst({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' },
      include: { task: { select: { title: true } } },
    });

    const lastRun = await prisma.agentRun.findFirst({
      where: { status: { in: ['completed', 'failed'] } },
      orderBy: { completedAt: 'desc' },
      include: { task: { select: { title: true } } },
    });

    // "available" reflects the last probe; a running job takes display priority.
    const available = stored?.probeStatus === 'ready';
    const status = runningRun ? 'running' : available ? 'available' : 'unavailable';

    res.status(200).json({
      adapter: {
        id: activeId,
        name: descriptor?.name ?? activeId,
        description: descriptor?.description ?? null,
        model: project?.adapterModel ?? 'auto',
        status,
        available,
        probeStatus: stored?.probeStatus ?? 'not_tested',
        probeError: stored?.probeError ?? null,
        runtime: stored?.runtime ?? null,
        version: stored?.version ?? null,
        lastProbeAt: stored?.lastProbeAt ?? null,
        installHint: descriptor?.installHint ?? null,
      },
      currentRun: runningRun
        ? {
            id: runningRun.id,
            taskTitle: runningRun.task?.title ?? null,
            startedAt: runningRun.startedAt,
          }
        : null,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            taskTitle: lastRun.task?.title ?? null,
            durationSec: lastRun.duration,
            costUsd: lastRun.cost,
            error: lastRun.error,
            completedAt: lastRun.completedAt,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});
