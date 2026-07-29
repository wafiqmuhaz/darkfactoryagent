import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { chiefOfStaffAgent } from '../agents/chief-of-staff';
import { AgentContext } from '../agents/base-agent';

const connection = {
  host: config.redisHost,
  port: parseInt(config.redisPort, 10),
};

export const taskQueue = new Queue('dark-factory-tasks', { connection });

export const initQueueWorker = () => {
  const worker = new Worker(
    'dark-factory-tasks',
    async (job: Job) => {
      logger.info(`Processing job ${job.id} for task ${job.data.taskId}`);
      
      const context: AgentContext = {
        projectId: job.data.projectId,
        taskId: job.data.taskId,
        agentRunId: job.id!,
      };

      try {
        // Dispatch to appropriate agent based on job.data.agentType
        // For now, defaulting to Chief of Staff for orchestration jobs
        if (job.data.agentType === 'chief-of-staff') {
          return await chiefOfStaffAgent.execute(context, job.data.input);
        }
        
        throw new Error(`Unknown agent type: ${job.data.agentType}`);
      } catch (error: any) {
        logger.error(`Job ${job.id} failed: ${error.message}`);
        throw error;
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed with error: ${err.message}`);
  });

  return worker;
};
