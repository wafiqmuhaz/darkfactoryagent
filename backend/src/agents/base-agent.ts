import { logger } from '../utils/logger';

export interface AgentContext {
  projectId: string;
  taskId: string;
  agentRunId: string;
}

export abstract class BaseAgent {
  protected abstract name: string;
  
  public async execute(context: AgentContext, input: any): Promise<any> {
    try {
      this.log('info', `Starting execution for task ${context.taskId}`);
      
      const isValid = await this.validate(input);
      if (!isValid) {
        throw new Error(`Validation failed for ${this.name}`);
      }

      const result = await this.run(context, input);
      
      this.log('info', `Successfully completed task ${context.taskId}`);
      return result;
    } catch (error: any) {
      this.log('error', `Execution failed: ${error.message}`);
      throw error;
    }
  }

  protected abstract run(context: AgentContext, input: any): Promise<any>;
  
  protected async validate(input: any): Promise<boolean> {
    // Default validation, override in subclasses
    return true;
  }

  protected log(level: 'info' | 'error' | 'warn' | 'debug', message: string) {
    logger.log(level, `[${this.name}] ${message}`);
  }
}
