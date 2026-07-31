import { BaseAgent, AgentDefinition } from './base-agent';
import { SpecAgent } from './spec-agent';
import { CodeAgent } from './code-agent';
import { TestAgent } from './test-agent';
import { ReviewAgent } from './review-agent';
import { ChiefOfStaffAgent } from './chief-of-staff';

type AgentCtor = new () => BaseAgent;

class AgentRegistry {
  private ctors = new Map<string, AgentCtor>();
  private definitions = new Map<string, AgentDefinition>();

  register(agentType: string, ctor: AgentCtor, def: AgentDefinition) {
    this.ctors.set(agentType, ctor);
    this.definitions.set(agentType, def);
  }

  get(agentType: string): BaseAgent | undefined {
    const Ctor = this.ctors.get(agentType);
    return Ctor ? new Ctor() : undefined;
  }

  has(agentType: string): boolean {
    return this.ctors.has(agentType);
  }

  list(): AgentDefinition[] {
    return [...this.definitions.values()];
  }
}

export const agentRegistry = new AgentRegistry();

// Register all agents with their definitions
agentRegistry.register('spec-writer', SpecAgent, SpecAgent.definition);
agentRegistry.register('code-writer', CodeAgent, CodeAgent.definition);
agentRegistry.register('test-writer', TestAgent, TestAgent.definition);
agentRegistry.register('review', ReviewAgent, ReviewAgent.definition);
agentRegistry.register('chief-of-staff', ChiefOfStaffAgent, ChiefOfStaffAgent.definition);

// Backward-compatibility aliases for existing enqueue paths
// (task.service.ts currently hardcodes 'adapter-exec' as the default agentType)
agentRegistry.register('adapter-exec', CodeAgent, CodeAgent.definition);
agentRegistry.register('task-run', CodeAgent, CodeAgent.definition);
