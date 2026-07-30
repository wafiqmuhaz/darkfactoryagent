import { BaseAdapter, ProbeResult, AdapterTask, ExecutionResult } from './base-adapter';
import { claudeCodeAdapter } from './claude-code';
import { codexAdapter } from './codex';

// Additional adapters can be imported here
// import { geminiAdapter } from './gemini';
// import { hermesAdapter } from './hermes';
// import { ollamaAdapter } from './ollama';

type AdapterEntry = {
  id: string;
  name: string;
  description: string;
  type: string;
  adapter: BaseAdapter;
};

class AdapterManager {
  private adapters: Map<string, AdapterEntry> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register({
      id: 'claude-code',
      name: 'Claude Code CLI',
      description: 'Anthropic Claude Code CLI — local agent execution with Claude models',
      type: 'cli',
      adapter: claudeCodeAdapter,
    });
    this.register({
      id: 'codex',
      name: 'Codex CLI',
      description: 'OpenAI Codex CLI — code generation and execution with GPT models',
      type: 'cli',
      adapter: codexAdapter,
    });
    // Future adapters
    // this.register({ id: 'gemini', name: 'Gemini CLI', description: 'Google Gemini CLI', type: 'cli', adapter: geminiAdapter });
    // this.register({ id: 'ollama', name: 'Ollama (Local)', description: 'Local LLM via Ollama', type: 'api', adapter: ollamaAdapter });
    // this.register({ id: 'hermes', name: 'Hermes', description: 'Hermes CLI', type: 'cli', adapter: hermesAdapter });
  }

  register(entry: AdapterEntry) {
    this.adapters.set(entry.id, entry);
  }

  getAdapter(id: string): BaseAdapter | undefined {
    return this.adapters.get(id)?.adapter;
  }

  listAdapters(): Omit<AdapterEntry, 'adapter'>[] {
    return Array.from(this.adapters.values()).map(({ adapter, ...rest }) => ({
      ...rest,
    }));
  }

  async probeAdapter(id: string): Promise<ProbeResult> {
    const adapter = this.adapters.get(id)?.adapter;
    if (!adapter) {
      return {
        status: 'error',
        version: null,
        path: null,
        message: `Adapter '${id}' not found`,
        error: `Unknown adapter: ${id}`,
      };
    }
    try {
      const result = await adapter.probe();
      return result;
    } catch (error: any) {
      return {
        status: 'error',
        version: null,
        path: null,
        message: `Probe failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  async executeAdapter(id: string, task: AdapterTask): Promise<ExecutionResult> {
    const adapter = this.adapters.get(id)?.adapter;
    if (!adapter) {
      return {
        success: false,
        output: '',
        error: `Adapter '${id}' not found`,
      };
    }
    return adapter.execute(task);
  }
}

export const adapterManager = new AdapterManager();
