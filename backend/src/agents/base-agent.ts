import { logger } from '../utils/logger';
import { aiModelManager } from '../ai/model-manager';
import { skillRegistry } from '../skills/skill-registry';
import { taskExecutionService } from '../services/task-execution.service';
import type { AIMessage } from '../ai/model-registry';

export interface AgentContext {
  projectId: string;
  taskId: string;
  agentRunId: string;
}

export type ExecutionMode = 'text' | 'adapter' | 'skill' | 'hybrid';

export interface AgentDefinition {
  agentType: string;
  name: string;
  executionMode: ExecutionMode;
  description: string;
  strategy?: 'cheapest' | 'fastest' | 'best' | 'specific';
  preferredModel?: string;
  requiredCapability?: string;
  requiredSkills?: string[];
  artifactType?: string;
}

export abstract class BaseAgent {
  protected abstract name: string;

  constructor(protected def: AgentDefinition) {}

  public getDefinition(): AgentDefinition {
    return this.def;
  }

  public async execute(context: AgentContext, input: any): Promise<any> {
    try {
      this.log('info', `Starting execution for task ${context.taskId}`);

      const isValid = await this.validate(input);
      if (!isValid) {
        throw new Error(`Validation failed for ${this.name}`);
      }

      // Dispatch based on execution mode
      let result: any;
      switch (this.def.executionMode) {
        case 'text':
          result = await this.runText(context, input);
          break;
        case 'adapter':
          result = await this.runAdapter(context, input);
          break;
        case 'skill':
          result = await this.runSkill(context, input);
          break;
        case 'hybrid':
          result = await this.runHybrid(context, input);
          break;
        default:
          throw new Error(`Unknown execution mode: ${this.def.executionMode}`);
      }

      this.log('info', `Successfully completed task ${context.taskId}`);
      return result;
    } catch (error: any) {
      this.log('error', `Execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * TEXT mode: LLM only, creates Artifact, no repo edits.
   * Used by planning/documentation agents.
   */
  protected async runText(context: AgentContext, input: any): Promise<any> {
    const { agentRunRecorder } = await import('./agent-run-recorder');

    const run = await agentRunRecorder.start(this.def, context);

    try {
      const messages = this.buildMessages(context, input);
      const res = await aiModelManager.complete(
        messages,
        {
          strategy: this.def.strategy ?? 'best',
          specificModelId: this.def.preferredModel,
          requiredCapability: this.def.requiredCapability,
          allowMockFallback: true, // TEXT mode always allows mock fallback
        },
        { maxTokens: 4096 }
      );

      if (res.mock) {
        this.log('warn', '⚠️ No API key for text agent, using mock response');
      }

      await agentRunRecorder.finishWithArtifact(run, {
        artifactType: this.def.artifactType ?? 'doc',
        name: `${this.def.name} — ${input?.title ?? context.taskId}`,
        content: res.content,
        response: res,
        metadata: { mock: !!res.mock, model: res.model, provider: res.provider },
      });

      return {
        status: 'COMPLETED',
        mock: !!res.mock,
        model: res.model,
        content: res.content,
      };
    } catch (error: any) {
      await agentRunRecorder.failRun(run, error.message);
      throw error;
    }
  }

  /**
   * ADAPTER mode: Hard API-key check, then real CLI + working-tree edits.
   * Used by code writer.
   */
  protected async runAdapter(context: AgentContext, input: any): Promise<any> {
    // Hard requirement: at least one provider must have a key
    const hasKey = ['anthropic', 'openai', 'google'].some((p) =>
      aiModelManager.hasProviderKey(p)
    );

    if (!hasKey) {
      throw new Error(
        '❌ ADAPTER mode requires valid API key – refusing to edit repo with mock data'
      );
    }

    // Delegate to the proven adapter lifecycle (AgentRun, CostLedger, Artifact, status)
    return taskExecutionService.executeTask(context.taskId);
  }

  /**
   * SKILL mode: No LLM, no adapter. Direct skill execution.
   * Used by crawler/searcher/scraper agents.
   */
  protected async runSkill(context: AgentContext, input: any): Promise<any> {
    const { agentRunRecorder } = await import('./agent-run-recorder');

    // Verify required skills are enabled
    for (const skillName of this.def.requiredSkills ?? []) {
      if (!skillRegistry.isEnabled(skillName)) {
        throw new Error(`Required skill '${skillName}' is disabled`);
      }
    }

    const run = await agentRunRecorder.start(this.def, context);

    try {
      const output = await this.runSkillLogic(context, input);

      await agentRunRecorder.finishWithArtifact(run, {
        artifactType: this.def.artifactType ?? 'data',
        name: `${this.def.name} — ${context.taskId}`,
        content: typeof output === 'string' ? output : JSON.stringify(output),
        response: null,
        metadata: {},
      });

      return { status: 'COMPLETED', output };
    } catch (error: any) {
      await agentRunRecorder.failRun(run, error.message);
      throw error;
    }
  }

  /**
   * HYBRID mode: Read repo via skills, run real shell, analyze with LLM.
   * Mock analysis allowed (with warning), but shell execution is always real.
   * Used by test/review agents.
   */
  protected async runHybrid(context: AgentContext, input: any): Promise<any> {
    const { agentRunRecorder } = await import('./agent-run-recorder');

    const run = await agentRunRecorder.start(this.def, context);

    try {
      // Gather real data via skills (file-system, shell-executor, git-operations)
      const repoData = await this.gatherHybridInputs(context, input);

      // Analyze with LLM (honors global ALLOW_MOCK_FALLBACK)
      const messages = this.buildMessages(context, { ...input, repoData });
      const res = await aiModelManager.complete(
        messages,
        {
          strategy: this.def.strategy ?? 'cheapest',
          requiredCapability: this.def.requiredCapability,
          allowMockFallback: undefined, // Inherits global ALLOW_MOCK_FALLBACK
        },
        { maxTokens: 4096 }
      );

      if (res.mock) {
        this.log(
          'warn',
          '⚠️ HYBRID mode running with mock analysis – test execution still uses real shell'
        );
      }

      await agentRunRecorder.finishWithArtifact(run, {
        artifactType: this.def.artifactType ?? 'review',
        name: `${this.def.name} — ${context.taskId}`,
        content: res.content,
        response: res,
        metadata: {
          mock: !!res.mock,
          model: res.model,
          repoDataSummary: repoData?.summary ?? null,
        },
      });

      return {
        status: 'COMPLETED',
        mock: !!res.mock,
        content: res.content,
      };
    } catch (error: any) {
      await agentRunRecorder.failRun(run, error.message);
      throw error;
    }
  }

  // Hooks for subclasses to override

  /**
   * Build the LLM messages for TEXT/HYBRID modes.
   * Override in subclasses to customize prompts.
   */
  protected buildMessages(context: AgentContext, input: any): AIMessage[] {
    return [
      {
        role: 'system',
        content: `You are ${this.def.name}. ${this.def.description}`,
      },
      {
        role: 'user',
        content: input?.description || input?.title || 'No input provided',
      },
    ];
  }

  /**
   * Gather real repo data for HYBRID mode (via skills).
   * Override in subclasses for test/review-specific data collection.
   */
  protected async gatherHybridInputs(
    context: AgentContext,
    input: any
  ): Promise<any> {
    return { summary: 'No hybrid inputs gathered (override gatherHybridInputs)' };
  }

  /**
   * Run skill-based logic for SKILL mode.
   * Override in subclasses to call skillRegistry.executeSkill().
   */
  protected async runSkillLogic(context: AgentContext, input: any): Promise<any> {
    throw new Error('runSkillLogic not implemented (override for SKILL mode agents)');
  }

  protected async validate(input: any): Promise<boolean> {
    // Default validation, override in subclasses
    return true;
  }

  protected log(level: 'info' | 'error' | 'warn' | 'debug', message: string) {
    logger.log(level, `[${this.name}] ${message}`);
  }
}
