import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { chiefOfStaffAgent } from '../agents/chief-of-staff';
import { AgentContext } from '../agents/base-agent';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const taskQueue = new Queue('dark-factory-tasks', { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600, // keep for 1 hour
      count: 1000, // keep max 1000 completed
    },
    removeOnFail: {
      age: 24 * 3600, // keep for 24 hours
    }
  }
});

import { dataLakeService } from '../services/datalake.service';
import { taskExecutionService } from '../services/task-execution.service';

export const initQueueWorker = () => {
  const worker = new Worker(
    'dark-factory-tasks',
    async (job: Job) => {
      logger.info(`Processing job ${job.id} for task ${job.data.taskId} (Attempt: ${job.attemptsMade + 1})`);

      const context: AgentContext = {
        projectId: job.data.projectId,
        taskId: job.data.taskId,
        agentRunId: job.id!,
      };

      try {
        // Adapter-backed execution: hand the task to Claude Code / Codex.
        if (job.data.agentType === 'adapter-exec') {
          const result = await taskExecutionService.executeTask(job.data.taskId);
          if (!result.success) {
            throw new Error(result.error || 'Adapter execution failed');
          }
          return result;
        }

        if (job.data.agentType === 'chief-of-staff') {
          return await chiefOfStaffAgent.execute(context, job.data.input);
        }

        throw new Error(`Unknown agent type: ${job.data.agentType}`);
      } catch (error: any) {
        logger.error(`Job ${job.id} failed: ${error.message}`);
        throw error;
      }
    },
    { connection, concurrency: 5 }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
    dataLakeService.logEvent({
      eventType: 'agent_run',
      timestamp: new Date().toISOString(),
      data: {
        jobId: job.id,
        taskId: job.data.taskId,
        agentType: job.data.agentType,
        status: 'completed'
      }
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed with error: ${err.message}`);
    if (job) {
      dataLakeService.logEvent({
        eventType: 'error',
        timestamp: new Date().toISOString(),
        data: {
          jobId: job.id,
          taskId: job.data.taskId,
          agentType: job.data.agentType,
          error: err.message
        }
      });
    }
  });

  return worker;
};
