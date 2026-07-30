import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export interface ProbeResult {
  status: 'ready' | 'error' | 'not_tested';
  version: string | null;
  path: string | null;
  message: string;
  error?: string;
  models?: string[];
}

export interface AdapterTask {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  tokenUsage?: { input: number; output: number };
  cost?: number;
  error?: string;
}

export abstract class BaseAdapter {
  protected abstract name: string;
  protected abstract displayName: string;

  async probe(): Promise<ProbeResult> {
    return {
      status: 'not_tested',
      version: null,
      path: null,
      message: `${this.displayName} probe not implemented`,
    };
  }

  abstract execute(task: AdapterTask): Promise<ExecutionResult>;

  async getModels(): Promise<string[]> {
    return [];
  }

  protected execCli(command: string, args: string[], options?: { timeout?: number; input?: string }): string {
    const cmd = `${command} ${args.join(' ')}`;
    logger.debug(`[${this.name}] Executing: ${cmd}`);
    try {
      const result = execSync(cmd, {
        encoding: 'utf8',
        timeout: options?.timeout ?? 60000,
        input: options?.input,
      });
      return result;
    } catch (error: any) {
      logger.error(`[${this.name}] CLI execution failed: ${error.message}`);
      throw error;
    }
  }

  get nameId(): string {
    return this.name;
  }

  get displayNameId(): string {
    return this.displayName;
  }
}
