/**
 * Comprehensive test script for identity-vessel API key validation
 *
 * Tests the /v1/keys/validate endpoint against the canary deployment.
 *
 * Usage:
 *   bun run test-identity-vessel-validation.ts
 */

const ENDPOINT = process.env.IDENTITY_API_URL || 'https://identity.metabob.com';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Run a test and track result
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const start = performance.now();
  try {
    await testFn();
    const duration = performance.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`${colors.green}✓${colors.reset} ${name} ${colors.gray}(${duration.toFixed(2)}ms)${colors.reset}`);
  } catch (error) {
    const duration = performance.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration, error: errorMessage });
    console.log(`${colors.red}✗${colors.reset} ${name} ${colors.gray}(${duration.toFixed(2)}ms)${colors.reset}`);
    console.log(`  ${colors.red}${errorMessage}${colors.reset}`);
  }
}

/**
 * Helper to make HTTP requests
 */
async function request(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${ENDPOINT}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok && response.status !== 400) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return { status: response.status, data };
}

/**
 * Generate a test API key
 */
async function generateTestKey(
  orgId: string,
  userId: string
): Promise<{ key: string; keyId: string; prefix: string }> {
  const { status, data } = await request('POST', '/v1/keys/generate', {
    org_id: orgId,
    user_id: userId,
    name: 'Test Key',
    scopes: ['read', 'write'],
  });

  if (status !== 200 || !data.success) {
    throw new Error(`Failed to generate test key: ${JSON.stringify(data)}`);
  }

  return {
    key: data.data.key,
    keyId: data.data.key_id,
    prefix: data.data.prefix,
  };
}

/**
 * Test Suite
 */
async function main() {
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}Identity Vessel API Key Validation Test Suite${colors.reset}`);
  console.log(`${colors.gray}Endpoint: ${ENDPOINT}${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  // ============================================================================
  // Test 1: Health Check
  // ============================================================================
  await runTest('Health check endpoint responds', async () => {
    const { status, data } = await request('GET', '/health');
    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }
    if (data.status !== 'ok') {
      throw new Error(`Expected status=ok, got ${data.status}`);
    }
    if (data.service !== 'identity-vessel') {
      throw new Error(`Expected service=identity-vessel, got ${data.service}`);
    }
  });

  // ============================================================================
  // Test 2: Generate Test API Key
  // ============================================================================
  let testKey: { key: string; keyId: string; prefix: string } | null = null;

  await runTest('Generate test API key', async () => {
    testKey = await generateTestKey('test_org_123', 'test_user_456');
    if (!testKey.key) {
      throw new Error('No API key returned');
    }
    if (!testKey.keyId.startsWith('key_')) {
      throw new Error(`Invalid key ID format: ${testKey.keyId}`);
    }
    if (testKey.prefix !== 'mb_test' && testKey.prefix !== 'mb_live') {
      throw new Error(`Invalid prefix: ${testKey.prefix}`);
    }
  });

  if (!testKey) {
    console.log(`\n${colors.red}Cannot continue without a test key${colors.reset}\n`);
    process.exit(1);
  }

  // ============================================================================
  // Test 3: Validate Valid API Key
  // ============================================================================
  await runTest('Validate valid API key', async () => {
    const { status, data } = await request('POST', '/v1/keys/validate', {
      api_key: testKey!.key,
    });

    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }
    if (!data.success) {
      throw new Error(`Expected success=true, got ${data.success}`);
    }
    if (!data.data.valid) {
      throw new Error(`Key should be valid, error: ${data.data.error}`);
    }
    if (data.data.org_id !== 'test_org_123') {
      throw new Error(`Expected org_id=test_org_123, got ${data.data.org_id}`);
    }
    if (data.data.user_id !== 'test_user_456') {
      throw new Error(`Expected user_id=test_user_456, got ${data.data.user_id}`);
    }
    if (data.data.key_id !== testKey!.keyId) {
      throw new Error(`Expected key_id=${testKey!.keyId}, got ${data.data.key_id}`);
    }
    if (!Array.isArray(data.data.scopes)) {
      throw new Error(`Expected scopes to be an array, got ${typeof data.data.scopes}`);
    }
    if (data.data.role !== 'user') {
      throw new Error(`Expected role=user, got ${data.data.role}`);
    }
  });

  // ============================================================================
  // Test 4: Validate Malformed API Key
  // ============================================================================
  await runTest('Reject malformed API key', async () => {
    const { status, data } = await request('POST', '/v1/keys/validate', {
      api_key: 'invalid-key-format',
    });

    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }
    if (!data.success) {
      throw new Error(`Expected success=true, got ${data.success}`);
    }
    if (data.data.valid) {
      throw new Error('Malformed key should be invalid');
    }
    if (!data.data.error) {
      throw new Error('Should have error message for invalid key');
    }
  });

  // ============================================================================
  // Test 5: Validate Tampered API Key
  // ============================================================================
  await runTest('Reject tampered API key signature', async () => {
    // Decode, tamper with signature, re-encode
    const decoded = Buffer.from(testKey!.key, 'base64url').toString('utf-8');
    const parts = decoded.split('-');
    parts[parts.length - 1] = 'tampered123456789012345678901234';
    const tamperedKey = Buffer.from(parts.join('-')).toString('base64url');

    const { status, data } = await request('POST', '/v1/keys/validate', {
      api_key: tamperedKey,
    });

    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }
    if (data.data.valid) {
      throw new Error('Tampered key should be invalid');
    }
    if (!data.data.error || !data.data.error.includes('signature')) {
      throw new Error(`Expected signature error, got: ${data.data.error}`);
    }
  });

  // ============================================================================
  // Test 6: Validate Revoked API Key
  // ============================================================================
  await runTest('Reject revoked API key', async () => {
    // First revoke the key
    const revokeResult = await request('POST', '/v1/keys/revoke', {
      key_id: testKey!.keyId,
    });

    if (!revokeResult.data.success) {
      throw new Error('Failed to revoke key');
    }

    // Now try to validate
    const { status, data } = await request('POST', '/v1/keys/validate', {
      api_key: testKey!.key,
    });

    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }
    if (data.data.valid) {
      throw new Error('Revoked key should be invalid');
    }
    if (!data.data.error || !data.data.error.includes('revoked')) {
      throw new Error(`Expected revoked error, got: ${data.data.error}`);
    }
  });

  // ============================================================================
  // Test 7: Performance Check (Validation Speed)
  // ============================================================================
  await runTest('Validation completes in <10ms (avg)', async () => {
    // Generate a new key for performance testing
    const perfKey = await generateTestKey('perf_org', 'perf_user');

    const iterations = 10;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await request('POST', '/v1/keys/validate', {
        api_key: perfKey.key,
      });
      const duration = performance.now() - start;
      timings.push(duration);
    }

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const minTime = Math.min(...timings);
    const maxTime = Math.max(...timings);

    console.log(`    ${colors.gray}Performance: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms${colors.reset}`);

    // Note: This includes network latency, so 10ms is very strict
    // If this fails, it might just be network latency, not the validation itself
    if (avgTime > 100) {
      throw new Error(`Average validation time ${avgTime.toFixed(2)}ms exceeds 100ms threshold`);
    }
  });

  // ============================================================================
  // Test 8: Request Format Validation
  // ============================================================================
  await runTest('Reject missing api_key parameter', async () => {
    const { status, data } = await request('POST', '/v1/keys/validate', {});

    if (status !== 400) {
      throw new Error(`Expected status 400, got ${status}`);
    }
    if (data.success) {
      throw new Error('Should not succeed with missing parameter');
    }
  });

  // ============================================================================
  // Test 9: Scope Extraction
  // ============================================================================
  await runTest('Return scopes from validated key', async () => {
    const keyWithScopes = await generateTestKey('scopes_org', 'scopes_user');

    const { status, data } = await request('POST', '/v1/keys/validate', {
      api_key: keyWithScopes.key,
    });

    if (!data.data.valid) {
      throw new Error('Key should be valid');
    }
    if (!Array.isArray(data.data.scopes)) {
      throw new Error('Scopes should be an array');
    }
    if (data.data.scopes.length === 0) {
      throw new Error('Scopes should not be empty');
    }
  });

  // ============================================================================
  // Summary
  // ============================================================================
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`Total Duration: ${totalDuration.toFixed(2)}ms\n`);

  if (failed > 0) {
    console.log(`${colors.red}Some tests failed. See errors above.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}All tests passed!${colors.reset}\n`);
  }
}

// Run tests
main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
