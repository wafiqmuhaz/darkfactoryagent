import OpenAI from 'openai';
import type { AIProvider, AIMessage, AIRequestOptions, AIResponse } from '../model-registry';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class OpenAIProvider implements AIProvider {
  public readonly provider = 'openai' as const;
  public readonly defaultModel = 'gpt-4o-mini';

  private client: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  public isAvailable(): boolean {
    return !!this.client;
  }

  public async complete(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    if (!this.client) throw new Error('OpenAI provider not configured (missing OPENAI_API_KEY)');

    const model = options.model ?? this.defaultModel;
    const start = Date.now();

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.5,
      messages: messages.map((m) => ({ role: m.role, content: m.content } as ChatCompletionMessageParam)),
    });

    const latencyMs = Date.now() - start;
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    return {
      content: response.choices[0].message.content ?? '',
      model,
      provider: 'openai',
      inputTokens,
      outputTokens,
      costUsd: inputTokens * 0.00000015 + outputTokens * 0.0000006,
      latencyMs,
    };
  }
}
