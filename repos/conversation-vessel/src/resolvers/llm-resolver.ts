import { streamText, generateText } from 'ai';
import { providers, parseModel } from '../ai-provider';
import { resolveImpulse } from '../impulse/resolver';
import { executeTool, toolDefinitions } from '../tools';
import type { Message, ImpulseRef } from '../types';

export interface LLMResolverOptions {
  model: string;
  messages: Message[];
  impulses?: ImpulseRef[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ToolCall {
  toolName: string;
  params: Record<string, unknown>;
}

export interface ResolverContext {
  messages: Message[];
  impulses: ImpulseRef[];
  loadedImpulseData: Map<string, string>;
  executedTools: ToolCall[];
  reasoning: string[];
}

/**
 * Format impulses as context for the LLM
 */
export async function formatImpulsesForLLM(impulses: ImpulseRef[]): Promise<string> {
  if (!impulses || impulses.length === 0) {
    return '';
  }

  let context = '\n\n## Available Context (Impulses):\n';
  
  for (const impulse of impulses) {
    try {
      const resolved = await resolveImpulse(impulse);
      const preview = resolved.data.slice(0, 500);
      context += `\n### [${impulse.type.toUpperCase()}] ${impulse.id}\n`;
      context += `Priority: ${impulse.priority}\n`;
      context += `Budget: ${impulse.budget}\n`;
      if (impulse.metadata?.summary) {
        context += `Summary: ${impulse.metadata.summary}\n`;
      }
      context += `\`\`\`\n${preview}${resolved.data.length > 500 ? '\n... (truncated)' : ''}\n\`\`\`\n`;
    } catch (error) {
      context += `\n### [ERROR] ${impulse.id}\n`;
      context += `Failed to resolve: ${error instanceof Error ? error.message : String(error)}\n`;
    }
  }

  return context;
}

/**
 * Build system prompt with available tools
 */
export function buildSystemPrompt(basePrompt?: string): string {
  const toolInfo = Object.entries(toolDefinitions)
    .map(([name, def]) => `- ${name}: ${def.description}`)
    .join('\n');

  return `${basePrompt || 'You are a helpful assistant with access to tools.'}

## Available Tools:
${toolInfo}

When you need to execute a tool, provide your response in this format:
<tool_call>
<name>tool_name</name>
<params>{"param1": "value1", "param2": "value2"}</params>
</tool_call>

You can make multiple tool calls in sequence. Always explain your reasoning.`;
}

/**
 * Extract tool calls from LLM response
 */
export function extractToolCalls(response: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const toolRegex = /<tool_call>\s*<name>(\w+)<\/name>\s*<params>(.*?)<\/params>\s*<\/tool_call>/gs;
  
  let match;
  while ((match = toolRegex.exec(response)) !== null) {
    try {
      const toolName = match[1];
      const params = JSON.parse(match[2]);
      toolCalls.push({ toolName, params });
    } catch (error) {
      console.error('Failed to parse tool call:', error);
    }
  }

  return toolCalls;
}

/**
 * Execute tool calls and get results
 */
export async function executeToolCalls(toolCalls: ToolCall[]): Promise<string> {
  let results = '';

  for (const toolCall of toolCalls) {
    try {
      const result = await executeTool(toolCall.toolName as any, toolCall.params);
      results += `\n\n## Tool Result: ${toolCall.toolName}\n`;
      if (result.success) {
        results += `✓ Success\n${result.output}`;
      } else {
        results += `✗ Error: ${result.error}`;
      }
    } catch (error) {
      results += `\n\n## Tool Error: ${toolCall.toolName}\n`;
      results += `Failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return results;
}

/**
 * Resolve a request using LLM with tools and impulses
 */
export async function resolveLLM(options: LLMResolverOptions): Promise<string> {
  const {
    model,
    messages,
    impulses = [],
    temperature = 0.7,
    maxTokens = 2048,
    systemPrompt
  } = options;

  try {
    const { provider, model: modelName } = parseModel(model);
    const providerInstance = providers[provider];

    // Build system prompt with tool definitions
    const system = buildSystemPrompt(systemPrompt);

    // Format impulses as additional context
    const impulseContext = await formatImpulsesForLLM(impulses);

    // Build messages array with impulse context
    const finalMessages = [
      ...messages,
      ...(impulseContext ? [{
        role: 'system' as const,
        content: impulseContext
      }] : [])
    ];

    // Get initial response from LLM
    const response = await generateText({
      model: providerInstance(modelName),
      system,
      messages: finalMessages as any,
      temperature,
      maxTokens,
    });

    const initialResponse = response.text;
    let finalResponse = initialResponse;

    // Check for tool calls in the response
    const toolCalls = extractToolCalls(initialResponse);

    if (toolCalls.length > 0) {
      // Execute tools
      const toolResults = await executeToolCalls(toolCalls);

      // If tools were executed, get a follow-up response from the LLM
      const followUpMessages = [
        ...finalMessages,
        {
          role: 'assistant' as const,
          content: initialResponse
        },
        {
          role: 'user' as const,
          content: `Tool execution results:\n${toolResults}\n\nPlease provide your final response based on these results.`
        }
      ];

      const followUpResponse = await generateText({
        model: providerInstance(modelName),
        system,
        messages: followUpMessages as any,
        temperature,
        maxTokens,
      });

      finalResponse = followUpResponse.text;
    }

    return finalResponse;
  } catch (error) {
    throw new Error(`LLM resolution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stream LLM resolution with tool execution
 */
export async function streamResolveLLM(
  options: LLMResolverOptions,
  onChunk: (chunk: string) => void,
  onToolCall?: (toolCall: ToolCall) => void
): Promise<string> {
  const {
    model,
    messages,
    impulses = [],
    temperature = 0.7,
    maxTokens = 2048,
    systemPrompt
  } = options;

  try {
    const { provider, model: modelName } = parseModel(model);
    const providerInstance = providers[provider];

    // Build system prompt
    const system = buildSystemPrompt(systemPrompt);

    // Format impulses
    const impulseContext = await formatImpulsesForLLM(impulses);

    const finalMessages = [
      ...messages,
      ...(impulseContext ? [{
        role: 'system' as const,
        content: impulseContext
      }] : [])
    ];

    // Stream text response
    const response = await streamText({
      model: providerInstance(modelName),
      system,
      messages: finalMessages as any,
      temperature,
      maxTokens,
    });

    let fullResponse = '';

    for await (const chunk of response.textStream) {
      fullResponse += chunk;
      onChunk(chunk);
    }

    // Extract and execute tool calls
    const toolCalls = extractToolCalls(fullResponse);
    for (const toolCall of toolCalls) {
      if (onToolCall) {
        onToolCall(toolCall);
      }
    }

    if (toolCalls.length > 0) {
      const toolResults = await executeToolCalls(toolCalls);
      
      // Stream tool results
      onChunk('\n\n[Tool Results]\n');
      onChunk(toolResults);

      // Get follow-up response
      const followUpMessages = [
        ...finalMessages,
        { role: 'assistant' as const, content: fullResponse },
        { role: 'user' as const, content: `Tool execution results:\n${toolResults}\n\nProvide your final response.` }
      ];

      const followUp = await streamText({
        model: providerInstance(modelName),
        system,
        messages: followUpMessages as any,
        temperature,
        maxTokens,
      });

      let followUpResponse = '';
      for await (const chunk of followUp.textStream) {
        followUpResponse += chunk;
        onChunk(chunk);
      }

      return followUpResponse;
    }

    return fullResponse;
  } catch (error) {
    throw new Error(`LLM stream resolution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
