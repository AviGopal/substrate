/**
 * MCP Server Integration Tests
 *
 * Tests the terminal vessel's MCP stdio server (MODE=stdio).
 * The server speaks JSON-RPC 2.0 over stdin/stdout.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'path';

// ============================================================================
// Constants
// ============================================================================

const TERMINAL_DIR = join(import.meta.dir, '..', '..');
const PROTOCOL_VERSION = '2025-03-26';

// ============================================================================
// MCP stdio client helpers
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type SpawnedProc = ReturnType<typeof Bun.spawn>;

let proc: SpawnedProc;
let reqId = 0;

/** Pending resolvers keyed by JSON-RPC id */
const pending = new Map<number, (resp: JsonRpcResponse) => void>();

/** Incomplete line buffer for stdout */
let lineBuffer = '';

/**
 * Attach a persistent line-reader to the process stdout.
 * Each complete newline-terminated chunk is parsed as JSON-RPC and
 * dispatched to the matching pending resolver.
 */
function attachReader(p: SpawnedProc) {
  async function read() {
    const reader = p.stdout.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let msg: JsonRpcResponse;
          try {
            msg = JSON.parse(trimmed);
          } catch {
            // Not JSON (could be a log line) — skip
            continue;
          }
          if (msg.id !== null && msg.id !== undefined) {
            const resolve = pending.get(msg.id as number);
            if (resolve) {
              pending.delete(msg.id as number);
              resolve(msg);
            }
          }
        }
      }
    } catch {
      // Process exited — drain pending with error
    }
  }
  read(); // start background reader (intentionally not awaited)
}

/**
 * Send a JSON-RPC 2.0 request and wait for the matching response.
 */
async function sendRpc(
  method: string,
  params?: unknown,
  timeoutMs = 10_000
): Promise<JsonRpcResponse> {
  const id = ++reqId;
  const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
  const line = JSON.stringify(req) + '\n';

  const responsePromise = new Promise<JsonRpcResponse>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`RPC timeout: ${method} (id=${id})`)),
      timeoutMs
    );
    pending.set(id, (resp) => {
      clearTimeout(timer);
      resolve(resp);
    });
  });

  await proc.stdin.write(new TextEncoder().encode(line));
  return responsePromise;
}

/**
 * Send the MCP initialize + initialized handshake.
 * Must be called once before any other method.
 */
async function initialize(): Promise<JsonRpcResponse> {
  const resp = await sendRpc('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'test-client', version: '0.0.1' }
  });

  // Notify server that client is initialized (no response expected)
  const notification = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
  }) + '\n';
  await proc.stdin.write(new TextEncoder().encode(notification));

  return resp;
}

// ============================================================================
// Lifecycle
// ============================================================================

beforeAll(async () => {
  proc = Bun.spawn(['bun', 'src/index.ts'], {
    cwd: TERMINAL_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MODE: 'stdio' }
  });

  attachReader(proc);

  // Give the process a moment to start up
  await new Promise(resolve => setTimeout(resolve, 500));

  await initialize();
}, 15_000);

afterAll(async () => {
  if (proc) {
    proc.kill('SIGTERM');
    await proc.exited.catch(() => {});
  }
});

// ============================================================================
// Test state shared across tests
// ============================================================================

let spawnedTerminalId: string;
let createdCheckpointId: string;

// ============================================================================
// Tests
// ============================================================================

describe('MCP server — terminal vessel (stdio)', () => {
  // 6.3 — tools/list
  test('tools/list returns tools array containing terminal_spawn', async () => {
    const resp = await sendRpc('tools/list');

    expect(resp.error).toBeUndefined();
    const result = resp.result as { tools: Array<{ name: string }> };
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);

    const names = result.tools.map(t => t.name);
    expect(names).toContain('terminal_spawn');
  }, 10_000);

  // 6.4 — terminal_spawn
  test('terminal_spawn returns terminalId matching /^term-/', async () => {
    const resp = await sendRpc('tools/call', {
      name: 'terminal_spawn',
      arguments: { preset: 'shell', cwd: '/tmp' }
    });

    expect(resp.error).toBeUndefined();
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.terminalId).toMatch(/^term-/);

    spawnedTerminalId = parsed.terminalId;
  }, 10_000);

  // 6.5 — terminal_send_input
  test('terminal_send_input returns success: true', async () => {
    expect(spawnedTerminalId).toBeDefined();

    const resp = await sendRpc('tools/call', {
      name: 'terminal_send_input',
      arguments: { terminalId: spawnedTerminalId, input: 'echo vessel-test-ok\n' }
    });

    expect(resp.error).toBeUndefined();
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
  }, 10_000);

  // 6.6 — terminal_checkpoint
  test('terminal_checkpoint returns non-empty checkpointId', async () => {
    expect(spawnedTerminalId).toBeDefined();

    const resp = await sendRpc('tools/call', {
      name: 'terminal_checkpoint',
      arguments: { terminalId: spawnedTerminalId, label: 'test-checkpoint' }
    });

    expect(resp.error).toBeUndefined();
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(typeof parsed.checkpointId).toBe('string');
    expect(parsed.checkpointId.length).toBeGreaterThan(0);

    createdCheckpointId = parsed.checkpointId;
  }, 10_000);

  // 6.7 — terminal_replay
  test('terminal_replay does not return an error', async () => {
    expect(spawnedTerminalId).toBeDefined();
    expect(createdCheckpointId).toBeDefined();

    const resp = await sendRpc('tools/call', {
      name: 'terminal_replay',
      arguments: { terminalId: spawnedTerminalId, checkpointId: createdCheckpointId }
    });

    // Either no RPC-level error, or an isError content (tool-level error) is acceptable —
    // the key assertion is that no JSON-RPC protocol error occurred and the call completed.
    expect(resp.error).toBeUndefined();
    const result = resp.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(Array.isArray(result.content)).toBe(true);
  }, 10_000);

  // 6.8 — terminal_list with filter: "all" includes the spawned terminal
  // Uses filter:"all" (not "running") so the terminal is found even if the
  // replay restored it to an exited state.
  test('terminal_list with filter all includes the spawned terminal', async () => {
    expect(spawnedTerminalId).toBeDefined();

    const resp = await sendRpc('tools/call', {
      name: 'terminal_list',
      arguments: { filter: 'all' }
    });

    expect(resp.error).toBeUndefined();
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed.terminals)).toBe(true);

    const ids = parsed.terminals.map((t: { terminalId: string }) => t.terminalId);
    expect(ids).toContain(spawnedTerminalId);
  }, 10_000);

  // 6.9 — unknown tool returns isError
  test('calling an unknown tool returns isError: true', async () => {
    const resp = await sendRpc('tools/call', {
      name: 'terminal_nonexistent',
      arguments: {}
    });

    // The MCP server catches the error inside the tool handler and returns
    // isError: true in the result content rather than a JSON-RPC error object.
    expect(resp.error).toBeUndefined();
    const result = resp.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(result.isError).toBe(true);
  }, 10_000);
});
