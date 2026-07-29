export interface AIProvider {
  readonly provider: string;
  readonly defaultModel: string;
  isAvailable(): boolean;
  complete(messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse>;
}

export interface AIMessage {
  role: string;
  content: string;
}

export interface AIRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
}

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface ModelCatalogEntry {
  id: string;
  provider: string;
  displayName: string;
  tier: 'economy' | 'balanced' | 'premium';
  capabilities: string[];
  contextWindow: number;
  costPerInputToken: number;
  costPerOutputToken: number;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    tier: 'premium',
    capabilities: ['general', 'code', 'reasoning'],
    contextWindow: 128000,
    costPerInputToken: 0.0000025,
    costPerOutputToken: 0.00001,
  },
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    tier: 'balanced',
    capabilities: ['general', 'code', 'reasoning', 'planning'],
    contextWindow: 200000,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    displayName: 'Gemini 2.5 Flash',
    tier: 'economy',
    capabilities: ['general', 'code', 'multimodal'],
    contextWindow: 1048576,
    costPerInputToken: 0.00000015,
    costPerOutputToken: 0.0000006,
  },
];
