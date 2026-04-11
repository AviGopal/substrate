#!/usr/bin/env bun
/**
 * Terminal Vessel Server
 *
 * Dual-mode server:
 * 1. HTTP server for vessel discovery and impulse resolution
 * 2. MCP server on stdio for direct MCP clients (optional)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

import { frameManager } from './terminal/frame-manager.js';
import { checkpointManager } from './terminal/checkpoint-manager.js';
import { replayEngine } from './terminal/replay-engine.js';
import { connectionPool } from './state-space/connection-pool.js';
import { impulseStore } from './state-space/impulse-store.js';

import type {
  SpawnConfig,
  SpawnResult,
  SendInputResult,
  ConnectResult,
  DisconnectResult,
  CheckpointResult,
  ListResult
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const INSTANCE_ID = process.env.INSTANCE_ID || 'terminal-vessel-1';
const MODE = process.env.MODE || 'http'; // 'http' | 'stdio' | 'both'

// Parse command-line arguments for port/socket configuration
interface ServerConfig {
  mode: 'tcp' | 'unix';
  port?: number;
  socketPath?: string;
  endpoint: string;
}

function parseServerConfig(): ServerConfig {
  const args = process.argv.slice(2);

  // Check for --socket argument
  const socketIdx = args.indexOf('--socket');
  if (socketIdx !== -1 && args[socketIdx + 1]) {
    const socketPath = args[socketIdx + 1];
    return {
      mode: 'unix',
      socketPath,
      endpoint: `unix://${socketPath}`
    };
  }

  // Check for --port argument
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    const port = parseInt(args[portIdx + 1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${args[portIdx + 1]}`);
    }
    return {
      mode: 'tcp',
      port,
      endpoint: `http://localhost:${port}`
    };
  }

  // Check for PORT environment variable
  const envPort = process.env.PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!isNaN(port) && port >= 1 && port <= 65535) {
      return {
        mode: 'tcp',
        port,
        endpoint: `http://localhost:${port}`
      };
    }
  }

  // Default: auto-select available port (will be determined at startup)
  return {
    mode: 'tcp',
    endpoint: '' // Will be set after port selection
  };
}

const SERVER_CONFIG = parseServerConfig();

// Utility to find an available port
async function findAvailablePort(startPort: number = 9090): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const testServer = Bun.serve({
        port,
        fetch() {
          return new Response('test');
        }
      });
      testServer.stop();
      return port;
    } catch (error) {
      // Port in use, try next
      continue;
    }
  }
  throw new Error(`Could not find available port in range ${startPort}-${startPort + 100}`);
}

// ============================================================================
// Discovery Vessel Integration
// ============================================================================

import { VesselClient, type DiscoveryConfig } from '@metabob/vessel-discovery-client';

let discoveryClient: VesselClient | null = null;

async function registerWithDiscovery(endpoint: string) {
  const discoveryEndpoint = process.env.DISCOVERY_VESSEL_ENDPOINT || 'http://discovery-vessel.activity-system.svc.cluster.local:8080';

  const config: DiscoveryConfig = {
    discoveryEndpoint,
    vesselId: INSTANCE_ID,
    vesselName: 'Terminal Vessel',
    version: '1.0.0',
    endpoint,
    shapes: [
      'terminalState',
      'terminalCommand',
      'terminalOutput'
    ],
    protocol: 'http',
    metadata: {
      capabilities: ['pty', 'multi-viewer', 'checkpoints', 'replay'],
      environment: process.env.NODE_ENV || 'development',
      serverMode: SERVER_CONFIG.mode,
      ...(SERVER_CONFIG.mode === 'unix' && { socketPath: SERVER_CONFIG.socketPath })
    }
  };

  discoveryClient = new VesselClient(config);

  const success = await discoveryClient.register();

  if (success) {
    console.error(`✅ Registered with discovery: ${discoveryEndpoint}`);
    console.error(`   Vessel ID: ${INSTANCE_ID}`);
    console.error(`   Endpoint: ${endpoint}`);

    // Start heartbeat
    discoveryClient.startHeartbeat();
    console.error(`   Heartbeat started`);
  } else {
    console.error(`⚠️  Discovery registration failed`);
    console.error(`   Continuing without registration - discovery may not work`);
  }
}

// ============================================================================
// HTTP Server (Vessel Discovery)
// ============================================================================

async function startHttpServer(): Promise<{ server: any; endpoint: string }> {
  // Request handler (same for both TCP and Unix socket)
  const fetchHandler = async (req: Request) => {
    const url = new URL(req.url);

    // Health check with discovery status
    if (url.pathname === '/health') {
      const healthStatus: any = {
        status: 'ok',
        vessel: 'terminal',
        instanceId: INSTANCE_ID,
        shapes: ['terminalState', 'terminalCommand', 'terminalOutput'],
        checks: {
          discovery: { status: 'unknown', registered: false }
        }
      };

      if (discoveryClient) {
        const isRunning = discoveryClient.isRunning;
        const lastHeartbeat = discoveryClient.lastHeartbeat;

        healthStatus.checks.discovery = {
          status: isRunning ? 'healthy' : 'pending',
          registered: isRunning,
          lastHeartbeat: lastHeartbeat ? lastHeartbeat.toISOString() : null
        };
      } else {
        healthStatus.checks.discovery = {
          status: 'disabled',
          registered: false
        };
      }

      return Response.json(healthStatus);
    }

    // Impulse resolution endpoint (vessel discovery)
    if (url.pathname === '/v2/impulses/resolve' && req.method === 'POST') {
      try {
        const body = await req.json() as { pointer?: { type?: string; [key: string]: any } };
        const { pointer } = body;

        if (!pointer || !pointer.type) {
          return Response.json(
            { error: 'Missing pointer or pointer.type' },
            { status: 400 }
          );
        }

        // Route to appropriate resolver based on pointer type
        switch (pointer.type) {
          case 'terminalState': {
            if (!pointer.terminalId) {
              return Response.json(
                { error: 'Missing terminalId in pointer' },
                { status: 400 }
              );
            }

            const impulse = await impulseStore.resolveTerminalState(
              `terminal-${pointer.terminalId}`
            );

            return Response.json({
              content: JSON.stringify(impulse.content),
              metadata: {
                shape: 'terminalState',
                terminalId: pointer.terminalId,
                resolvedBy: INSTANCE_ID
              }
            });
          }

          case 'terminalCommand': {
            if (!pointer.terminalId || !pointer.commandId) {
              return Response.json(
                { error: 'Missing terminalId or commandId in pointer' },
                { status: 400 }
              );
            }

            const state = await frameManager.getState(pointer.terminalId);
            const command = state.shellHistory[pointer.commandId];

            return Response.json({
              content: JSON.stringify({ command }),
              metadata: {
                shape: 'terminalCommand',
                terminalId: pointer.terminalId,
                commandId: pointer.commandId
              }
            });
          }

          case 'terminalOutput': {
            if (!pointer.terminalId) {
              return Response.json(
                { error: 'Missing terminalId in pointer' },
                { status: 400 }
              );
            }

            const state = await frameManager.getState(pointer.terminalId);
            const fromLine = pointer.fromLine || 0;
            const toLine = pointer.toLine || state.buffer.split('\n').length;
            const lines = state.buffer.split('\n').slice(fromLine, toLine);

            return Response.json({
              content: JSON.stringify({ lines }),
              metadata: {
                shape: 'terminalOutput',
                terminalId: pointer.terminalId,
                fromLine,
                toLine
              }
            });
          }

          default:
            return Response.json(
              { error: `Unknown pointer type: ${pointer.type}` },
              { status: 400 }
            );
        }
      } catch (error: any) {
        console.error('[HTTP] Resolution error:', error);
        return Response.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    // Vessel capabilities endpoint (for discovery)
    if (url.pathname === '/v2/vessels/capabilities') {
      return Response.json({
        vesselId: INSTANCE_ID,
        vesselName: 'Terminal Vessel',
        endpoint: SERVER_CONFIG.endpoint,
        shapes: [
          'terminalState',
          'terminalCommand',
          'terminalOutput'
        ],
        metadata: {
          version: '1.0.0',
          capabilities: ['pty', 'multi-viewer', 'checkpoints', 'replay']
        }
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  };

  // Start server based on mode
  if (SERVER_CONFIG.mode === 'unix') {
    // Unix socket mode
    const server = Bun.serve({
      unix: SERVER_CONFIG.socketPath!,
      fetch: fetchHandler
    });

    console.error(`🔌 Server listening on Unix socket: ${SERVER_CONFIG.socketPath}`);
    console.error(`   Endpoint: ${SERVER_CONFIG.endpoint}`);

    return { server, endpoint: SERVER_CONFIG.endpoint };
  } else {
    // TCP mode
    let port = SERVER_CONFIG.port;

    // Auto-select port if not specified
    if (!port) {
      port = await findAvailablePort();
      SERVER_CONFIG.port = port;
      SERVER_CONFIG.endpoint = `http://localhost:${port}`;
    }

    const server = Bun.serve({
      port,
      fetch: fetchHandler
    });

    console.error(`🌐 HTTP server listening on port ${server.port}`);
    console.error(`   Health: http://localhost:${server.port}/health`);
    console.error(`   Resolve: http://localhost:${server.port}/v2/impulses/resolve`);

    return { server, endpoint: SERVER_CONFIG.endpoint };
  }
}

// ============================================================================
// MCP Server (stdio)
// ============================================================================

const mcpServer = new Server(
  {
    name: 'terminal-vessel',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// MCP Tool Definitions
const tools: Tool[] = [
  {
    name: 'terminal_spawn',
    description: 'Spawn a new terminal session (supports any terminal application)',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        args: { type: 'array', items: { type: 'string' } },
        shell: { type: 'string' },
        cwd: { type: 'string' },
        env: { type: 'object' },
        interactive: { type: 'boolean' },
        persistent: { type: 'boolean' },
        persistenceKey: { type: 'string' },
        preset: {
          type: 'string',
          enum: ['claude', 'minibob', 'shell', 'vim', 'repl', 'server']
        }
      }
    }
  },
  {
    name: 'terminal_send_input',
    description: 'Send input to terminal',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: { type: 'string' },
        input: { type: 'string' },
        createCheckpoint: { type: 'boolean' }
      },
      required: ['terminalId', 'input']
    }
  },
  {
    name: 'terminal_connect',
    description: 'Connect as viewer to terminal',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: { type: 'string' },
        connectionId: { type: 'string' },
        viewOnly: { type: 'boolean' }
      },
      required: ['terminalId', 'connectionId']
    }
  },
  {
    name: 'terminal_disconnect',
    description: 'Disconnect viewer from terminal',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: { type: 'string' },
        connectionId: { type: 'string' }
      },
      required: ['terminalId', 'connectionId']
    }
  },
  {
    name: 'terminal_checkpoint',
    description: 'Create checkpoint for rollback',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: { type: 'string' },
        label: { type: 'string' },
        broadcast: { type: 'boolean' }
      },
      required: ['terminalId']
    }
  },
  {
    name: 'terminal_replay',
    description: 'Rollback and replay from checkpoint',
    inputSchema: {
      type: 'object',
      properties: {
        terminalId: { type: 'string' },
        checkpointId: { type: 'string' },
        speed: { type: 'number' }
      },
      required: ['terminalId', 'checkpointId']
    }
  },
  {
    name: 'terminal_list',
    description: 'List active terminal sessions',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['all', 'running', 'exited', 'persistent'] }
      }
    }
  }
];

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'terminal_spawn': {
        const config = args as SpawnConfig;
        const terminalId = await frameManager.spawn(config);
        const impulse = await impulseStore.createTerminalStateImpulse(terminalId, config.persistenceKey);

        const result: SpawnResult = {
          terminalId,
          impulseId: impulse.id,
          pid: impulse.content.state.pid
        };

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'terminal_send_input': {
        const { terminalId, input, createCheckpoint } = args as any;
        let checkpointId: string | undefined;

        if (createCheckpoint) {
          const checkpoint = await checkpointManager.create(terminalId);
          checkpointId = checkpoint.id;
        }

        await frameManager.sendInput(terminalId, input);
        await impulseStore.updateTerminalStateImpulse(terminalId);

        const result: SendInputResult = { success: true, checkpointId };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'terminal_connect': {
        const { terminalId, connectionId, viewOnly } = args as any;
        connectionPool.connect(terminalId, connectionId, viewOnly || false);
        const state = await frameManager.getState(terminalId);

        const result: ConnectResult = {
          connected: true,
          state,
          viewerCount: connectionPool.getViewerCount(terminalId)
        };

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'terminal_disconnect': {
        const { terminalId, connectionId } = args as any;
        connectionPool.disconnect(terminalId, connectionId);

        const result: DisconnectResult = {
          disconnected: true,
          remainingViewers: connectionPool.getViewerCount(terminalId)
        };

        if (!connectionPool.hasViewers(terminalId)) {
          const impulse = impulseStore.getByTerminalId(terminalId);
          if (impulse && !impulse.pointer?.persistenceKey) {
            setTimeout(async () => {
              await frameManager.kill(terminalId);
              impulseStore.remove(impulse.id);
            }, 60000);
          }
        }

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'terminal_checkpoint': {
        const { terminalId, label, broadcast } = args as any;
        const checkpoint = await checkpointManager.create(terminalId, label, broadcast);
        await impulseStore.updateTerminalStateImpulse(terminalId);

        const result: CheckpointResult = {
          checkpointId: checkpoint.id,
          timestamp: checkpoint.timestamp,
          position: checkpoint.position
        };

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'terminal_replay': {
        const { terminalId, checkpointId, speed } = args as any;
        const result = await replayEngine.rollbackAndReplay(terminalId, checkpointId, speed || 10);
        await impulseStore.updateTerminalStateImpulse(terminalId);

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'terminal_list': {
        const { filter } = args as any;
        const allTerminals = frameManager.listTerminals();
        const terminals = await Promise.all(
          allTerminals.map(async (terminalId) => {
            const state = await frameManager.getState(terminalId);
            const impulse = impulseStore.getByTerminalId(terminalId);

            return {
              terminalId,
              pid: state.pid,
              running: state.running,
              viewerCount: connectionPool.getViewerCount(terminalId),
              persistent: !!impulse?.pointer.persistenceKey,
              createdAt: state.createdAt,
              lastActivity: state.lastActivity
            };
          })
        );

        let filtered = terminals;
        if (filter === 'running') filtered = terminals.filter(t => t.running);
        else if (filter === 'exited') filtered = terminals.filter(t => !t.running);
        else if (filter === 'persistent') filtered = terminals.filter(t => t.persistent);

        const result: ListResult = { terminals: filtered };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, tool: name }, null, 2) }],
      isError: true
    };
  }
});

async function startMcpServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('📡 MCP server running on stdio');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.error('Terminal Vessel Starting...');
  console.error(`Instance ID: ${INSTANCE_ID}`);
  console.error(`Mode: ${MODE}`);
  console.error(`Server Config: ${SERVER_CONFIG.mode === 'unix' ? `Unix socket (${SERVER_CONFIG.socketPath})` : `TCP port ${SERVER_CONFIG.port || 'auto'}`}`);
  console.error('');

  if (MODE === 'http' || MODE === 'both') {
    const { endpoint } = await startHttpServer();
    await registerWithDiscovery(endpoint);
  }

  if (MODE === 'stdio' || MODE === 'both') {
    await startMcpServer();
  }

  if (MODE !== 'http' && MODE !== 'stdio' && MODE !== 'both') {
    console.error(`Invalid MODE: ${MODE}. Use 'http', 'stdio', or 'both'`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.error('[Server] SIGTERM received, shutting down gracefully');

  if (discoveryClient) {
    await discoveryClient.shutdown();
  }

  console.error('[Server] Graceful shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.error('[Server] SIGINT received, shutting down gracefully');

  if (discoveryClient) {
    await discoveryClient.shutdown();
  }

  console.error('[Server] Graceful shutdown complete');
  process.exit(0);
});
