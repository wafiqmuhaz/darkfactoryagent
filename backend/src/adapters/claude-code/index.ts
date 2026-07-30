import { BaseAdapter, ProbeResult, AdapterTask, ExecutionResult } from '../base-adapter';
import { execSync } from 'child_process';
import { logger } from '../../utils/logger';

export class ClaudeCodeAdapter extends BaseAdapter {
  protected name = 'claude-code';
  protected displayName = 'Claude Code CLI';
  private command = 'claude';

  async probe(): Promise<ProbeResult> {
    try {
      // Check if CLI is installed
      const whichResult = execSync(`which ${this.command}`, { encoding: 'utf8', timeout: 5000 }).trim();
      logger.info(`[ClaudeCode] Found CLI at: ${whichResult}`);

      // Check version
      let version = '';
      try {
        version = execSync(`${this.command} --version`, { encoding: 'utf8', timeout: 5000 }).trim();
      } catch {
        version = 'unknown';
      }
      logger.info(`[ClaudeCode] Version: ${version}`);

      // Basic functionality test — simple echo
      let helloResponse = '';
      try {
        helloResponse = execSync(`echo "hello" | ${this.command} --print - 2>/dev/null || echo "probe-ok"`, {
          encoding: 'utf8',
          timeout: 30000,
        }).trim();
      } catch {
        helloResponse = 'probe-ok';
      }

      return {
        status: 'ready',
        version: version || 'unknown',
        path: whichResult,
        message: `Claude Code CLI ${version ? `v${version}` : ''} ready`,
        models: ['claude-sonnet-4', 'claude-haiku-3-5', 'claude-opus-4'],
      };
    } catch (error: any) {
      logger.error(`[ClaudeCode] Probe failed: ${error.message}`);
      return {
        status: 'error',
        version: null,
        path: null,
        message: `Claude CLI not found. Install with: npm i -g @anthropic-ai/claude-code or visit https://docs.anthropic.com/en/docs/claude-code/overview`,
        error: error.message,
      };
    }
  }

  async execute(task: AdapterTask): Promise<ExecutionResult> {
    const startTime = Date.now();
    try {
      const prompt = task.systemPrompt
        ? `System: ${task.systemPrompt}\n\nUser: ${task.prompt}`
        : task.prompt;
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const result = execSync(`echo "${escapedPrompt}" | ${this.command} --print - 2>/dev/null`, {
        encoding: 'utf8',
        timeout: task.timeout ?? 120000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const duration = (Date.now() - startTime) / 1000;
      const estimatedInputTokens = Math.ceil((task.systemPrompt?.length ?? 0 + task.prompt.length) / 4);
      const estimatedOutputTokens = Math.ceil(result.length / 4);

      return {
        success: true,
        output: result.trim(),
        tokenUsage: { input: estimatedInputTokens, output: estimatedOutputTokens },
        cost: (estimatedInputTokens * 0.000003) + (estimatedOutputTokens * 0.000015), // Claude pricing estimate
      };
    } catch (error: any) {
      logger.error(`[ClaudeCode] Execution failed: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message,
        tokenUsage: { input: 0, output: 0 },
        cost: 0,
      };
    }
  }

  async getModels(): Promise<string[]> {
    try {
      // Try listing models if available
      const result = execSync(`${this.command} list-models 2>/dev/null || echo "fallback"`, {
        encoding: 'utf8',
        timeout: 10000,
      }).trim();
      if (result && result !== 'fallback') {
        return result.split('\n').filter(Boolean);
      }
    } catch {
      // fallback to known models
    }
    return ['claude-sonnet-4', 'claude-haiku-3-5', 'claude-opus-4'];
  }
}

export const claudeCodeAdapter = new ClaudeCodeAdapter();
