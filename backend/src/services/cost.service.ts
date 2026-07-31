import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class CostService {
  /**
   * Track usage by writing to the CostLedger.
   * Called after agent runs or API calls with token/cost data.
   */
  async trackUsage(
    agentId: string | null,
    model: string,
    inputTokens: number,
    outputTokens: number,
    referenceId?: string,
    referenceType?: string
  ) {
    // Simple cost estimate based on token counts (rough approximation)
    const costEstimate = inputTokens * 0.00001 + outputTokens * 0.00003;

    await prisma.costLedger.create({
      data: {
        amount: costEstimate,
        currency: 'USD',
        description: `${model} inference (${inputTokens}+${outputTokens} tokens)`,
        category: 'inference',
        inputTokens,
        outputTokens,
        agentId,
        referenceId,
        referenceType,
      },
    });

    logger.info(`[CostService] Tracked $${costEstimate.toFixed(6)} for ${model}`);
    return { success: true, cost: costEstimate };
  }

  /**
   * Get budget status for a project or agent by querying real CostLedger and Budget tables.
   * Returns active budget limit, current spend, and alert thresholds.
   */
  async getBudgetStatus(agentId?: string) {
    const activeBudget = await prisma.budget.findFirst({
      where: { isActive: true, agentId: agentId ?? null },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeBudget) {
      return {
        limit: null,
        used: 0,
        remaining: null,
        status: 'no_budget',
        message: 'No active budget configured',
      };
    }

    const where = agentId ? { agentId } : {};
    const periodStart = activeBudget.startDate;
    const periodEnd = activeBudget.endDate ?? new Date();

    const spend = await prisma.costLedger.aggregate({
      where: {
        ...where,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    });

    const used = spend._sum.amount ?? 0;
    const limit = activeBudget.amount;
    const remaining = Math.max(0, limit - used);
    const percentage = (used / limit) * 100;

    let status: string;
    if (percentage >= 100 && activeBudget.alert100) status = 'exceeded';
    else if (percentage >= 80 && activeBudget.alert80) status = 'warning';
    else if (percentage >= 50 && activeBudget.alert50) status = 'attention';
    else status = 'healthy';

    return {
      limit,
      used: parseFloat(used.toFixed(4)),
      remaining: parseFloat(remaining.toFixed(4)),
      percentage: Math.round(percentage),
      status,
      periodStart: activeBudget.startDate,
      periodEnd: activeBudget.endDate,
    };
  }

  /**
   * Create or update a budget for an agent or instance-wide.
   */
  async setBudget(amount: number, period: string = 'monthly', agentId?: string) {
    // Deactivate existing budgets for this scope
    await prisma.budget.updateMany({
      where: { agentId: agentId ?? null, isActive: true },
      data: { isActive: false },
    });

    const startDate = new Date();
    let endDate: Date | null = null;
    if (period === 'monthly') {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (period === 'weekly') {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    }

    const budget = await prisma.budget.create({
      data: {
        name: agentId ? `Agent ${agentId} Budget` : 'Instance-wide Budget',
        amount,
        period,
        startDate,
        endDate,
        isActive: true,
        agentId,
      },
    });

    logger.info(`[CostService] Created ${period} budget of $${amount} (${agentId ?? 'instance-wide'})`);
    return budget;
  }
}

export const costService = new CostService();
