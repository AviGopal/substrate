#!/usr/bin/env bun
/**
 * Direct Terminal Test
 *
 * Tests terminal vessel components directly without MCP.
 */

import { frameManager } from './src/terminal/frame-manager';
import { checkpointManager } from './src/terminal/checkpoint-manager';
import { connectionPool } from './src/state-space/connection-pool';
import { impulseStore } from './src/state-space/impulse-store';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Terminal Vessel Direct Component Test');
  console.log('=====================================\n');

  try {
    // Test 1: Spawn terminal
    console.log('1. Spawning bash terminal...');
    const terminalId = await frameManager.spawn({
      preset: 'shell',
      cwd: '/tmp'
    });
    console.log(`✅ Terminal spawned: ${terminalId}`);

    const state = await frameManager.getState(terminalId);
    console.log(`   PID: ${state.pid}`);
    console.log(`   Shell: ${state.shell}`);
    console.log(`   CWD: ${state.cwd}\n`);

    // Wait for shell to initialize
    await sleep(500);

    // Test 2: Send commands
    console.log('2. Sending commands...');
    await frameManager.sendInput(terminalId, 'echo "Hello from terminal vessel!"\n');
    await sleep(200);
    await frameManager.sendInput(terminalId, 'pwd\n');
    await sleep(200);
    await frameManager.sendInput(terminalId, 'date\n');
    await sleep(200);

    const stateAfterCommands = await frameManager.getState(terminalId);
    console.log(`✅ Commands sent: ${stateAfterCommands.totalCommands}`);
    console.log(`   Shell history: ${stateAfterCommands.shellHistory.join(', ')}\n`);

    // Test 3: Create checkpoint
    console.log('3. Creating checkpoint...');
    const checkpoint = await checkpointManager.create(
      terminalId,
      'test-checkpoint'
    );
    console.log(`✅ Checkpoint created: ${checkpoint.id}`);
    console.log(`   Position: ${checkpoint.position}`);
    console.log(`   Label: ${checkpoint.label}\n`);

    // Test 4: Create impulse
    console.log('4. Creating terminal state impulse...');
    const impulse = await impulseStore.createTerminalStateImpulse(terminalId);
    console.log(`✅ Impulse created: ${impulse.id}`);
    console.log(`   Shape: ${impulse.shape}`);
    console.log(`   Sticky: ${impulse.sticky}`);
    console.log(`   Terminal ID: ${impulse.pointer.terminalId}`);
    console.log(`   Commands in history: ${impulse.content.position}\n`);

    // Test 5: Multi-viewer connection
    console.log('5. Testing multi-viewer connections...');
    connectionPool.connect(terminalId, 'viewer-1', true);
    connectionPool.connect(terminalId, 'viewer-2', true);

    const viewers = connectionPool.getViewers(terminalId);
    console.log(`✅ Connected viewers: ${viewers.length}`);
    console.log(`   Viewer IDs: ${viewers.join(', ')}\n`);

    // Test 6: Get terminal buffer output
    console.log('6. Terminal buffer output (last 500 chars):');
    const finalState = await frameManager.getState(terminalId);
    const bufferPreview = finalState.buffer.slice(-500);
    console.log('---');
    console.log(bufferPreview);
    console.log('---\n');

    // Test 7: List terminals
    console.log('7. Listing all terminals...');
    const terminals = frameManager.listTerminals();
    console.log(`✅ Active terminals: ${terminals.length}`);
    terminals.forEach(tid => console.log(`   - ${tid}`));
    console.log();

    // Test 8: Disconnect viewers
    console.log('8. Disconnecting viewers...');
    connectionPool.disconnect(terminalId, 'viewer-1');
    const remainingViewers = connectionPool.getViewerCount(terminalId);
    console.log(`✅ Viewer disconnected`);
    console.log(`   Remaining viewers: ${remainingViewers}\n`);

    // Cleanup
    console.log('9. Cleanup...');
    await frameManager.kill(terminalId);
    impulseStore.remove(impulse.id);
    console.log('✅ Terminal killed and impulse removed\n');

    console.log('=====================================');
    console.log('✅ All direct tests passed!');
    console.log('Core terminal vessel components working correctly.');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
