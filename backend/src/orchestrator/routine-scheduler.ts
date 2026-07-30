import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { taskQueue } from './queue';

const prisma = new PrismaClient();

class RoutineSchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const routines = await prisma.routine.findMany({ where: { isActive: true } });
    for (const routine of routines) {
      this.scheduleRoutine(routine);
    }
    logger.info(`Routine scheduler started with ${routines.length} active routines`);
  }

  scheduleRoutine(routine: { id: string; schedule: string; timezone?: string; name: string }) {
    // Remove existing if re-scheduling
    this.unscheduleRoutine(routine.id);

    if (!cron.validate(routine.schedule)) {
      logger.warn(`Invalid cron expression for routine ${routine.name}: ${routine.schedule}`);
      return;
    }

    const job = cron.schedule(routine.schedule, async () => {
      logger.info(`Routine triggered: ${routine.name} (${routine.id})`);
      try {
        await this.executeRoutine(routine.id);
      } catch (error: any) {
        logger.error(`Routine execution failed: ${routine.name} — ${error.message}`);
      }
    }, {
      timezone: routine.timezone || 'UTC',
    });

    this.jobs.set(routine.id, job);
    logger.info(`Scheduled routine: ${routine.name} (${routine.schedule})`);
  }

  unscheduleRoutine(routineId: string) {
    const existing = this.jobs.get(routineId);
    if (existing) {
      existing.stop();
      this.jobs.delete(routineId);
    }
  }

  async executeRoutine(routineId: string) {
    const routine = await prisma.routine.findUnique({ where: { id: routineId } });
    if (!routine || !routine.isActive) return;

    // Create run record
    const run = await prisma.routineRun.create({
      data: {
        routineId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      // Parse task template and queue it
      const template = routine.taskTemplate ? JSON.parse(routine.taskTemplate) : {};
      await taskQueue.add('routine-task', {
        agentType: routine.agentId || 'chief-of-staff',
        projectId: routine.projectId,
        taskId: `routine-${routineId}-${Date.now()}`,
        input: {
          description: template.description || `Routine: ${routine.name}`,
          context: 'routine',
        },
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });

      // Update run as completed
      await prisma.routineRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          duration: Math.floor((Date.now() - run.startedAt!.getTime()) / 1000),
        },
      });

      // Update routine stats
      await prisma.routine.update({
        where: { id: routineId },
        data: {
          lastRunAt: new Date(),
          runCount: { increment: 1 },
          nextRunAt: calculateNextRun(routine.schedule, routine.timezone || 'UTC'),
        },
      });

      logger.info(`Routine completed: ${routine.name} (run: ${run.id})`);
    } catch (error: any) {
      await prisma.routineRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
          duration: Math.floor((Date.now() - run.startedAt!.getTime()) / 1000),
        },
      });
      logger.error(`Routine failed: ${routine.name} — ${error.message}`);
    }
  }

  async stop() {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    this.isRunning = false;
    logger.info('Routine scheduler stopped');
  }

  getActiveJobCount(): number {
    return this.jobs.size;
  }
}

function calculateNextRun(cronExpression: string, timezone: string): Date | null {
  try {
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return null;

    const minute = parseInt(parts[0]);
    const hour = parseInt(parts[1]);

    const now = new Date();
    const next = new Date(now);
    next.setHours(hour || 0, minute || 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  } catch {
    return null;
  }
}

export const routineScheduler = new RoutineSchedulerService();
