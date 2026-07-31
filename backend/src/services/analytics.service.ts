import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsService {
  /**
   * DORA metrics: Deployment Frequency, Lead Time, Change Failure Rate, MTTR.
   * Based on completed tasks and agent runs over the last 30 days.
   */
  async getDoraMetrics(projectId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const where = { projectId, completedAt: { gte: thirtyDaysAgo } };

    const [completedTasks, failedTasks, totalTasks] = await Promise.all([
      prisma.task.count({ where: { ...where, status: { in: ['done', 'review'] } } }),
      prisma.task.count({ where: { projectId, status: 'failed', updatedAt: { gte: thirtyDaysAgo } } }),
      prisma.task.count({ where }),
    ]);

    // Lead time: average duration from startedAt to completedAt for completed tasks
    const tasksWithTiming = await prisma.task.findMany({
      where: { ...where, status: { in: ['done', 'review'] }, startedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
    });

    let avgLeadTimeHours = 0;
    if (tasksWithTiming.length > 0) {
      const totalLeadMs = tasksWithTiming.reduce((sum, t) => {
        if (!t.startedAt || !t.completedAt) return sum;
        return sum + (t.completedAt.getTime() - t.startedAt.getTime());
      }, 0);
      avgLeadTimeHours = Math.round(totalLeadMs / tasksWithTiming.length / (1000 * 60 * 60) * 10) / 10;
    }

    // Deployment frequency: completed tasks per day over 30 days
    const deployFreq = (completedTasks / 30).toFixed(1);

    // Change failure rate: failed / (completed + failed)
    const changeFailureRate = totalTasks > 0 ? Math.round((failedTasks / totalTasks) * 100) : 0;

    // MTTR: average recovery time for failed tasks (failed → done transitions)
    // Simplified: average duration of failed tasks (createdAt → updatedAt)
    const failedTasksWithTime = await prisma.task.findMany({
      where: { projectId, status: 'failed', updatedAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, updatedAt: true },
    });

    let mttrMinutes = 0;
    if (failedTasksWithTime.length > 0) {
      const totalRecoveryMs = failedTasksWithTime.reduce(
        (sum, t) => sum + (t.updatedAt.getTime() - t.createdAt.getTime()),
        0
      );
      mttrMinutes = Math.round(totalRecoveryMs / failedTasksWithTime.length / (1000 * 60));
    }

    return {
      deploymentFrequency: `${deployFreq}/day`,
      leadTimeForChanges: avgLeadTimeHours > 0 ? `${avgLeadTimeHours} hours` : 'N/A',
      changeFailureRate: `${changeFailureRate}%`,
      meanTimeToRecovery: mttrMinutes > 0 ? `${mttrMinutes} mins` : 'N/A',
    };
  }

  /**
   * Agent performance metrics: tasks completed, average duration, success rate.
   */
  async getAgentPerformance(projectId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [completedRuns, failedRuns] = await Promise.all([
      prisma.agentRun.findMany({
        where: { projectId, status: 'completed', completedAt: { gte: thirtyDaysAgo } },
        select: { duration: true },
      }),
      prisma.agentRun.count({
        where: { projectId, status: 'failed', completedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const tasksCompleted = completedRuns.length;
    const totalRuns = tasksCompleted + failedRuns;
    const successRate = totalRuns > 0 ? Math.round((tasksCompleted / totalRuns) * 100) : 0;

    let avgTimePerTask = 0;
    if (completedRuns.length > 0) {
      const totalDuration = completedRuns.reduce((sum, run) => sum + run.duration, 0);
      avgTimePerTask = Math.round(totalDuration / completedRuns.length / 60); // seconds → minutes
    }

    return {
      tasksCompleted,
      averageTimePerTask: avgTimePerTask > 0 ? `${avgTimePerTask} mins` : 'N/A',
      successRate: `${successRate}%`,
    };
  }
}

export const analyticsService = new AnalyticsService();
