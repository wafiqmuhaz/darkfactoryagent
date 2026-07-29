import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, AIMessage, AIRequestOptions, AIResponse } from '../model-registry';

export class GoogleProvider implements AIProvider {
  public readonly provider = 'google' as const;
  public readonly defaultModel = 'gemini-2.5-flash';

  private client: GoogleGenerativeAI | null = null;

  constructor() {
    if (process.env.GOOGLE_AI_API_KEY) {
      this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
  }

  public isAvailable(): boolean {
    return !!this.client;
  }

  public async complete(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    if (!this.client) throw new Error('Google provider not configured (missing GOOGLE_AI_API_KEY)');

    const modelId = options.model ?? this.defaultModel;
    const model = this.client.getGenerativeModel({
      model: modelId,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.5,
      }
    });

    const systemMsg = messages.find((m) => m.role === 'system');
    const history = messages
      .filter((m) => m.role !== 'system' && m.role !== 'user' || messages.indexOf(m) < messages.length - 1)
      .filter((m) => m.role !== 'system')
      .slice(0, -1) // exclude last message (it's the current prompt)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const lastMsg = messages.filter((m) => m.role === 'user').at(-1);
    if (!lastMsg) throw new Error('No user message found');

    const chat = model.startChat({
      history,
      systemInstruction: systemMsg?.content,
    });

    const start = Date.now();
    const result = await chat.sendMessage(lastMsg.content);
    const latencyMs = Date.now() - start;

    const responseText = result.response.text();
    const usageMeta = result.response.usageMetadata;

    const inputTokens = usageMeta?.promptTokenCount ?? 0;
    const outputTokens = usageMeta?.candidatesTokenCount ?? 0;

    return {
      content: responseText,
      model: modelId,
      provider: 'google',
      inputTokens,
      outputTokens,
      costUsd: inputTokens * 0.0000000375 + outputTokens * 0.00000015,
      latencyMs,
    };
  }
}
