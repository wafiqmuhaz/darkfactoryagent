import { Router } from 'express';
import { getQueueCounts } from '../orchestrator/queue-client';
import { skillRegistry } from '../skills';
import { taskService } from '../services/task.service';
import { activityService } from '../services/activity.service';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

router.get('/health', async (_req, res, next) => {
  try {
    const queue = await getQueueCounts();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queue,
      skills: skillRegistry.getEnabledSkills(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics — dashboard figures, all read from the database.
 * Scoped to a project when `projectId` is supplied.
 */
router.get('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const taskWhere = projectId ? { projectId } : {};
    const runWhere = projectId ? { projectId } : {};

    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);

    const [tasks, queue, runningRuns, failedRuns, spend, budget, recent] = await Promise.all([
      taskService.getStats(projectId),
      getQueueCounts(),
      prisma.agentRun.count({ where: { ...runWhere, status: 'running' } }),
      prisma.agentRun.count({ where: { ...runWhere, status: 'failed' } }),
      prisma.costLedger.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.budget.findFirst({ where: { isActive: true } }),
      activityService.list({ projectId, limit: 10 }),
    ]);

    const totalSpend = spend._sum.amount ?? 0;
    const artifacts = await prisma.artifact.count({ where: projectId ? { projectId } : {} });

    res.status(200).json({
      tasks,
      // Flat aliases kept for existing dashboard consumers.
      totalTasks: tasks.total,
      completedTasks: tasks.done,
      activeTasks: tasks.inProgress,
      failedTasks: tasks.failed,
      queue,
      runs: { running: runningRuns, failed: failedRuns },
      activeAgents: runningRuns,
      artifacts,
      cost: {
        monthlySpend: Math.round(totalSpend * 1e4) / 1e4,
        budget: budget?.amount ?? null,
        percentage: budget && budget.amount > 0 ? Math.round((totalSpend / budget.amount) * 100) : 0,
      },
      recentActivity: recent.activities,
    });
  } catch (error) {
    next(error);
  }
});

export const metricsRoutes = router;
