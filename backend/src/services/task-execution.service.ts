import { PrismaClient } from '@prisma/client';
import { adapterManager } from '../adapters/manager';
import { logger } from '../utils/logger';
import { config } from '../config';
import { taskService, TaskStatus } from './task.service';
import { activityService } from './activity.service';

const prisma = new PrismaClient();

/**
 * Runs a task by handing its description to the project's adapter CLI
 * (Claude Code or Codex) inside the project's local repo, then records the
 * output, cost, and activity trail.
 */
export class TaskExecutionService {
  async executeTask(taskId: string): Promise<{
    success: boolean;
    output: string;
    adapterUsed?: string;
    error?: string;
  }> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!task.project) throw new Error(`Task ${taskId} has no project`);

    const adapterId = task.project.adapterType || config.agents.adapterDefault;
    const model = task.project.adapterModel || 'auto';

    // Refuse to spend when the active budget is already exhausted.
    const budgetBlock = await this.checkBudget();
    if (budgetBlock) {
      await activityService.log({
        type: 'task_failed',
        message: `Task "${task.title}" blocked: ${budgetBlock}`,
        metadata: { reason: 'budget_exhausted' },
        taskId: task.id,
        projectId: task.projectId,
      });
      await taskService.updateStatus(taskId, TaskStatus.FAILED, `Blocked: ${budgetBlock}`);
      return { success: false, output: '', error: budgetBlock };
    }

    const run = await prisma.agentRun.create({
      data: {
        agentType: adapterId,
        status: 'running',
        input: JSON.stringify({ title: task.title, description: task.description, model }),
        taskId: task.id,
        projectId: task.projectId,
        startedAt: new Date(),
      },
    });

    await prisma.task.update({ where: { id: taskId }, data: { assignedAgent: adapterId } });
    await taskService.updateStatus(taskId, TaskStatus.IN_PROGRESS, `Running on ${adapterId} (${model})`);

    await activityService.log({
      type: 'agent_run',
      message: `Started "${task.title}" on ${adapterId}`,
      metadata: { adapter: adapterId, model, agentRunId: run.id },
      taskId: task.id,
      projectId: task.projectId,
    });

    const result = await adapterManager.executeWithFallback(adapterId, {
      prompt: this.buildPrompt(task),
      systemPrompt: this.buildSystemPrompt(task.project.name, task.project.path),
      model,
      cwd: task.project.path,
      allowWrites: true,
      timeout: 600000,
    });

    const durationSec = Math.round((result.durationMs ?? 0) / 1000);

    if (result.success) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          output: result.output.slice(0, 100000),
          tokensUsed: (result.tokenUsage?.input ?? 0) + (result.tokenUsage?.output ?? 0),
          cost: result.cost ?? 0,
          duration: durationSec,
          completedAt: new Date(),
        },
      });

      if (result.cost && result.cost > 0) {
        await prisma.costLedger.create({
          data: {
            amount: result.cost,
            category: 'inference',
            description: `${result.adapterUsed} — ${task.title}`,
            referenceId: run.id,
            referenceType: 'agent_run',
          },
        });
      }

      // Keep the CLI's answer with the task so it is visible in the UI.
      await prisma.artifact.create({
        data: {
          type: 'code',
          name: `${result.adapterUsed} output — ${task.title}`,
          content: result.output.slice(0, 200000),
          taskId: task.id,
          projectId: task.projectId,
          agentRunId: run.id,
        },
      });

      const note = result.fellBack ? ` (fell back to ${result.adapterUsed})` : '';
      await taskService.updateStatus(taskId, TaskStatus.REVIEW, `Completed via ${result.adapterUsed}${note}`);

      await activityService.log({
        type: 'task_success',
        message: result.output.slice(0, 500) || `Completed "${task.title}" in ${durationSec}s`,
        metadata: {
          adapter: result.adapterUsed,
          fellBack: result.fellBack,
          durationSec,
          costUsd: result.cost ?? 0,
          tokens: result.tokenUsage,
          agentRunId: run.id,
        },
        taskId: task.id,
        projectId: task.projectId,
      });
      logger.info(`Task ${taskId} completed via ${result.adapterUsed}${note}`);

      return { success: true, output: result.output, adapterUsed: result.adapterUsed };
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: result.error?.slice(0, 4000),
        duration: durationSec,
        completedAt: new Date(),
      },
    });

    await taskService.updateStatus(taskId, TaskStatus.FAILED, `Failed on ${adapterId}`);

    await activityService.log({
      type: 'task_failed',
      message: result.error ?? `Task "${task.title}" failed`,
      metadata: { adapter: adapterId, durationSec, agentRunId: run.id, error: result.error },
      taskId: task.id,
      projectId: task.projectId,
    });
    logger.error(`Task ${taskId} failed: ${result.error}`);

    return { success: false, output: result.output, error: result.error };
  }

  private buildSystemPrompt(projectName: string, projectPath: string): string {
    return [
      `You are an autonomous engineer working in the repository "${projectName}" at ${projectPath}.`,
      'Read the existing code before changing it and match its conventions.',
      'Make the edits directly in the working tree, then summarize what you changed and why.',
      'If the request is ambiguous, state the assumption you made and continue.',
    ].join(' ');
  }

  private buildPrompt(task: { title: string; description: string | null; priority: string; type: string }): string {
    const lines = [`Task: ${task.title}`];
    if (task.description) lines.push('', task.description);
    lines.push('', `Type: ${task.type}`, `Priority: ${task.priority}`);
    return lines.join('\n');
  }

  /** Returns a reason string when spending is blocked, or null when it is fine to proceed. */
  private async checkBudget(): Promise<string | null> {
    const budget = await prisma.budget.findFirst({ where: { isActive: true } });
    if (!budget) return null;

    const since = new Date();
    if (budget.period === 'weekly') since.setDate(since.getDate() - 7);
    else since.setMonth(since.getMonth() - 1);

    const spend = await prisma.costLedger.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { amount: true },
    });
    const spent = spend._sum.amount ?? 0;

    if (spent >= budget.amount) {
      return `budget limit reached ($${spent.toFixed(2)} of $${budget.amount.toFixed(2)})`;
    }
    return null;
  }
}

export const taskExecutionService = new TaskExecutionService();
