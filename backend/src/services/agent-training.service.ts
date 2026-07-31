import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class AgentTrainingService {
  /**
   * Log feedback for an agent run by writing to the AgentRun's metadata JSON field.
   * This creates a traceable feedback loop for future prompt optimization.
   */
  async logFeedback(agentRunId: string, feedback: string, rating: number) {
    logger.info(`[AgentTrainingService] Received feedback for run ${agentRunId}: Rating ${rating}/5`);

    const run = await prisma.agentRun.findUnique({ where: { id: agentRunId } });
    if (!run) {
      throw new Error(`AgentRun ${agentRunId} not found`);
    }

    // Parse existing metadata or start fresh
    let metadata: any = {};
    if (run.metadata) {
      try {
        metadata = JSON.parse(run.metadata);
      } catch {
        logger.warn(`[AgentTrainingService] Could not parse metadata for run ${agentRunId}`);
      }
    }

    // Append feedback
    metadata.feedback = {
      rating,
      comment: feedback,
      recordedAt: new Date().toISOString(),
    };

    await prisma.agentRun.update({
      where: { id: agentRunId },
      data: { metadata: JSON.stringify(metadata) },
    });

    logger.info(`[AgentTrainingService] Feedback saved for run ${agentRunId}`);
    return { success: true };
  }

  /**
   * Get optimization suggestions based on recent runs and feedback for a given agent type.
   * Analyzes failure patterns, low-rated runs, and common errors.
   */
  async getOptimizationSuggestions(agentType: string): Promise<string[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [failedRuns, completedRuns] = await Promise.all([
      prisma.agentRun.findMany({
        where: { agentType, status: 'failed', createdAt: { gte: thirtyDaysAgo } },
        select: { error: true },
        take: 50,
      }),
      prisma.agentRun.findMany({
        where: { agentType, status: 'completed', createdAt: { gte: thirtyDaysAgo } },
        select: { metadata: true },
        take: 100,
      }),
    ]);

    const suggestions: string[] = [];

    // Analyze failure patterns
    if (failedRuns.length > 10) {
      const timeoutErrors = failedRuns.filter((r) => r.error?.includes('timeout')).length;
      const parseErrors = failedRuns.filter(
        (r) => r.error?.includes('parse') || r.error?.includes('JSON')
      ).length;

      if (timeoutErrors > 5) {
        suggestions.push('Consider increasing timeout or breaking complex tasks into smaller steps');
      }
      if (parseErrors > 5) {
        suggestions.push('Add stricter JSON schema validation to prompts to reduce parse errors');
      }
    }

    // Analyze feedback from metadata
    let lowRatedCount = 0;
    for (const run of completedRuns) {
      if (!run.metadata) continue;
      try {
        const meta = JSON.parse(run.metadata);
        if (meta.feedback && meta.feedback.rating < 3) {
          lowRatedCount++;
        }
      } catch {
        // Skip unparseable metadata
      }
    }

    if (lowRatedCount > 10) {
      suggestions.push('Review prompts for clarity — multiple runs received low ratings');
    }

    // Agent-specific heuristics
    if (agentType === 'code-writer') {
      suggestions.push('Ensure test coverage for generated code to catch regressions early');
    } else if (agentType === 'spec-writer') {
      suggestions.push('Include more examples in specs to reduce ambiguity');
    }

    if (suggestions.length === 0) {
      suggestions.push('No major issues detected — current configuration appears stable');
    }

    return suggestions;
  }
}

export const agentTrainingService = new AgentTrainingService();
