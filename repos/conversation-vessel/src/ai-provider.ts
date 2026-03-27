import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { Message } from './types';

// Provider registry mapping provider names to their SDK instances
export const providers = {
  anthropic,
  openai,
} as const;

export type ProviderName = keyof typeof providers;

// Parse model string into provider and model parts
export function parseModel(modelString: string): { provider: ProviderName; model: string } {
  const parts = modelString.split('/');
  
  if (parts.length !== 2) {
    throw new Error(`Invalid model format: ${modelString}. Expected format: provider/model`);
  }
  
  const providerName = parts[0];
  const modelName = parts[1];
  
  if (!providerName || !modelName) {
    throw new Error(`Invalid model format: ${modelString}. Expected format: provider/model`);
  }
  
  if (!providers[providerName as ProviderName]) {
    throw new Error(`Unsupported provider: ${providerName}. Supported providers: ${Object.keys(providers).join(', ')}`);
  }
  
  return {
    provider: providerName as ProviderName,
    model: modelName
  };
}

export interface GenerateOptions {
  model: string;
  messages: Message[];
  maxTokens?: number;
}

export async function generateResponse(options: GenerateOptions) {
  const { model, messages, maxTokens = 4096 } = options;
  const { provider, model: modelName } = parseModel(model);
  const providerInstance = providers[provider];

  const aiMessages = messages.map(msg => ({ role: msg.role, content: msg.content }));

  return generateText({
    model: providerInstance(modelName),
    messages: aiMessages,
    maxTokens,
  });
}