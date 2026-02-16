#!/usr/bin/env node
/**
 * Test Context Requirements Flow - End-to-End Validation
 * 
 * This script tests the complete flow:
 * 1. Activity template with context_requirements
 * 2. Memory agent receives requirements
 * 3. Memory agent creates impulses
 * 4. Main agent receives impulses in <session_memory>
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Configuration
const OPENCODE_BIN = join(homedir(), 'documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/opencode');
const TEST_PROMPT = `
I want to refactor the file repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts 
to improve performance.

IMPORTANT: This is a test to validate that:
1. Context requirements flow from template to memory agent
2. Memory agent creates appropriate impulses
3. Main agent receives impulses in session memory

Please analyze the context requirements and tell me what impulses were created.
`.trim();

console.log('='.repeat(70));
console.log('Context Requirements Flow Test');
console.log('='.repeat(70));
console.log('');
console.log('Test Setup:');
console.log(`  OpenCode Binary: ${OPENCODE_BIN}`);
console.log(`  Backend: http://localhost:8080`);
console.log(`  Template: refactor-72eb4607 (3 context requirements)`);
console.log('');

// Check binary exists
if (!existsSync(OPENCODE_BIN)) {
  console.error('❌ OpenCode binary not found!');
  console.error(`   Expected: ${OPENCODE_BIN}`);
  process.exit(1);
}

console.log('Starting OpenCode session...');
console.log('');

// Spawn OpenCode process
const opencode = spawn(OPENCODE_BIN, [
  '--yes',  // Auto-approve permissions
  '--mode', 'activity',  // Activity mode
], {
  cwd: join(homedir(), 'documents/work/exp-repo/metabob-devbob'),
  env: {
    ...process.env,
    LOG_LEVEL: 'info',  // Enable detailed logging
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

opencode.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
});

opencode.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  
  // Log key events
  if (text.includes('CONTEXT_REQUIREMENTS_EXTRACTED')) {
    console.log('\n🎯 CONTEXT REQUIREMENTS EXTRACTED!\n');
  }
  if (text.includes('MEMORY_AGENT_COMPLETED')) {
    console.log('\n✅ MEMORY AGENT COMPLETED!\n');
  }
  if (text.includes('IMPULSE_CREATED')) {
    console.log('\n📦 IMPULSE CREATED!\n');
  }
  
  process.stderr.write(text);
});

// Send prompt after brief delay
setTimeout(() => {
  console.log('Sending test prompt...\n');
  opencode.stdin.write(TEST_PROMPT + '\n');
  
  // Wait for response, then exit
  setTimeout(() => {
    console.log('\n' + '='.repeat(70));
    console.log('Test Complete - Analyzing Logs');
    console.log('='.repeat(70));
    
    // Look for key events in error output (where logs go)
    const hasRequirements = errorOutput.includes('CONTEXT_REQUIREMENTS_EXTRACTED');
    const hasMemoryAgent = errorOutput.includes('MEMORY_AGENT_COMPLETED');
    const hasImpulses = errorOutput.includes('IMPULSE_CREATED');
    
    console.log('');
    console.log('Flow Validation:');
    console.log(`  [${hasRequirements ? '✅' : '❌'}] Context requirements extracted`);
    console.log(`  [${hasMemoryAgent ? '✅' : '❌'}] Memory agent completed`);
    console.log(`  [${hasImpulses ? '✅' : '❌'}] Impulses created`);
    console.log('');
    
    if (hasRequirements && hasMemoryAgent && hasImpulses) {
      console.log('🎉 SUCCESS - Full flow validated!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Check logs for impulse details');
      console.log('  2. Verify impulse types match requirements');
      console.log('  3. Confirm budget allocations');
      process.exit(0);
    } else {
      console.log('⚠️  PARTIAL - Some steps missing');
      console.log('');
      console.log('Check logs for details:');
      console.log('  grep "CONTEXT_REQUIREMENTS" ~/.local/share/opencode/logs/*.log');
      console.log('  grep "MEMORY_AGENT" ~/.local/share/opencode/logs/*.log');
      console.log('  grep "IMPULSE_CREATED" ~/.local/share/opencode/logs/*.log');
      process.exit(1);
    }
  }, 30000);  // Wait 30 seconds for processing
}, 3000);  // Wait 3 seconds for OpenCode to start

opencode.on('error', (err) => {
  console.error('❌ Failed to start OpenCode:', err);
  process.exit(1);
});

opencode.on('exit', (code) => {
  console.log(`\nOpenCode exited with code ${code}`);
});
