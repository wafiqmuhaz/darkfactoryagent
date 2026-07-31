import { MODEL_CATALOG, ModelCatalogEntry, AIProvider, AIMessage } from './model-registry';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GoogleProvider } from './providers/google.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { config } from '../config';

interface CompleteOptions {
  strategy?: 'cheapest' | 'fastest' | 'best' | 'specific';
  specificModelId?: string;
  requiredCapability?: string;
  allowMockFallback?: boolean;
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
  mock?: boolean;
}

class AiModelManager {
  private customModels: ModelCatalogEntry[] = [];
  private providers: Record<string, AIProvider> = {
    anthropic: new AnthropicProvider(),
    openai: new OpenAIProvider(),
    google: new GoogleProvider(),
    ollama: new OllamaProvider(),
  };

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

  hasProviderKey(providerName: string): boolean {
    const provider = this.providers[providerName];
    return provider ? provider.isAvailable() : false;
  }

  private selectModel(options: CompleteOptions): ModelCatalogEntry {
    const all = [...MODEL_CATALOG, ...this.customModels];

    if (options.strategy === 'specific' && options.specificModelId) {
      const m = all.find((e) => e.id === options.specificModelId);
      if (!m) throw new Error(`Unknown model: ${options.specificModelId}`);
      return m;
    }

    // Filter by required capability if specified
    let pool = options.requiredCapability
      ? all.filter((e) => e.capabilities.includes(options.requiredCapability!))
      : all;

    if (pool.length === 0) pool = all;

    // Prefer models whose provider currently has a key
    const avail = pool.filter((e) => this.providers[e.provider]?.isAvailable());
    const ranked = avail.length ? avail : pool;

    // Cost heuristic: sum of input + output token cost
    const cost = (e: ModelCatalogEntry) => e.costPerInputToken + e.costPerOutputToken;

    switch (options.strategy ?? 'cheapest') {
      case 'best':    // Premium models (highest cost)
        return [...ranked].sort((a, b) => cost(b) - cost(a))[0];
      case 'fastest': // Economy models (lowest cost as heuristic for speed)
        return [...ranked].sort((a, b) => cost(a) - cost(b))[0];
      case 'cheapest':
      default:
        return [...ranked].sort((a, b) => cost(a) - cost(b))[0];
    }
  }

  async complete(
    messages: AIMessage[],
    options: CompleteOptions,
    params?: CompletionParams
  ): Promise<CompletionResponse> {
    const entry = this.selectModel(options);
    const provider = this.providers[entry.provider];

    // Determine if mock fallback is allowed
    const globalAllow = process.env.ALLOW_MOCK_FALLBACK !== undefined
      ? process.env.ALLOW_MOCK_FALLBACK === 'true'
      : config.nodeEnv !== 'production'; // default: true in dev, false in prod

    const allowMock = options.allowMockFallback ?? globalAllow;

    if (!provider || !provider.isAvailable()) {
      if (!allowMock) {
        throw new Error(
          `No API key for provider '${entry.provider}' (model ${entry.id}); mock fallback disabled`
        );
      }
      return {
        content: `[Mock response for ${entry.id}]`,
        model: entry.id,
        provider: entry.provider,
        costUsd: 0,
        latencyMs: 0,
        tokens: { input: 0, output: 0 },
        mock: true,
      };
    }

    // Call the real provider
    const res = await provider.complete(messages, {
      model: entry.id,
      maxTokens: params?.maxTokens,
      temperature: params?.temperature,
    });

    return {
      content: res.content,
      model: res.model,
      provider: res.provider,
      costUsd: res.costUsd,
      latencyMs: res.latencyMs,
      tokens: { input: res.inputTokens, output: res.outputTokens },
      mock: false,
    };
  }
}

export const aiModelManager = new AiModelManager();
