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
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed with error: ${err.message}`);
  });

  return worker;
};
