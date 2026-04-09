#!/usr/bin/env bun
/**
 * Observe MiniBob Creating Impulses from Terminal
 *
 * This demo shows the complete end-to-end flow:
 * 1. MiniBob connects to terminal vessel via MCP
 * 2. Activity calls terminal_spawn MCP tool
 * 3. Terminal vessel creates terminal session
 * 4. Activity retrieves terminal state
 * 5. MiniBob creates impulse from terminal state
 * 6. Impulse is stored and can be referenced
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('╔══════════════════════════════════════════════════════════╗')
console.log('║   Observing Terminal Impulse Creation (MCP Mode)         ║')
console.log('╚══════════════════════════════════════════════════════════╝\n')

// Step 1: Connect to Terminal Vessel via MCP (stdio)
console.log('1. Connecting to terminal vessel via MCP...')

const client = new Client(
  {
    name: 'demo-client',
    version: '1.0.0'
  },
  {
    capabilities: {}
  }
);

// Launch terminal vessel in stdio mode
const transport = new StdioClientTransport({
  command: 'bun',
  args: ['run', 'repos/terminal/src/index.ts'],
  env: {
    ...process.env,
    MODE: 'stdio'
  }
});

await client.connect(transport);
console.log('   ✓ Connected to terminal vessel\n')

// Step 2: List available MCP tools
console.log('2. Discovering available MCP tools...')
const toolsResponse = await client.listTools();
console.log(`   ✓ Found ${toolsResponse.tools.length} tools:`)
for (const tool of toolsResponse.tools) {
  console.log(`      - ${tool.name}: ${tool.description}`)
}
console.log('')

// Step 3: Spawn a terminal session
console.log('3. Spawning terminal session via terminal_spawn tool...')
const spawnResult = await client.callTool({
  name: 'terminal_spawn',
  arguments: {
    preset: 'shell',
    persistent: false
  }
});

const spawnData = JSON.parse(spawnResult.content[0].text as string);
console.log(`   ✓ Terminal spawned:`)
console.log(`      Terminal ID: ${spawnData.terminalId}`)
console.log(`      Impulse ID: ${spawnData.impulseId}`)
console.log(`      PID: ${spawnData.pid}\n`)

// Step 4: Send a command to the terminal
console.log('4. Sending command to terminal...')
await client.callTool({
  name: 'terminal_send_input',
  arguments: {
    terminalId: spawnData.terminalId,
    input: 'echo "Hello from terminal vessel!"\n'
  }
});

// Wait for command to execute
await new Promise(resolve => setTimeout(resolve, 500));
console.log('   ✓ Command sent: echo "Hello from terminal vessel!"\n')

// Step 5: Resolve terminal state impulse
console.log('5. Resolving terminalState impulse...')

// Call HTTP endpoint to resolve impulse (vessels resolve via HTTP)
const resolveResponse = await fetch('http://localhost:9137/v2/impulses/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pointer: {
      type: 'terminalState',
      terminalId: spawnData.terminalId
    }
  })
});

if (!resolveResponse.ok) {
  console.error(`   ❌ Failed to resolve impulse: ${resolveResponse.statusText}`)
  process.exit(1)
}

const impulseData = await resolveResponse.json();
const terminalState = JSON.parse(impulseData.content);

console.log('   ✓ Impulse resolved:')
console.log(`      Shape: ${impulseData.metadata.shape}`)
console.log(`      Terminal ID: ${impulseData.metadata.terminalId}`)
console.log(`      Buffer length: ${terminalState.state.buffer.length} bytes`)
console.log(`      Running: ${terminalState.state.running}`)
console.log(`      PID: ${terminalState.state.pid}\n`)

// Step 6: Show terminal buffer content
console.log('6. Terminal buffer content:')
console.log('   ' + '─'.repeat(60))
const bufferLines = terminalState.state.buffer.split('\n');
for (const line of bufferLines.slice(0, 10)) {
  console.log(`   ${line}`)
}
if (bufferLines.length > 10) {
  console.log(`   ... (${bufferLines.length - 10} more lines)`)
}
console.log('   ' + '─'.repeat(60))
console.log('')

// Step 7: Show shell history
console.log('7. Shell command history:')
for (const [index, cmd] of terminalState.state.shellHistory.entries()) {
  console.log(`   ${index + 1}. ${cmd}`)
}
console.log('')

// Step 8: Create impulse structure (what MiniBob would create)
console.log('8. Creating impulse structure (as MiniBob would):')
const impulse = {
  id: spawnData.impulseId,
  pointer: {
    type: 'terminalState',
    terminalId: spawnData.terminalId
  },
  content: terminalState,
  metadata: {
    shape: 'terminalState',
    terminalId: spawnData.terminalId,
    producedBy: 'terminal-vessel-1',
    createdAt: new Date().toISOString()
  },
  budget: 10000,
  priority: 'medium',
  loaded: true
};

console.log('   ✓ Impulse structure:')
console.log(`      ID: ${impulse.id}`)
console.log(`      Shape: ${impulse.metadata.shape}`)
console.log(`      Size: ${JSON.stringify(impulse).length} bytes`)
console.log(`      Budget: ${impulse.budget} tokens\n`)

// Step 9: Demonstrate impulse usage in activity
console.log('9. How this impulse would be used in an activity:')
console.log(`
   Activity Task Example:
   {
     "id": "analyze-terminal",
     "inputImpulses": [{
       "pointer": {
         "type": "terminalState",
         "terminalId": "${spawnData.terminalId}"
       }
     }],
     "prompt": {
       "template": "Analyze output:\\n{{impulses.terminal.state.buffer}}"
     }
   }

   MiniBob would:
   1. Load impulse from pointer
   2. Inject buffer into prompt
   3. Pass to LLM for analysis
   4. Create output impulse with analysis
`)

// Cleanup
console.log('10. Cleaning up...')
await client.close();
console.log('    ✓ Disconnected from terminal vessel\n')

console.log('═'.repeat(60))
console.log('OBSERVATION COMPLETE')
console.log('═'.repeat(60))
console.log('\nKey Observations:')
console.log('  1. ✓ MCP tools discovered (terminal_spawn, terminal_send_input, etc.)')
console.log('  2. ✓ Terminal spawned via MCP tool call')
console.log('  3. ✓ Command executed in terminal')
console.log('  4. ✓ Terminal state resolved as impulse')
console.log('  5. ✓ Impulse contains full terminal state')
console.log('  6. ✓ Impulse can be referenced in activities')
console.log('\nThis is exactly how MiniBob creates impulses from terminal activities!')
