import { MODEL_CATALOG, ModelCatalogEntry } from './model-registry';

interface CompleteOptions {
  strategy?: 'cheapest' | 'fastest' | 'best' | 'specific';
  specificModelId?: string;
  requiredCapability?: string;
}

interface CompletionParams {
  maxTokens?: number;
  temperature?: number;
}

interface CompletionResponse {
  content: string;
  model: string;
  provider: string;
  costUsd: number;
  latencyMs: number;
  tokens: { input: number; output: number };
}

class AiModelManager {
  private customModels: ModelCatalogEntry[] = [];

  getAvailableProviders(): string[] {
    const providers = new Set<string>();
    MODEL_CATALOG.forEach((m) => providers.add(m.provider));
    this.customModels.forEach((m) => providers.add(m.provider));
    return Array.from(providers);
  }

  getLifecycleStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    MODEL_CATALOG.forEach((m) => { status[m.id] = 'active'; });
    return status;
  }

  getModelReport(): Record<string, any> {
    return {
      totalModels: MODEL_CATALOG.length + this.customModels.length,
      byTier: { economy: 1, balanced: 1, premium: 1 },
    };
  }

  deprecateModel(modelId: string, note?: string): void {
    const idx = MODEL_CATALOG.findIndex((m) => m.id === modelId);
    if (idx === -1) throw new Error(`Model ${modelId} not found`);
    // In a real system this would mark as deprecated
  }

  registerCustomModel(model: ModelCatalogEntry): void {
    this.customModels.push(model);
  }

  async complete(
    messages: { role: string; content: string }[],
    options: CompleteOptions,
    params?: CompletionParams
  ): Promise<CompletionResponse> {
    // Stub: returns a mock response
    const model = options.specificModelId || 'claude-sonnet-4-20250514';
    return {
      content: `[Mock response for ${model}]`,
      model,
      provider: 'anthropic',
      costUsd: 0.0001,
      latencyMs: 500,
      tokens: { input: 100, output: 50 },
    };
  }
}

export const aiModelManager = new AiModelManager();
