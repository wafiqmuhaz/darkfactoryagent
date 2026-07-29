import { BaseAgent, AgentContext } from './base-agent';
import { taskService } from '../services/task.service';
import { aiModelManager } from '../ai/model-manager';

export class ChiefOfStaffAgent extends BaseAgent {
  protected name = 'ChiefOfStaff';

  protected async run(context: AgentContext, input: any): Promise<any> {
    this.log('info', 'Analyzing task dependencies with AI...');

    const prompt = input?.description
      ? `You are the Chief of Staff in a Dark Factory AI development system. Decompose the following task into 2–5 actionable sub-tasks. Respond ONLY with a JSON array of objects like [{"title": "...", "assignTo": "SpecWriter|CodeWriter|TestWriter"}].\n\nTask: ${input.description}`
      : null;

    let plan: { subTasks: { title: string; assignTo: string }[] };

    if (prompt) {
      const response = await aiModelManager.complete(
        [
          { role: 'system', content: 'You are a senior engineering manager. Reply only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { strategy: 'cheapest', requiredCapability: 'reasoning' }
      );

      try {
        const parsed = JSON.parse(response.content.replace(/```json|```/g, '').trim());
        plan = { subTasks: Array.isArray(parsed) ? parsed : parsed.subTasks ?? [] };
        this.log('info', `AI decomposed task into ${plan.subTasks.length} sub-tasks (model: ${response.model}, cost: $${response.costUsd.toFixed(6)})`);
      } catch {
        this.log('warn', 'AI response could not be parsed as JSON — using fallback plan');
        plan = {
          subTasks: [
            { title: 'Write specs', assignTo: 'SpecWriter' },
            { title: 'Implement feature', assignTo: 'CodeWriter' },
          ],
        };
      }
    } else {
      plan = {
        subTasks: [
          { title: 'Write specs', assignTo: 'SpecWriter' },
          { title: 'Implement feature', assignTo: 'CodeWriter' },
        ],
      };
    }

    for (const sub of plan.subTasks) {
      await taskService.createTask({
        title: sub.title,
        projectId: context.projectId,
        parentTaskId: context.taskId,
        status: 'BACKLOG',
      });
      this.log('info', `Created sub-task: ${sub.title}`);
    }

    return { status: 'DECOMPOSED', plan };
  }
}

export const chiefOfStaffAgent = new ChiefOfStaffAgent();
