import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIMessage, AIRequestOptions, AIResponse } from '../model-registry';

export class AnthropicProvider implements AIProvider {
  public readonly provider = 'anthropic' as const;
  public readonly defaultModel = 'claude-sonnet-4-20250514';

  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  public isAvailable(): boolean {
    return !!this.client;
  }

  public async complete(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    if (!this.client) throw new Error('Anthropic provider not configured (missing ANTHROPIC_API_KEY)');

    const model = options.model ?? this.defaultModel;
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsgs = messages.filter((m) => m.role !== 'system');

    const start = Date.now();
    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.5,
      system: systemMsg?.content,
      messages: userMsgs.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    const latencyMs = Date.now() - start;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      content,
      model,
      provider: 'anthropic',
      inputTokens,
      outputTokens,
      costUsd: inputTokens * 0.000003 + outputTokens * 0.000015,
      latencyMs,
    };
  }
}
