import { BaseAdapter, ProbeResult, AdapterTask, ExecutionResult } from '../base-adapter';
import { execSync } from 'child_process';
import { logger } from '../../utils/logger';

export class CodexAdapter extends BaseAdapter {
  protected name = 'codex';
  protected displayName = 'Codex CLI';
  private command = 'codex';

  async probe(): Promise<ProbeResult> {
    try {
      const whichResult = execSync(`which ${this.command}`, { encoding: 'utf8', timeout: 5000 }).trim();
      logger.info(`[Codex] Found CLI at: ${whichResult}`);

      let version = '';
      try {
        version = execSync(`${this.command} --version`, { encoding: 'utf8', timeout: 5000 }).trim();
      } catch {
        version = 'unknown';
      }
      logger.info(`[Codex] Version: ${version}`);

      // Basic functionality check
      try {
        execSync(`echo "hello" | ${this.command} --help 2>/dev/null || echo "probe-ok"`, {
          encoding: 'utf8',
          timeout: 15000,
        });
      } catch {
        // Even if help fails, if which found it, mark as ready
      }

      return {
        status: 'ready',
        version: version || 'unknown',
        path: whichResult,
        message: `Codex CLI ${version ? `v${version}` : ''} ready`,
        models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
      };
    } catch (error: any) {
      logger.error(`[Codex] Probe failed: ${error.message}`);
      return {
        status: 'error',
        version: null,
        path: null,
        message: `Codex CLI not found. Install with: npm i -g @openai/codex or visit https://github.com/openai/codex`,
        error: error.message,
      };
    }
  }

  async execute(task: AdapterTask): Promise<ExecutionResult> {
    const startTime = Date.now();
    try {
      const escapedPrompt = task.prompt.replace(/"/g, '\\"');
      const result = execSync(`echo "${escapedPrompt}" | ${this.command} --print - 2>/dev/null`, {
        encoding: 'utf8',
        timeout: task.timeout ?? 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      const duration = (Date.now() - startTime) / 1000;
      const estimatedInputTokens = Math.ceil((task.systemPrompt?.length ?? 0 + task.prompt.length) / 4);
      const estimatedOutputTokens = Math.ceil(result.length / 4);

      return {
        success: true,
        output: result.trim(),
        tokenUsage: { input: estimatedInputTokens, output: estimatedOutputTokens },
        cost: (estimatedInputTokens * 0.0000025) + (estimatedOutputTokens * 0.00001), // GPT-4o pricing estimate
      };
    } catch (error: any) {
      logger.error(`[Codex] Execution failed: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
      };
    }
  }

  async getModels(): Promise<string[]> {
    return ['gpt-4o', 'gpt-4o-mini', 'o3-mini'];
  }
}

export const codexAdapter = new CodexAdapter();
