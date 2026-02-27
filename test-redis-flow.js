#!/usr/bin/env node
// Test Redis data flow with input-output validation
const { execSync } = require('child_process');

const TEST_RUN_ID = 'e2e-test-20260226-manual';
const TEST_INPUT = 'Hello Redis from E2E test - this is the input data';

async function testRedisWithCLI() {
  console.log('=== Testing Redis Data Flow ===\n');

  try {
    // Test data
    const testData = {
      testRunId: TEST_RUN_ID,
      sessionId: `test-session-${TEST_RUN_ID}`,
      data: {
        input: TEST_INPUT,
        timestamp: new Date().toISOString()
      }
    };

    const key = `test:session:${TEST_RUN_ID}`;
    const value = JSON.stringify(testData);

    // Write to Redis using redis-cli
    console.log(`Writing to Redis key: ${key}`);
    execSync(`echo '${value.replace(/'/g, "'\\''")}' | redis-cli -h localhost -p 6379 -x SET ${key}`, {
      stdio: 'pipe'
    });
    console.log('✓ Written to Redis\n');

    // Set TTL
    execSync(`redis-cli -h localhost -p 6379 EXPIRE ${key} 300`, { stdio: 'pipe' });

    // Read from Redis
    console.log(`Reading from Redis key: ${key}`);
    const retrieved = execSync(`redis-cli -h localhost -p 6379 GET ${key}`, {
      encoding: 'utf8'
    }).trim();
    console.log('✓ Read from Redis\n');

    const parsedData = JSON.parse(retrieved);

    // Validate input-output dependency
    const inputMatch = parsedData.data.input === TEST_INPUT;
    console.log('=== Input-Output Validation ===');
    console.log(`Input:  "${TEST_INPUT}"`);
    console.log(`Output: "${parsedData.data.input}"`);
    console.log(`Match:  ${inputMatch ? '✓ PASS' : '✗ FAIL'}\n');

    const result = {
      testRunId: TEST_RUN_ID,
      testName: 'redis-data-flow',
      input: TEST_INPUT,
      output: parsedData.data.input,
      status: inputMatch ? 'PASS' : 'FAIL',
      dataDependency: 'output === input',
      verificationMethod: 'exact string match'
    };

    console.log('=== Test Result ===');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testRedisWithCLI()
  .then(result => {
    process.exit(result.status === 'PASS' ? 0 : 1);
  })
  .catch(err => {
    process.exit(1);
  });
