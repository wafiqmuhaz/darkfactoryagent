import { BaseAgent, AgentContext } from './base-agent';
import { taskService } from '../services/task.service';

export class ChiefOfStaffAgent extends BaseAgent {
  protected name = 'ChiefOfStaff';

  protected async run(context: AgentContext, input: any): Promise<any> {
    this.log('info', 'Analyzing task dependencies...');
    
    // In a real scenario, this connects to LLM to decompose task.
    // For now, we mock the assignment logic.
    const mockPlan = {
      subTasks: [
        { title: 'Write specs', assignTo: 'SpecWriter' },
        { title: 'Implement feature', assignTo: 'CodeWriter' }
      ]
    };

    // Example of orchestrating sub-tasks:
    for (const sub of mockPlan.subTasks) {
      await taskService.createTask({
        title: sub.title,
        projectId: context.projectId,
        parentTaskId: context.taskId,
        status: 'BACKLOG',
      });
      this.log('info', `Created sub-task: ${sub.title}`);
    }

    return { status: 'DECOMPOSED', plan: mockPlan };
  }
}

export const chiefOfStaffAgent = new ChiefOfStaffAgent();
