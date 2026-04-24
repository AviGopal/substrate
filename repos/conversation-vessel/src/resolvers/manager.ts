import type { ImpulseRef } from '../types';
import { resolveImpulse } from '../impulse/resolver';
import type { ToolResult } from '../tools';
import { executeTool } from '../tools';

export type ResolverType = 'impulse' | 'tool' | 'llm';

export interface ResolverOptions {
  type: ResolverType;
  impulseId?: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  llmRequest?: {
    model: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ResolverResult {
  type: ResolverType;
  success: boolean;
  data?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  executionTime?: number;
}

/**
 * Resolver manager for handling different resolution types
 */
export class ResolverManager {
  /**
   * Resolve an impulse reference
   */
  async resolveImpulse(impulseRef: ImpulseRef): Promise<ResolverResult> {
    const startTime = Date.now();
    
    try {
      const resolved = await resolveImpulse(impulseRef);
      
      return {
        type: 'impulse',
        success: true,
        data: resolved.data,
        metadata: {
          id: resolved.id,
          type: resolved.type,
          ...resolved.metadata
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        type: 'impulse',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a tool
   */
  async resolveTool(toolName: string, toolParams: Record<string, unknown>): Promise<ResolverResult> {
    const startTime = Date.now();
    
    try {
      const result = await executeTool(toolName as any, toolParams);
      
      return {
        type: 'tool',
        success: result.success,
        data: result.output,
        error: result.error,
        metadata: {
          toolName,
          params: toolParams
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        type: 'tool',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generic resolver that routes based on type
   */
  async resolve(options: ResolverOptions): Promise<ResolverResult> {
    switch (options.type) {
      case 'impulse': {
        if (!options.impulseId) {
          return {
            type: 'impulse',
            success: false,
            error: 'impulseId is required for impulse resolution'
          };
        }

        // Create minimal impulse ref from ID
        const impulseRef: ImpulseRef = {
          id: options.impulseId,
          type: 'custom',
          content: options.impulseId,
          priority: 'medium',
          budget: 1000
        };

        return this.resolveImpulse(impulseRef);
      }

      case 'tool': {
        if (!options.toolName) {
          return {
            type: 'tool',
            success: false,
            error: 'toolName is required for tool resolution'
          };
        }

        return this.resolveTool(options.toolName, options.toolParams || {});
      }

      case 'llm': {
        // LLM resolution would be handled by a separate LLM resolver instance
        return {
          type: 'llm',
          success: false,
          error: 'LLM resolution requires separate handler'
        };
      }

      default:
        return {
          type: 'impulse',
          success: false,
          error: `Unknown resolver type: ${(options as any).type}`
        };
    }
  }

  /**
   * Batch resolve multiple items
   */
  async resolveBatch(options: ResolverOptions[]): Promise<ResolverResult[]> {
    return Promise.all(options.map(opt => this.resolve(opt)));
  }

  /**
   * Get resolver status and capabilities
   */
  getStatus(): {
    available: boolean;
    capabilities: ResolverType[];
    version: string;
  } {
    return {
      available: true,
      capabilities: ['impulse', 'tool', 'llm'],
      version: '1.0.0'
    };
  }
}

// Default singleton instance
export const defaultResolverManager = new ResolverManager();
