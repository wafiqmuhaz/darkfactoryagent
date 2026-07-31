import { BaseAgent, AgentDefinition, AgentContext } from './base-agent';
import type { AIMessage } from '../ai/model-registry';

export class SpecAgent extends BaseAgent {
  protected name = 'SpecAgent';

  static definition: AgentDefinition = {
    agentType: 'spec-writer',
    name: 'Spec Writer',
    executionMode: 'text',
    description: 'Writes technical specifications and design documents',
    strategy: 'best',
    requiredCapability: 'planning',
    artifactType: 'spec',
  };

  constructor() {
    super(SpecAgent.definition);
  }

  protected buildMessages(context: AgentContext, input: any): AIMessage[] {
    const task = input?.title || input?.description || 'Specification task';
    const details = input?.description || '';

    return [
      {
        role: 'system',
        content: `You are a senior technical architect writing detailed software specifications. Your specs include:
- Clear problem statement and goals
- User stories and acceptance criteria
- Technical requirements and constraints
- API contracts and data models
- Edge cases and error handling
- Security and performance considerations

Write clear, actionable specifications that developers can implement directly.`,
      },
      {
        role: 'user',
        content: `Write a technical specification for the following:\n\nTask: ${task}\n\n${details ? `Details:\n${details}` : ''}`,
      },
    ];
  }
}
