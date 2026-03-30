#!/usr/bin/env bun
/**
 * Test HTTP Server (Vessel Discovery)
 *
 * Tests the HTTP endpoints for vessel discovery.
 */

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Terminal Vessel HTTP Server Test');
  console.log('=================================\n');

  const baseUrl = 'http://localhost:8080';

  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    console.log(`✅ Health check:`, JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.log(`❌ Health check failed: ${error.message}`);
  }
  console.log();

  // Test 2: Capabilities endpoint
  console.log('2. Testing capabilities endpoint...');
  try {
    const response = await fetch(`${baseUrl}/v2/vessels/capabilities`);
    const data = await response.json();
    console.log(`✅ Capabilities:`, JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.log(`❌ Capabilities failed: ${error.message}`);
  }
  console.log();

  // Test 3: Spawn terminal (to get a terminal ID)
  console.log('3. Spawning terminal for resolution test...');
  const { frameManager } = await import('./src/terminal/frame-manager');
  const { impulseStore } = await import('./src/state-space/impulse-store');

  const terminalId = await frameManager.spawn({ preset: 'shell' });
  console.log(`✅ Terminal spawned: ${terminalId}`);

  // Send some commands
  await frameManager.sendInput(terminalId, 'echo "Hello from HTTP test!"\n');
  await sleep(200);
  await frameManager.sendInput(terminalId, 'pwd\n');
  await sleep(200);

  console.log();

  // Test 4: Resolve terminal state impulse
  console.log('4. Testing impulse resolution endpoint...');
  try {
    const response = await fetch(`${baseUrl}/v2/impulses/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointer: {
          type: 'terminalState',
          terminalId
        }
      })
    });

    const data = await response.json();
    console.log(`✅ Resolution response:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Metadata:`, data.metadata);

    const content = JSON.parse(data.content);
    console.log(`   Terminal state:`);
    console.log(`     - Running: ${content.state.running}`);
    console.log(`     - Commands: ${content.state.totalCommands}`);
    console.log(`     - Shell history: ${content.state.shellHistory.join(', ')}`);
  } catch (error: any) {
    console.log(`❌ Resolution failed: ${error.message}`);
  }
  console.log();

  // Test 5: Resolve terminal output
  console.log('5. Testing terminal output resolution...');
  try {
    const response = await fetch(`${baseUrl}/v2/impulses/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointer: {
          type: 'terminalOutput',
          terminalId,
          fromLine: 0,
          toLine: 10
        }
      })
    });

    const data = await response.json();
    console.log(`✅ Output resolution:`);
    console.log(`   Status: ${response.status}`);

    const content = JSON.parse(data.content);
    console.log(`   Lines retrieved: ${content.lines.length}`);
  } catch (error: any) {
    console.log(`❌ Output resolution failed: ${error.message}`);
  }
  console.log();

  // Cleanup
  console.log('6. Cleanup...');
  await frameManager.kill(terminalId);
  console.log('✅ Terminal killed\n');

  console.log('=================================');
  console.log('✅ All HTTP tests completed!');
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
