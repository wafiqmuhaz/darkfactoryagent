import { Queue } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Producer-side queue handle, kept separate from the worker in `queue.ts`.
 *
 * The worker imports agents and services which in turn import task.service — so
 * if task.service imported queue.ts directly the module graph would cycle.
 * Enqueueing only needs the Queue, which is all this module owns.
 */

export const TASK_QUEUE_NAME = 'dark-factory-tasks';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  // Fail fast instead of retrying forever when Redis is down, so callers can
  // fall back to inline execution.
  maxRetriesPerRequest: 2,
};

export const taskQueue = new Queue(TASK_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

taskQueue.on('error', (err) => {
  // Without a handler ioredis errors become unhandled rejections and crash the process.
  logger.warn(`Task queue connection error: ${err.message}`);
});

export function priorityToQueueWeight(priority: string): number {
  switch (priority) {
    case 'critical': return 1;
    case 'high': return 2;
    case 'medium': return 3;
    default: return 4;
  }
}

/** Queue counts for the dashboard; zeros when Redis is unreachable. */
export async function getQueueCounts(): Promise<Record<string, number>> {
  try {
    return await taskQueue.getJobCounts();
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }
}
