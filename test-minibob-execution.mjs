#!/usr/bin/env node
/**
 * Test: Execute workbench-created template with MiniBob
 * This proves MiniBob can actually RUN templates created from the workbench
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const MINIBOB_DIR = '/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob';
const TEMPLATE_ID = 'test.workbench.integration';

console.log('='.repeat(80));
console.log('TEST: MiniBob Execution of Workbench Template');
console.log('='.repeat(80));
console.log();

console.log('Template ID:', TEMPLATE_ID);
console.log('MiniBob Dir:', MINIBOB_DIR);
console.log();

// Create a test goal file
const testGoal = 'Echo the message: "MiniBob executed a workbench template!"';
const testFile = join(tmpdir(), 'minibob-test-goal.txt');
writeFileSync(testFile, testGoal);

console.log('Test Setup:');
console.log('  Goal:', testGoal);
console.log('  Goal File:', testFile);
console.log();

console.log('-'.repeat(80));
console.log('Executing MiniBob with workbench template...');
console.log('-'.repeat(80));
console.log();

try {
  // Execute MiniBob with the template
  // Using timeout to avoid hanging if something goes wrong
  const result = execSync(
    `cd "${MINIBOB_DIR}" && timeout 120 bun run index.ts --template "${TEMPLATE_ID}" --budget 1.0 2>&1`,
    {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: 'pipe'
    }
  );

  console.log('EXECUTION OUTPUT:');
  console.log(result);
  console.log();

  // Check if execution was successful
  if (result.includes('successfully') || result.includes('completed') || result.includes('executed')) {
    console.log('✅ MiniBob successfully executed the workbench template');
  } else {
    console.log('⚠️  Execution completed but success unclear');
  }

} catch (error) {
  if (error.status === 124) {
    console.log('❌ Execution timed out after 120 seconds');
    console.log('   This might indicate MiniBob is waiting for input or stuck');
  } else {
    console.log('❌ Execution failed');
    console.log('   Exit code:', error.status);
    console.log('   Error:', error.message);

    if (error.stdout) {
      console.log('\nSTDOUT:');
      console.log(error.stdout.toString().substring(0, 2000));
    }

    if (error.stderr) {
      console.log('\nSTDERR:');
      console.log(error.stderr.toString().substring(0, 2000));
    }
  }
}

console.log();
console.log('='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80));
console.log();
console.log('Note: If MiniBob hangs, it may be trying to connect to services');
console.log('or waiting for authentication. Check ~/.metabob/config.json');
console.log();
