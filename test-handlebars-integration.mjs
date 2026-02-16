#!/usr/bin/env node

// Test Handlebars integration - verify simple variables and conditionals both work

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const executeActivity = (activityId, variables, reason) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${reason}`);
    console.log(`Activity: ${activityId}`);
    console.log(`Variables:`, JSON.stringify(variables, null, 2));
    console.log(`${'='.repeat(70)}\n`);
    
    // Write test input to file for debugging
    const testInput = JSON.stringify({ activityId, variables, reason }, null, 2);
    writeFileSync(`/tmp/activity-test-${activityId}.json`, testInput);
    
    const proc = spawn('node', [
      'repos/metabob-opencode/packages/opencode/dist/index.js',
      'activity',
      'run',
      `test-${activityId}`
    ], {
      env: {
        ...process.env,
        OPENCODE_ACTIVITY_ID: activityId,
        OPENCODE_VARIABLES: JSON.stringify(variables),
        OPENCODE_REASON: reason
      },
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });
    
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });
    
    proc.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Result: ${code === 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`Duration: ${duration}s`);
      console.log(`Exit code: ${code}`);
      console.log(`${'='.repeat(70)}\n`);
      
      // Check for interpolation errors in output
      const hasInterpolationError = stderr.includes('Missing variables') || 
                                    stderr.includes('interpolation failed');
      
      resolve({
        activityId,
        success: code === 0,
        duration: parseFloat(duration),
        hasInterpolationError,
        stdout,
        stderr
      });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
};

(async () => {
  console.log('\n🧪 HANDLEBARS INTEGRATION TEST SUITE\n');
  
  const results = [];
  
  // Test 1: Simple variables (backwards compatibility)
  try {
    const result1 = await executeActivity(
      'demo-315bfaf1',
      { message: 'Testing simple variable interpolation' },
      'Backwards compatibility: simple variables without Handlebars features'
    );
    results.push(result1);
  } catch (err) {
    console.error('Test 1 failed with error:', err);
    results.push({ activityId: 'demo-315bfaf1', success: false, error: err.message });
  }
  
  // Test 2: Handlebars conditionals (the fix target)
  try {
    const result2 = await executeActivity(
      'feature-fdb6afae',
      {
        endpoint_path: '/api/users',
        http_method: 'GET',
        endpoint_description: 'Retrieve user list',
        // Optional fields to test conditionals
        request_schema: JSON.stringify({ query: { limit: 'number' } })
      },
      'Handlebars conditionals: template with {{#if}} {{#each}} blocks'
    );
    results.push(result2);
  } catch (err) {
    console.error('Test 2 failed with error:', err);
    results.push({ activityId: 'feature-fdb6afae', success: false, error: err.message });
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70) + '\n');
  
  results.forEach((result, i) => {
    console.log(`Test ${i + 1}: ${result.activityId}`);
    console.log(`  Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Duration: ${result.duration}s`);
    console.log(`  Interpolation Error: ${result.hasInterpolationError ? 'YES ❌' : 'NO ✅'}`);
    if (result.error) console.log(`  Error: ${result.error}`);
    console.log();
  });
  
  const allPassed = results.every(r => r.success);
  const noInterpolationErrors = results.every(r => !r.hasInterpolationError);
  
  console.log('='.repeat(70));
  console.log(allPassed && noInterpolationErrors ? 
    '✅ ALL TESTS PASSED - Handlebars integration working!' :
    '❌ SOME TESTS FAILED - Review output above'
  );
  console.log('='.repeat(70) + '\n');
  
  process.exit(allPassed && noInterpolationErrors ? 0 : 1);
})();
