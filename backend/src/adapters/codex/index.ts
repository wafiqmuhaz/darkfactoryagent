import { BaseAdapter, AdapterTask, shellQuote, OUTPUT_FILE_TOKEN } from '../base-adapter';

/**
 * Codex CLI harness.
 *
 * `codex exec` streams progress logs to stdout, so the final answer is written to
 * a file via `-o` and read back by the base class. Sandboxing is left to the CLI's
 * own workspace-write policy so edits stay inside the project directory.
 */
export class CodexAdapter extends BaseAdapter {
  protected name = 'codex';
  protected displayName = 'Codex';
  protected command = 'codex';
  protected installHint = 'Install with: npm i -g @openai/codex';

  protected buildPromptArgs(task: AdapterTask): string[] {
    const args = [
      'exec',
      // Read-only for probes; workspace-write when the task is meant to edit code.
      '--sandbox', task.allowWrites ? 'workspace-write' : 'read-only',
      '--skip-git-repo-check',
      '--color', 'never',
      '-o', OUTPUT_FILE_TOKEN,
    ];

    if (task.model && task.model !== 'auto') {
      args.push('--model', shellQuote(task.model));
    }
    if (task.cwd) {
      args.push('--cd', shellQuote(task.cwd));
    }

    // Prompt last so it is unambiguously the positional argument.
    args.push(shellQuote(task.systemPrompt ? `${task.systemPrompt}\n\n${task.prompt}` : task.prompt));
    return args;
  }

  protected estimateCost(inputTokens: number, outputTokens: number): number {
    // GPT-5-class pricing: $1.25/M input, $10/M output.
    return inputTokens * 0.00000125 + outputTokens * 0.00001;
  }

  async getModels(): Promise<string[]> {
    return ['auto', 'gpt-5.5', 'gpt-5-codex', 'gpt-5', 'o4-mini'];
  }
}

export const codexAdapter = new CodexAdapter();
