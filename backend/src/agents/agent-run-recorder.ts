import { PrismaClient } from '@prisma/client';
import { taskService, TaskStatus } from '../services/task.service';
import { emitAgentRunUpdated } from '../websocket/socket';
import type { AgentDefinition } from './base-agent';
import type { AgentContext } from './base-agent';

const prisma = new PrismaClient();

export interface ArtifactParams {
  artifactType: string;
  name: string;
  content: string;
  response: any;
  metadata: Record<string, any>;
}

/**
 * Bookkeeping helper for TEXT/SKILL/HYBRID modes that don't use adapters.
 * Mirrors task-execution.service's AgentRun/CostLedger/Artifact lifecycle.
 */
class AgentRunRecorder {
  /**
   * Create an AgentRun record and mark task IN_PROGRESS.
   */
  async start(def: AgentDefinition, context: AgentContext) {
    const run = await prisma.agentRun.create({
      data: {
        agentType: def.agentType,
        status: 'running',
        trigger: 'assignment',
        adapter: null, // No adapter for TEXT/SKILL/HYBRID
        model: def.preferredModel ?? null,
        input: JSON.stringify({ agentType: def.agentType }),
        taskId: context.taskId,
        projectId: context.projectId,
        agentId: null, // Can be resolved later if needed
        startedAt: new Date(),
      },
    });

    // Mark task in progress
    await taskService.updateStatus(
      context.taskId,
      TaskStatus.IN_PROGRESS,
      `Running ${def.name}`
    );

    if (context.agentRunId) {
      emitAgentRunUpdated(context.agentRunId, {
        runId: run.id,
        status: 'running',
        taskId: context.taskId,
      });
    }

    return run;
  }

  /**
   * Mark AgentRun completed, create Artifact, record cost if any, move task to REVIEW.
   */
  async finishWithArtifact(run: any, params: ArtifactParams) {
    const { artifactType, name, content, response, metadata } = params;

    const inputTokens = response?.tokens?.input ?? 0;
    const outputTokens = response?.tokens?.output ?? 0;
    const costUsd = response?.costUsd ?? 0;
    const latencyMs = response?.latencyMs ?? 0;

    // Update AgentRun to completed
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        output: content.slice(0, 100000),
        inputTokens,
        outputTokens,
        tokensUsed: inputTokens + outputTokens,
        cost: costUsd,
        duration: Math.round(latencyMs / 1000),
        metadata: JSON.stringify({
          model: response?.model ?? null,
          provider: response?.provider ?? null,
          mock: response?.mock ?? false,
          latencyMs,
        }),
        completedAt: new Date(),
      },
    });

    // Create CostLedger entry if cost > 0
    if (costUsd > 0) {
      await prisma.costLedger.create({
        data: {
          amount: costUsd,
          category: 'inference',
          description: `${response?.provider ?? 'AI'} — ${name}`,
          inputTokens,
          outputTokens,
          referenceId: run.id,
          referenceType: 'agent_run',
          agentId: run.agentId,
        },
      });
    }

    // Create Artifact
    await prisma.artifact.create({
      data: {
        type: artifactType,
        name,
        content: content.slice(0, 200000),
        metadata: JSON.stringify(metadata),
        taskId: run.taskId,
        projectId: run.projectId,
        agentRunId: run.id,
      },
    });

    // Move task to REVIEW
    await taskService.updateStatus(
      run.taskId,
      TaskStatus.REVIEW,
      `Completed via ${response?.model ?? 'agent'}`
    );

    if (run.agentId) {
      emitAgentRunUpdated(run.agentId, {
        runId: run.id,
        status: 'completed',
        taskId: run.taskId,
      });
    }
  }

  /**
   * Mark AgentRun failed and move task to FAILED.
   */
  async failRun(run: any, errorMessage: string) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: errorMessage.slice(0, 4000),
        completedAt: new Date(),
      },
    });

    await taskService.updateStatus(
      run.taskId,
      TaskStatus.FAILED,
      `Agent failed: ${errorMessage.slice(0, 200)}`
    );

    if (run.agentId) {
      emitAgentRunUpdated(run.agentId, {
        runId: run.id,
        status: 'failed',
        taskId: run.taskId,
      });
    }
  }
}

export const agentRunRecorder = new AgentRunRecorder();
