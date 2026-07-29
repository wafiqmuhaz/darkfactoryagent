import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsService {
  async getDoraMetrics(projectId: string) {
    // Stub for calculating Deployment Frequency, Lead Time for Changes, etc.
    // In reality, this queries the `Task` and `AgentRun` tables
    return {
      deploymentFrequency: '2/day',
      leadTimeForChanges: '4 hours',
      changeFailureRate: '5%',
      meanTimeToRecovery: '30 mins'
    };
  }

  async getAgentPerformance(projectId: string) {
    return {
      tasksCompleted: 42,
      averageTimePerTask: '45 mins',
      successRate: '95%'
    };
  }
}

export const analyticsService = new AnalyticsService();
