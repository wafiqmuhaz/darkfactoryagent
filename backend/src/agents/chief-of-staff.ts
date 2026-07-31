import { BaseAgent, AgentContext, AgentDefinition } from './base-agent';
import { taskService } from '../services/task.service';
import { aiModelManager } from '../ai/model-manager';

/** agentType strings the Chief of Staff can delegate to (must match the registry). */
const VALID_AGENT_TYPES = ['spec-writer', 'code-writer', 'test-writer', 'review'];

export class ChiefOfStaffAgent extends BaseAgent {
  protected name = 'ChiefOfStaff';

  static definition: AgentDefinition = {
    agentType: 'chief-of-staff',
    name: 'Chief of Staff',
    executionMode: 'text',
    description: 'Decomposes tasks into actionable sub-tasks and delegates to specialists',
    strategy: 'cheapest',
    requiredCapability: 'reasoning',
    artifactType: 'plan',
  };

  constructor() {
    super(ChiefOfStaffAgent.definition);
  }

  /**
   * Chief of Staff overrides the default TEXT flow: instead of producing a
   * single artifact, it decomposes the task into sub-tasks and delegates each
   * to a registered specialist via its agentType.
   */
  protected async runText(context: AgentContext, input: any): Promise<any> {
    this.log('info', 'Analyzing task dependencies with AI...');

    const prompt = input?.description
      ? `You are the Chief of Staff in a Dark Factory AI development system. Decompose the following task into 2–5 actionable sub-tasks. Respond ONLY with a JSON array of objects like [{"title": "...", "agentType": "spec-writer|code-writer|test-writer|review"}].\n\nTask: ${input.description}`
      : null;

    let plan: { subTasks: { title: string; agentType: string }[] };

    if (prompt) {
      const response = await aiModelManager.complete(
        [
          { role: 'system', content: 'You are a senior engineering manager. Reply only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { strategy: 'cheapest', requiredCapability: 'reasoning', allowMockFallback: true }
      );

      if (response.mock) {
        this.log('warn', '⚠️ No API key for Chief of Staff, using fallback plan');
      }

      try {
        const parsed = JSON.parse(response.content.replace(/```json|```/g, '').trim());
        const rawTasks = Array.isArray(parsed) ? parsed : parsed.subTasks ?? [];
        // Normalize agentType and validate against the registry's known types
        plan = {
          subTasks: rawTasks.map((t: any) => ({
            title: t.title,
            agentType: VALID_AGENT_TYPES.includes(t.agentType) ? t.agentType : 'code-writer',
          })),
        };
        this.log(
          'info',
          `AI decomposed task into ${plan.subTasks.length} sub-tasks (model: ${response.model}, cost: $${response.costUsd.toFixed(6)})`
        );
      } catch {
        this.log('warn', 'AI response could not be parsed as JSON — using fallback plan');
        plan = this.fallbackPlan();
      }
    } else {
      plan = this.fallbackPlan();
    }

    for (const sub of plan.subTasks) {
      await taskService.createTask({
        title: sub.title,
        projectId: context.projectId,
        parentTaskId: context.taskId,
        status: 'BACKLOG',
        agentType: sub.agentType,
      });
      this.log('info', `Created sub-task: ${sub.title} → ${sub.agentType}`);
    }

    return { status: 'DECOMPOSED', plan };
  }

  private fallbackPlan(): { subTasks: { title: string; agentType: string }[] } {
    return {
      subTasks: [
        { title: 'Write specs', agentType: 'spec-writer' },
        { title: 'Implement feature', agentType: 'code-writer' },
      ],
    };
  }
}

export const chiefOfStaffAgent = new ChiefOfStaffAgent();
