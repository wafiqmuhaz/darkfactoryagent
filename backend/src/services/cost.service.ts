import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class CostService {
  private readonly COST_LIMIT = 50.0; // Mock budget of $50

  async trackUsage(agentId: string, model: string, inputTokens: number, outputTokens: number) {
    // Stub implementation
    const costEstimate = (inputTokens * 0.00001) + (outputTokens * 0.00003);
    logger.info(`Tracked cost for ${model}: $${costEstimate.toFixed(4)}`);
    return { success: true, cost: costEstimate };
  }

  async getBudgetStatus(projectId: string) {
    return {
      limit: this.COST_LIMIT,
      used: 12.50,
      remaining: this.COST_LIMIT - 12.50,
      status: 'healthy'
    };
  }
}

export const costService = new CostService();
