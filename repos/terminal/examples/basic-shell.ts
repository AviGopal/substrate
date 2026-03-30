/**
 * Basic Shell Example
 *
 * Demonstrates spawning a shell terminal and sending commands.
 */

// This example shows how to use the terminal vessel tools
// In practice, these would be called via MCP client

async function basicShellExample() {
  console.log('Example: Basic Shell Session');
  console.log('===========================\n');

  // Step 1: Spawn terminal with shell preset
  console.log('1. Spawning bash shell...');
  const spawnResult = {
    terminalId: 'term-example-123',
    impulseId: 'terminal-term-example-123',
    pid: 12345
  };
  console.log(`   Spawned: ${spawnResult.terminalId} (PID: ${spawnResult.pid})\n`);

  // Step 2: Send commands
  console.log('2. Sending commands...');
  console.log('   > ls -la');
  console.log('   > echo "Hello from terminal vessel"');
  console.log('   > pwd\n');

  // Step 3: Create checkpoint before risky operation
  console.log('3. Creating checkpoint before risky operation...');
  const checkpointResult = {
    checkpointId: 'checkpoint-before-rm',
    timestamp: Date.now(),
    position: 3
  };
  console.log(`   Checkpoint: ${checkpointResult.checkpointId}\n`);

  // Step 4: Send risky command
  console.log('4. Sending risky command...');
  console.log('   > rm temp.txt\n');

  // Step 5: If something goes wrong, can rollback
  console.log('5. Rollback available via:');
  console.log(`   terminal_replay(terminalId: "${spawnResult.terminalId}", checkpointId: "${checkpointResult.checkpointId}")\n`);

  // Step 6: List terminals
  console.log('6. Active terminals:');
  console.log(`   - ${spawnResult.terminalId} (running, 0 viewers)\n`);
}

// Run example
basicShellExample();
