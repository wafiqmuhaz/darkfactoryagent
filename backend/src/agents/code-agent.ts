import { BaseAgent, AgentDefinition } from './base-agent';

export class CodeAgent extends BaseAgent {
  protected name = 'CodeAgent';

  static definition: AgentDefinition = {
    agentType: 'code-writer',
    name: 'Code Writer',
    executionMode: 'adapter',
    description: 'Implements features by editing the working tree via adapter CLI',
    artifactType: 'code',
  };

  constructor() {
    super(CodeAgent.definition);
  }

  // Inherits runAdapter() from BaseAgent:
  //   1. Hard-requires an API key (refuses to run with mock data)
  //   2. Delegates to taskExecutionService.executeTask() — the proven
  //      adapter lifecycle (AgentRun, CostLedger, Artifact, status transitions)
}
