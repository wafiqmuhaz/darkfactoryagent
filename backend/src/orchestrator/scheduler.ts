import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { pipeline } from './pipeline';

class SchedulerService {
  private nightlyJob: cron.ScheduledTask | null = null;
  private priorityJob: cron.ScheduledTask | null = null;
  private summaryJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // 8:00 PM Prioritization
    this.priorityJob = cron.schedule('0 20 * * *', async () => {
      logger.info('Running nightly prioritization');
      try {
        await pipeline.prioritizeBacklog();
      } catch (error) {
        logger.error('Prioritization failed', error);
      }
    });

    // 9:00 PM Nightly Pipeline
    this.nightlyJob = cron.schedule('0 21 * * *', async () => {
      logger.info('Starting nightly pipeline');
      try {
        await pipeline.startNightlyBuild();
      } catch (error) {
        logger.error('Nightly pipeline failed', error);
      }
    });

    // 6:00 AM Nightly Summary
    this.summaryJob = cron.schedule('0 6 * * *', async () => {
      logger.info('Generating nightly summary');
      try {
        await pipeline.generateSummary();
      } catch (error) {
        logger.error('Summary generation failed', error);
      }
    });

    logger.info('Scheduler service started');
  }

  stop() {
    this.nightlyJob?.stop();
    this.priorityJob?.stop();
    this.summaryJob?.stop();
    this.isRunning = false;
    logger.info('Scheduler service stopped');
  }
}

export const schedulerService = new SchedulerService();
