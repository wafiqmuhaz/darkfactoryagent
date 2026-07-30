import { BaseAdapter, ProbeResult, AdapterTask, ExecutionResult } from './base-adapter';
import { claudeCodeAdapter } from './claude-code';
import { codexAdapter } from './codex';

export interface AdapterDescriptor {
  id: string;
  name: string;
  description: string;
  type: string;
  /** Shown as a "Recommended" chip in the adapter picker. */
  recommended: boolean;
  installHint: string;
}

type AdapterEntry = AdapterDescriptor & { adapter: BaseAdapter };

class AdapterManager {
  private adapters = new Map<string, AdapterEntry>();

  constructor() {
    this.register({
      id: 'claude-code',
      name: 'Claude Code',
      description: 'Claude Code CLI harness',
      type: 'cli',
      recommended: true,
      installHint: 'npm i -g @anthropic-ai/claude-code',
      adapter: claudeCodeAdapter,
    });
    this.register({
      id: 'codex',
      name: 'Codex',
      description: 'Codex CLI harness',
      type: 'cli',
      recommended: true,
      installHint: 'npm i -g @openai/codex',
      adapter: codexAdapter,
    });
  }

  register(entry: AdapterEntry) {
    this.adapters.set(entry.id, entry);
  }

  getAdapter(id: string): BaseAdapter | undefined {
    return this.adapters.get(id)?.adapter;
  }

  listAdapters(): AdapterDescriptor[] {
    return Array.from(this.adapters.values()).map(({ adapter: _adapter, ...rest }) => rest);
  }

  async getModels(id: string): Promise<string[]> {
    const adapter = this.adapters.get(id)?.adapter;
    if (!adapter) return [];
    return adapter.getModels();
  }

  async probeAdapter(id: string): Promise<ProbeResult> {
    const adapter = this.adapters.get(id)?.adapter;
    if (!adapter) {
      return {
        status: 'error',
        version: null,
        path: null,
        runtime: 'none',
        message: `Unknown adapter '${id}'.`,
        error: `Unknown adapter: ${id}`,
      };
    }
    return adapter.probe();
  }

  async executeAdapter(id: string, task: AdapterTask): Promise<ExecutionResult> {
    const adapter = this.adapters.get(id)?.adapter;
    if (!adapter) {
      return { success: false, output: '', error: `Unknown adapter '${id}'.` };
    }
    return adapter.execute(task);
  }

  /**
   * Execute on `preferredId`, falling back through the remaining adapters when it
   * fails. Returns which adapter actually ran.
   */
  async executeWithFallback(
    preferredId: string,
    task: AdapterTask
  ): Promise<ExecutionResult & { adapterUsed: string; fellBack: boolean }> {
    const order = [preferredId, ...Array.from(this.adapters.keys()).filter((id) => id !== preferredId)];
    const failures: string[] = [];

    for (const id of order) {
      const adapter = this.adapters.get(id)?.adapter;
      if (!adapter) continue;

      const result = await adapter.execute(task);
      if (result.success) {
        return { ...result, adapterUsed: id, fellBack: id !== preferredId };
      }
      failures.push(`${id}: ${result.error ?? 'unknown error'}`);
    }

    // Attribute each failure. Reporting only the last adapter's error hides why
    // the one the user actually chose did not work.
    return {
      success: false,
      output: '',
      error: failures.length
        ? failures.join(' | ')
        : `No adapter available for '${preferredId}'.`,
      adapterUsed: preferredId,
      fellBack: false,
    };
  }
}

export const adapterManager = new AdapterManager();
