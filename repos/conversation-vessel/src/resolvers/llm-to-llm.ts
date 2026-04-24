import { resolveLLM, streamResolveLLM, type LLMResolverOptions } from './llm-resolver';
import type { Message } from '../types';

/**
 * Configuration for an LLM peer/service
 */
export interface LLMPeerConfig {
  id: string;
  name: string;
  url?: string;
  model: string;
  description?: string;
  capabilities?: string[];
}

/**
 * Request to forward to another LLM
 */
export interface LLMToLLMRequest {
  targetLLMId: string;
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  maskAsHuman?: boolean; // If true, response appears to be from a human
}

/**
 * Response from LLM-to-LLM communication
 */
export interface LLMToLLMResponse {
  success: boolean;
  content: string;
  sourceLLM: string;
  targetLLM: string;
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
    model?: string;
    maskedAsHuman?: boolean;
  };
  error?: string;
}

/**
 * Registry for managing connected LLM peers
 */
export class LLMPeerRegistry {
  private peers: Map<string, LLMPeerConfig> = new Map();
  private localId: string;

  constructor(localId: string = 'local-vessel') {
    this.localId = localId;
  }

  /**
   * Register a new LLM peer
   */
  registerPeer(config: LLMPeerConfig): void {
    this.peers.set(config.id, config);
  }

  /**
   * Unregister a peer
   */
  unregisterPeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  /**
   * Get a peer by ID
   */
  getPeer(peerId: string): LLMPeerConfig | undefined {
    return this.peers.get(peerId);
  }

  /**
   * List all registered peers
   */
  listPeers(): LLMPeerConfig[] {
    return Array.from(this.peers.values());
  }

  /**
   * Find peers by capability
   */
  findPeersByCapability(capability: string): LLMPeerConfig[] {
    return Array.from(this.peers.values()).filter(
      peer => peer.capabilities?.includes(capability)
    );
  }

  /**
   * Get registry status
   */
  getStatus(): {
    localId: string;
    peerCount: number;
    peers: LLMPeerConfig[];
  } {
    return {
      localId: this.localId,
      peerCount: this.peers.size,
      peers: this.listPeers()
    };
  }
}

/**
 * Mask LLM response to appear more human-like
 */
export function maskAsHumanResponse(llmResponse: string): string {
  let masked = llmResponse;

  // Remove AI-specific markers
  masked = masked.replace(/^(I'm|I am) (an AI|a language model|an assistant)[^.]*\.\s*/gi, '');
  masked = masked.replace(/I don't have the ability to/gi, "I can't");
  masked = masked.replace(/As an AI[^,]*,\s*/gi, '');
  masked = masked.replace(/I apologize, but/gi, 'Sorry, but');
  
  // Remove overly formal patterns
  masked = masked.replace(/Furthermore,/gi, 'Also,');
  masked = masked.replace(/Nevertheless,/gi, 'Still,');
  masked = masked.replace(/In conclusion,/gi, 'So,');

  // Add occasional human-like imperfections (very subtle)
  if (Math.random() < 0.1) {
    // Rarely, add a conversational filler
    const fillers = [" you know,", " like,", " I mean,"];
    const randomFiller = fillers[Math.floor(Math.random() * fillers.length)];
    const sentences = masked.split('. ');
    if (sentences.length > 1) {
      const randomIndex = Math.floor(Math.random() * (sentences.length - 1));
      sentences[randomIndex] += randomFiller;
      masked = sentences.join('. ');
    }
  }

  // Clean up multiple spaces
  masked = masked.replace(/\s+/g, ' ').trim();

  return masked;
}

/**
 * Format conversation context for LLM-to-LLM communication
 */
export function formatConversationContext(messages: Message[], targetLLMId: string): Message[] {
  // Add context about the conversation
  const contextMessage: Message = {
    role: 'system',
    content: `You are participating in a conversation with another AI system (${targetLLMId}). 
Respond naturally and conversationally. Be helpful and engage authentically with the other LLM.`
  };

  return [contextMessage, ...messages];
}

/**
 * LLM-to-LLM resolver for inter-vessel communication
 */
export class LLMToLLMResolver {
  private registry: LLMPeerRegistry;

  constructor(localId: string = 'local-vessel') {
    this.registry = new LLMPeerRegistry(localId);
  }

  /**
   * Resolve a request to another LLM
   */
  async resolve(request: LLMToLLMRequest): Promise<LLMToLLMResponse> {
    const startTime = Date.now();

    try {
      const targetPeer = this.registry.getPeer(request.targetLLMId);
      
      if (!targetPeer) {
        return {
          success: false,
          content: '',
          sourceLLM: this.registry.getStatus().localId,
          targetLLM: request.targetLLMId,
          error: `Target LLM peer not found: ${request.targetLLMId}`
        };
      }

      // Format messages with context
      const contextMessages = formatConversationContext(
        request.messages,
        request.targetLLMId
      );

      // Prepare LLM resolver options
      const llmOptions: LLMResolverOptions = {
        model: request.model || targetPeer.model,
        messages: contextMessages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        systemPrompt: request.systemPrompt
      };

      // Call the target LLM
      let response = await resolveLLM(llmOptions);

      // Mask response as human if requested
      if (request.maskAsHuman) {
        response = maskAsHumanResponse(response);
      }

      return {
        success: true,
        content: response,
        sourceLLM: this.registry.getStatus().localId,
        targetLLM: request.targetLLMId,
        metadata: {
          executionTime: Date.now() - startTime,
          model: llmOptions.model,
          maskedAsHuman: request.maskAsHuman
        }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        sourceLLM: this.registry.getStatus().localId,
        targetLLM: request.targetLLMId,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Stream resolution to another LLM
   */
  async streamResolve(
    request: LLMToLLMRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMToLLMResponse> {
    const startTime = Date.now();

    try {
      const targetPeer = this.registry.getPeer(request.targetLLMId);
      
      if (!targetPeer) {
        return {
          success: false,
          content: '',
          sourceLLM: this.registry.getStatus().localId,
          targetLLM: request.targetLLMId,
          error: `Target LLM peer not found: ${request.targetLLMId}`
        };
      }

      const contextMessages = formatConversationContext(
        request.messages,
        request.targetLLMId
      );

      const llmOptions: LLMResolverOptions = {
        model: request.model || targetPeer.model,
        messages: contextMessages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        systemPrompt: request.systemPrompt
      };

      let fullResponse = '';
      const chunkHandler = (chunk: string) => {
        fullResponse += chunk;
        onChunk(chunk);
      };

      await streamResolveLLM(llmOptions, chunkHandler);

      // Mask response if requested
      if (request.maskAsHuman) {
        fullResponse = maskAsHumanResponse(fullResponse);
      }

      return {
        success: true,
        content: fullResponse,
        sourceLLM: this.registry.getStatus().localId,
        targetLLM: request.targetLLMId,
        metadata: {
          executionTime: Date.now() - startTime,
          model: llmOptions.model,
          maskedAsHuman: request.maskAsHuman
        }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        sourceLLM: this.registry.getStatus().localId,
        targetLLM: request.targetLLMId,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Batch resolve requests to multiple LLMs
   */
  async resolveBatch(requests: LLMToLLMRequest[]): Promise<LLMToLLMResponse[]> {
    return Promise.all(requests.map(req => this.resolve(req)));
  }

  /**
   * Get the peer registry
   */
  getRegistry(): LLMPeerRegistry {
    return this.registry;
  }

  /**
   * Register a peer
   */
  registerPeer(config: LLMPeerConfig): void {
    this.registry.registerPeer(config);
  }

  /**
   * Get resolver status
   */
  getStatus() {
    return {
      type: 'llm-to-llm',
      available: true,
      registry: this.registry.getStatus()
    };
  }
}

// Default singleton instance
export const defaultLLMToLLMResolver = new LLMToLLMResolver();
