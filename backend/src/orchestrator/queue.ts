import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { chiefOfStaffAgent } from '../agents/chief-of-staff';
import { AgentContext } from '../agents/base-agent';
import { dataLakeService } from '../services/datalake.service';
import { taskExecutionService } from '../services/task-execution.service';
import { taskService, TaskStatus } from '../services/task.service';
import { activityService } from '../services/activity.service';

// Re-exported so existing importers keep working; the Queue itself lives in
// queue-client.ts to avoid a cycle with task.service.
export { taskQueue, TASK_QUEUE_NAME, priorityToQueueWeight, getQueueCounts } from './queue-client';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const initQueueWorker = () => {
  const worker = new Worker(
    'dark-factory-tasks',
    async (job: Job) => {
      const { taskId, projectId, agentType } = job.data;
      logger.info(`Processing job ${job.id} for task ${taskId} (attempt ${job.attemptsMade + 1})`);

      // Adapter-backed run: the task's description is handed to Claude Code / Codex.
      if (agentType === 'adapter-exec' || agentType === 'task-run') {
        // taskExecutionService owns the full lifecycle — status transitions,
        // AgentRun bookkeeping, cost ledger, artifacts, and activity entries.
        const result = await taskExecutionService.executeTask(taskId);
        if (!result.success) {
          // Throwing lets BullMQ retry with backoff; the final failure state is
          // already recorded by the service.
          throw new Error(result.error || 'Adapter execution failed');
        }
        return result;
      }

      if (agentType === 'chief-of-staff') {
        const context: AgentContext = { projectId, taskId, agentRunId: job.id! };
        return await chiefOfStaffAgent.execute(context, job.data.input);
      }

      throw new Error(`Unknown agent type: ${agentType}`);
    },
    { connection, concurrency: config.agents.maxConcurrent }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
    dataLakeService.logEvent({
      eventType: 'agent_run',
      timestamp: new Date().toISOString(),
      data: { jobId: job.id, taskId: job.data.taskId, agentType: job.data.agentType, status: 'completed' },
    });
  });

  worker.on('failed', async (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
    if (!job) return;

    const attemptsLeft = (job.opts.attempts ?? 1) - job.attemptsMade;
    const willRetry = attemptsLeft > 0;

    await activityService.log({
      type: willRetry ? 'task_status' : 'task_failed',
      message: willRetry
        ? `Attempt ${job.attemptsMade} failed, retrying: ${err.message}`
        : `Task failed after ${job.attemptsMade} attempts: ${err.message}`,
      metadata: { jobId: job.id, attempt: job.attemptsMade, willRetry, error: err.message },
      taskId: job.data.taskId,
      projectId: job.data.projectId,
    });

    // Only mark the task failed once BullMQ has exhausted its retries.
    if (!willRetry && job.data.taskId) {
      await taskService
        .updateStatus(job.data.taskId, TaskStatus.FAILED, `Execution failed: ${err.message}`)
        .catch(() => { /* task may have been deleted mid-run */ });
    }

    dataLakeService.logEvent({
      eventType: 'error',
      timestamp: new Date().toISOString(),
      data: { jobId: job.id, taskId: job.data.taskId, agentType: job.data.agentType, error: err.message },
    });
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`Job ${jobId} stalled — it will be retried`);
  });

  worker.on('error', (err) => {
    logger.warn(`Queue worker error: ${err.message}`);
  });

  logger.info(`Queue worker listening (concurrency ${config.agents.maxConcurrent})`);
  return worker;
};
