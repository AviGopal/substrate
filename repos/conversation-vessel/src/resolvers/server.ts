import { resolveLLM, streamResolveLLM, type LLMResolverOptions } from './llm-resolver';
import { defaultResolverManager, type ResolverOptions } from './manager';
import { defaultLLMToLLMResolver, type LLMToLLMRequest } from './llm-to-llm';
import type { ImpulseRef, Message } from '../types';

export interface ResolverServerOptions {
  port: number;
  baseUrl?: string;
}

export interface ResolverRequest {
  type: 'impulse' | 'tool' | 'llm';
  payload: unknown;
}

export interface ResolverResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

/**
 * Create a resolver HTTP server
 */
export function createResolverServer(options: ResolverServerOptions) {
  const { port, baseUrl = '/resolve' } = options;

  // Handler for impulse resolution
  const handleImpulseResolve = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json() as { impulseRef: ImpulseRef };
      const result = await defaultResolverManager.resolveImpulse(body.impulseRef);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };

  // Handler for tool resolution
  const handleToolResolve = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json() as { toolName: string; toolParams: Record<string, unknown> };
      const result = await defaultResolverManager.resolveTool(body.toolName, body.toolParams);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };

  // Handler for LLM resolution
  const handleLLMResolve = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json() as {
        model: string;
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
        impulses?: ImpulseRef[];
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
        stream?: boolean;
      };

      const options: LLMResolverOptions = {
        model: body.model,
        messages: body.messages,
        impulses: body.impulses,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        systemPrompt: body.systemPrompt
      };

      if (body.stream) {
        // Return streaming response
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              const onChunk = (chunk: string) => {
                controller.enqueue(encoder.encode(chunk));
              };

              await streamResolveLLM(options, onChunk);
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          }
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } else {
        // Regular response
        const startTime = Date.now();
        const result = await resolveLLM(options);

        return new Response(
          JSON.stringify({
            success: true,
            data: result,
            executionTime: Date.now() - startTime
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };

  // Handler for LLM-to-LLM resolution
  const handleLLMToLLMResolve = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json() as {
        targetLLMId: string;
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
        model?: string;
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
        stream?: boolean;
        maskAsHuman?: boolean;
      };

      const request: LLMToLLMRequest = {
        targetLLMId: body.targetLLMId,
        messages: body.messages,
        model: body.model,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        systemPrompt: body.systemPrompt,
        stream: body.stream,
        maskAsHuman: body.maskAsHuman
      };

      if (body.stream) {
        // Return streaming response
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              const onChunk = (chunk: string) => {
                controller.enqueue(encoder.encode(chunk));
              };

              await defaultLLMToLLMResolver.streamResolve(request, onChunk);
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          }
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } else {
        // Regular response
        const startTime = Date.now();
        const result = await defaultLLMToLLMResolver.resolve(request);

        return new Response(
          JSON.stringify({
            success: result.success,
            data: result.content,
            sourceLLM: result.sourceLLM,
            targetLLM: result.targetLLM,
            metadata: {
              ...result.metadata,
              executionTime: Date.now() - startTime
            },
            error: result.error
          }),
          {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };

  // Handler for peer registry management
  const handlePeerRegistry = async (req: Request, path: string): Promise<Response> => {
    try {
      const registry = defaultLLMToLLMResolver.getRegistry();

      if (path === `${baseUrl}/peers` && req.method === 'GET') {
        // List peers
        return new Response(
          JSON.stringify({
            success: true,
            data: registry.getStatus()
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else if (path === `${baseUrl}/peers` && req.method === 'POST') {
        // Register a new peer
        const body = await req.json() as {
          id: string;
          name: string;
          model: string;
          url?: string;
          description?: string;
          capabilities?: string[];
        };

        registry.registerPeer({
          id: body.id,
          name: body.name,
          model: body.model,
          url: body.url,
          description: body.description,
          capabilities: body.capabilities
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: `Peer ${body.id} registered`,
            data: registry.getStatus()
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      } else if (path.startsWith(`${baseUrl}/peers/`) && req.method === 'GET') {
        // Get specific peer
        const peerId = path.substring(`${baseUrl}/peers/`.length);
        const peer = registry.getPeer(peerId);

        if (!peer) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Peer not found: ${peerId}`
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: peer
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else if (path.startsWith(`${baseUrl}/peers/`) && req.method === 'DELETE') {
        // Unregister peer
        const peerId = path.substring(`${baseUrl}/peers/`.length);
        registry.unregisterPeer(peerId);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Peer ${peerId} unregistered`
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };

  // Health check endpoint
  const handleHealth = async (): Promise<Response> => {
    const resolverStatus = defaultResolverManager.getStatus();
    const llmToLLMStatus = defaultLLMToLLMResolver.getStatus();
    
    return new Response(JSON.stringify({
      ...resolverStatus,
      llmToLLM: llmToLLMStatus
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  // Route handler
  const handleRequest = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === `${baseUrl}/health`) {
        return await handleHealth();
      } else if (path === `${baseUrl}/impulse` && req.method === 'POST') {
        const response = await handleImpulseResolve(req);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      } else if (path === `${baseUrl}/tool` && req.method === 'POST') {
        const response = await handleToolResolve(req);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      } else if (path === `${baseUrl}/llm` && req.method === 'POST') {
        const response = await handleLLMResolve(req);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      } else if (path === `${baseUrl}/llm-to-llm` && req.method === 'POST') {
        const response = await handleLLMToLLMResolve(req);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      } else if (
        (path === `${baseUrl}/peers` || path.startsWith(`${baseUrl}/peers/`)) &&
        (req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE')
      ) {
        const response = await handlePeerRegistry(req, path);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      } else if (path === `${baseUrl}` || path === `${baseUrl}/`) {
        return new Response(
          JSON.stringify({
            message: 'Resolver Server API',
            version: '2.0.0',
            endpoints: [
              'POST /resolve/impulse - Resolve impulses',
              'POST /resolve/tool - Execute tools',
              'POST /resolve/llm - LLM resolution with tools',
              'POST /resolve/llm-to-llm - LLM-to-LLM communication',
              'GET /resolve/peers - List registered LLM peers',
              'POST /resolve/peers - Register a new LLM peer',
              'GET /resolve/peers/{peerId} - Get specific peer',
              'DELETE /resolve/peers/{peerId} - Unregister a peer',
              'GET /resolve/health - Health check'
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      } else {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error)
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
  };

  return {
    port,
    fetch: handleRequest,
    start: function() {
      if (typeof Bun !== 'undefined') {
        Bun.serve({
          port: this.port,
          fetch: this.fetch
        });
        console.log(`📡 Resolver server listening on port ${this.port}`);
      } else {
        console.log(`⚠️  Bun runtime not detected - resolver server not started`);
      }
    }
  };
}
