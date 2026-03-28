import { streamText } from 'ai';
import { providers, parseModel } from './ai-provider';
import type { Message } from './types';

export interface StreamOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

export interface StreamResponse {
  stream: ReadableStream<Uint8Array>;
}

/**
 * Stream chat completion using AI SDK streamText
 */
export async function streamResponse(options: StreamOptions): Promise<StreamResponse> {
  const { model, messages, temperature = 0.7, maxTokens = 1000 } = options;
  
  const { provider, model: modelName } = parseModel(model);
  const providerInstance = providers[provider];
  
  const aiMessages = messages.map(msg => ({ role: msg.role, content: msg.content }));
  
  const result = await streamText({
    model: providerInstance(modelName),
    messages: aiMessages,
    temperature,
    maxTokens,
  });
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          controller.enqueue(new TextEncoder().encode(delta));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
  
  return { stream };
}

/**
 * Convert stream to string for testing
 */
export async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  
  return result;
}