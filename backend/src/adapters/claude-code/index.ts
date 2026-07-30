import { BaseAdapter, AdapterTask, shellQuote } from '../base-adapter';

/**
 * Claude Code CLI harness.
 *
 * `claude -p <prompt>` prints the reply to stdout and exits, which is what both
 * the probe and task execution rely on.
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  protected name = 'claude-code';
  protected displayName = 'Claude Code';
  protected command = 'claude';
  protected installHint = 'Install with: npm i -g @anthropic-ai/claude-code';

  protected buildPromptArgs(task: AdapterTask): string[] {
    const args = ['-p', shellQuote(task.prompt)];

    if (task.systemPrompt) {
      args.push('--append-system-prompt', shellQuote(task.systemPrompt));
    }
    if (task.model && task.model !== 'auto') {
      args.push('--model', shellQuote(task.model));
    }
    if (task.allowWrites) {
      // Task execution expects the agent to edit files in the project it was
      // pointed at; without this the CLI stops at its permission prompt.
      args.push('--permission-mode', 'acceptEdits');
      if (task.cwd) {
        args.push('--add-dir', shellQuote(task.cwd));
      }
    }
    return args;
  }

  protected estimateCost(inputTokens: number, outputTokens: number): number {
    // Sonnet-class pricing: $3/M input, $15/M output.
    return inputTokens * 0.000003 + outputTokens * 0.000015;
  }

  async getModels(): Promise<string[]> {
    return ['auto', 'opus', 'sonnet', 'haiku'];
  }
}

export const claudeCodeAdapter = new ClaudeCodeAdapter();
