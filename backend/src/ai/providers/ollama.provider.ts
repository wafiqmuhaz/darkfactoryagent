import axios from 'axios';
import type { AIProvider, AIMessage, AIRequestOptions, AIResponse } from '../model-registry';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

export class OllamaProvider implements AIProvider {
  public readonly provider = 'ollama' as const;
  public readonly defaultModel = 'ollama/llama3.1';

  public isAvailable(): boolean {
    // Ollama is always "configured" — we just try and fail gracefully
    return true;
  }

  public async complete(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    const rawModel = (options.model ?? this.defaultModel).replace('ollama/', '');

    const start = Date.now();
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: rawModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        options: {
          num_predict: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.5,
        },
        stream: false,
      },
      { timeout: 120_000 }
    );

    const latencyMs = Date.now() - start;
    const content = response.data.message?.content ?? '';
    const inputTokens = response.data.prompt_eval_count ?? 0;
    const outputTokens = response.data.eval_count ?? 0;

    return {
      content,
      model: `ollama/${rawModel}`,
      provider: 'ollama',
      inputTokens,
      outputTokens,
      costUsd: 0, // local, no cost
      latencyMs,
    };
  }
}
