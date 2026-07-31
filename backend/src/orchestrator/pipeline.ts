import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { taskService, TaskStatus, TaskPriority } from '../services/task.service';
import { taskQueue } from './queue';
import { skillRegistry } from '../skills/skill-registry';

const prisma = new PrismaClient();

export class Pipeline {
  /**
   * Analyze backlog tasks and reprioritize based on age, complexity, and project activity.
   * Runs at 8 PM daily.
   */
  async prioritizeBacklog() {
    logger.info('[Pipeline] Prioritizing backlog tasks across all active projects...');

    const activeProjects = await prisma.project.findMany({ where: { isActive: true } });
    let totalReprioritized = 0;

    for (const project of activeProjects) {
      const backlogTasks = await prisma.task.findMany({
        where: { projectId: project.id, status: TaskStatus.BACKLOG },
        orderBy: { createdAt: 'asc' },
      });

      for (const task of backlogTasks) {
        const ageInDays = Math.floor((Date.now() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const complexityWeight = task.complexity || 1;

        // Heuristic: age × complexity. Tasks over 7 days old with complexity ≥ 3 → high priority.
        const score = ageInDays * complexityWeight;
        let newPriority = task.priority;

        if (score > 21 && task.priority !== TaskPriority.HIGH && task.priority !== TaskPriority.CRITICAL) {
          newPriority = TaskPriority.HIGH;
        } else if (score > 10 && task.priority === TaskPriority.LOW) {
          newPriority = TaskPriority.MEDIUM;
        }

        if (newPriority !== task.priority) {
          await prisma.task.update({
            where: { id: task.id },
            data: { priority: newPriority },
          });
          totalReprioritized++;
          logger.info(`[Pipeline] Reprioritized task ${task.id} (${task.title}) → ${newPriority} (age: ${ageInDays}d, complexity: ${complexityWeight})`);
        }
      }
    }

    logger.info(`[Pipeline] Backlog prioritization complete. ${totalReprioritized} tasks reprioritized.`);
    return { success: true, reprioritized: totalReprioritized };
  }

  /**
   * Query all active projects and enqueue top-priority backlog tasks for overnight execution.
   * Runs at 9 PM daily.
   */
  async startNightlyBuild() {
    logger.info('[Pipeline] Starting Nightly Build — queueing high-priority backlog tasks...');

    const activeProjects = await prisma.project.findMany({ where: { isActive: true } });
    let totalEnqueued = 0;

    for (const project of activeProjects) {
      // Grab top 3 high/critical-priority backlog tasks per project
      const tasks = await prisma.task.findMany({
        where: {
          projectId: project.id,
          status: TaskStatus.BACKLOG,
          priority: { in: [TaskPriority.HIGH, TaskPriority.CRITICAL] },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        take: 3,
      });

      for (const task of tasks) {
        try {
          await taskService.enqueueTask(task, 'chief-of-staff');
          totalEnqueued++;
          logger.info(`[Pipeline] Enqueued task ${task.id} (${task.title}) from project ${project.name}`);
        } catch (error: any) {
          logger.warn(`[Pipeline] Could not enqueue task ${task.id}: ${error.message}`);
        }
      }
    }

    logger.info(`[Pipeline] Nightly build enqueued ${totalEnqueued} tasks across ${activeProjects.length} projects.`);
    return { success: true, projectsProcessed: activeProjects.length, tasksEnqueued: totalEnqueued };
  }

  /**
   * Generate a summary report of the night's pipeline execution based on real AgentRun and Task metrics.
   * Runs at 6 AM daily.
   */
  async generateSummary() {
    logger.info('[Pipeline] Generating nightly pipeline summary report...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(21, 0, 0, 0); // 9 PM yesterday

    const today = new Date();
    today.setHours(6, 0, 0, 0); // 6 AM today

    const [completedTasks, failedTasks, agentRuns] = await Promise.all([
      prisma.task.count({
        where: {
          status: { in: [TaskStatus.DONE, TaskStatus.REVIEW] },
          completedAt: { gte: yesterday, lte: today },
        },
      }),
      prisma.task.count({
        where: {
          status: TaskStatus.FAILED,
          updatedAt: { gte: yesterday, lte: today },
        },
      }),
      prisma.agentRun.findMany({
        where: {
          startedAt: { gte: yesterday, lte: today },
          status: 'completed',
        },
        select: { duration: true, cost: true },
      }),
    ]);

    const totalDuration = agentRuns.reduce((sum, run) => sum + run.duration, 0);
    const totalCost = agentRuns.reduce((sum, run) => sum + run.cost, 0);

    const summary = {
      completed: completedTasks,
      failed: failedTasks,
      agentRunsCount: agentRuns.length,
      totalDurationSeconds: totalDuration,
      totalCostUsd: parseFloat(totalCost.toFixed(6)),
    };

    logger.info(`[Pipeline] Nightly summary: ${summary.completed} completed, ${summary.failed} failed, ${summary.agentRunsCount} agent runs, ${summary.totalDurationSeconds}s total, $${summary.totalCostUsd}`);
    return summary;
  }

  /**
   * Run automated code review on uncommitted/staged changes using the ReviewAgent.
   * Called on-demand (not scheduled).
   */
  async autoReview(repoPath: string): Promise<{ approved: boolean; comments: string[]; score?: number }> {
    logger.info(`[Pipeline] Running auto-review for ${repoPath}...`);

    try {
      // Use git-operations skill to get status and diff
      const status = await skillRegistry.executeSkill('git-operations', {
        action: 'status',
        repoPath,
      });

      if (status.isClean) {
        logger.info('[Pipeline] No changes to review — working tree is clean');
        return { approved: true, comments: ['Working tree is clean, nothing to review.'] };
      }

      const diff = await skillRegistry.executeSkill('git-operations', {
        action: 'diff',
        repoPath,
      });

      if (!diff.diff || diff.diff.trim().length === 0) {
        return { approved: true, comments: ['No diff available.'] };
      }

      // Simple heuristic review (real implementation could use ReviewAgent + LLM)
      const comments: string[] = [];
      const lines: string[] = diff.diff.split('\n');
      const addedLines = lines.filter((l: string) => l.startsWith('+')).length;
      const removedLines = lines.filter((l: string) => l.startsWith('-')).length;
      const netChange = addedLines + removedLines;

      // Check for common issues
      if (diff.diff.includes('console.log')) {
        comments.push('⚠️ Contains console.log statements — consider removing debug code.');
      }
      if (diff.diff.includes('TODO') || diff.diff.includes('FIXME')) {
        comments.push('⚠️ Contains TODO/FIXME markers — resolve before merging.');
      }
      if (netChange > 500) {
        comments.push('⚠️ Large changeset (>500 lines) — consider breaking into smaller commits.');
      }

      const approved = comments.length === 0 || !comments.some((c) => c.includes('⚠️'));
      const score = Math.max(0, 100 - comments.length * 10);

      logger.info(`[Pipeline] Auto-review complete: ${approved ? 'APPROVED' : 'NEEDS ATTENTION'} (score: ${score})`);
      return { approved, comments, score };
    } catch (error: any) {
      logger.error(`[Pipeline] Auto-review failed: ${error.message}`);
      return { approved: false, comments: [`Error during review: ${error.message}`] };
    }
  }
}

export const pipeline = new Pipeline();
