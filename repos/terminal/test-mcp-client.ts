#!/usr/bin/env bun
/**
 * Test MCP Client
 *
 * Tests the terminal vessel MCP server by spawning it and calling tools.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  console.log('Starting Terminal Vessel MCP Client Test');
  console.log('=========================================\n');

  // Create transport (spawns the MCP server)
  console.log('1. Connecting to terminal vessel...');
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['src/index.ts'],
    env: {
      INSTANCE_ID: 'terminal-vessel-test'
    }
  });

  // Create client
  const client = new Client(
    {
      name: 'terminal-test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  // Connect
  await client.connect(transport);
  console.log('✅ Connected to terminal vessel\n');

  // List available tools
  console.log('2. Listing available tools...');
  const { tools } = await client.request(
    { method: 'tools/list' },
    {}
  ) as any;

  console.log(`✅ Found ${tools.length} tools:`);
  tools.forEach((tool: any) => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  console.log();

  // Test 1: Spawn a terminal
  console.log('3. Testing terminal_spawn...');
  const spawnResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'terminal_spawn',
        arguments: {
          preset: 'shell',
          cwd: '/tmp'
        }
      }
    },
    {}
  ) as any;

  const spawnData = JSON.parse(spawnResult.content[0].text);
  console.log('✅ Terminal spawned:');
  console.log(`   Terminal ID: ${spawnData.terminalId}`);
  console.log(`   Impulse ID: ${spawnData.impulseId}`);
  console.log(`   PID: ${spawnData.pid}\n`);

  // Test 2: Send input
  console.log('4. Testing terminal_send_input...');
  const inputResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'terminal_send_input',
        arguments: {
          terminalId: spawnData.terminalId,
          input: 'echo "Hello from terminal vessel!"\n',
          createCheckpoint: true
        }
      }
    },
    {}
  ) as any;

  const inputData = JSON.parse(inputResult.content[0].text);
  console.log('✅ Input sent:');
  console.log(`   Success: ${inputData.success}`);
  if (inputData.checkpointId) {
    console.log(`   Checkpoint ID: ${inputData.checkpointId}`);
  }
  console.log();

  // Test 3: Connect as viewer
  console.log('5. Testing terminal_connect...');
  const connectResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'terminal_connect',
        arguments: {
          terminalId: spawnData.terminalId,
          connectionId: 'test-viewer-1',
          viewOnly: true
        }
      }
    },
    {}
  ) as any;

  const connectData = JSON.parse(connectResult.content[0].text);
  console.log('✅ Connected as viewer:');
  console.log(`   Connected: ${connectData.connected}`);
  console.log(`   Viewer count: ${connectData.viewerCount}`);
  console.log(`   Terminal buffer (last 200 chars):`);
  console.log(`   ${connectData.state.buffer.slice(-200)}`);
  console.log();

  // Test 4: List terminals
  console.log('6. Testing terminal_list...');
  const listResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'terminal_list',
        arguments: {
          filter: 'running'
        }
      }
    },
    {}
  ) as any;

  const listData = JSON.parse(listResult.content[0].text);
  console.log(`✅ Found ${listData.terminals.length} running terminal(s):`);
  listData.terminals.forEach((term: any) => {
    console.log(`   - ${term.terminalId}`);
    console.log(`     PID: ${term.pid}`);
    console.log(`     Running: ${term.running}`);
    console.log(`     Viewers: ${term.viewerCount}`);
  });
  console.log();

  // Test 5: Create checkpoint
  console.log('7. Testing terminal_checkpoint...');
  const checkpointResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'terminal_checkpoint',
        arguments: {
          terminalId: spawnData.terminalId,
          label: 'test-checkpoint'
        }
      }
    },
    {}
  ) as any;

  const checkpointData = JSON.parse(checkpointResult.content[0].text);
  console.log('✅ Checkpoint created:');
  console.log(`   Checkpoint ID: ${checkpointData.checkpointId}`);
  console.log(`   Position: ${checkpointData.position}`);
  console.log();

  // Test 6: Disconnect viewer
  console.log('8. Testing terminal_disconnect...');
  const disconnectResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: 'terminal_disconnect',
        arguments: {
          terminalId: spawnData.terminalId,
          connectionId: 'test-viewer-1'
        }
      }
    },
    {}
  ) as any;

  const disconnectData = JSON.parse(disconnectResult.content[0].text);
  console.log('✅ Viewer disconnected:');
  console.log(`   Remaining viewers: ${disconnectData.remainingViewers}\n`);

  console.log('=========================================');
  console.log('✅ All tests passed!');
  console.log('Terminal vessel is working correctly.');

  // Close connection
  await client.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
