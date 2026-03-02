/**
 * Validation Harness: Complete Async Ripple Changes for SurrealDB Official Library
 * 
 * This harness validates that all async conversions were completed correctly:
 * 1. All get_surreal_client() calls use await
 * 2. All db operation functions are async def
 * 3. All route handlers properly await db operations
 * 4. No sync/async mixing errors
 * 5. All partial updates use merge() instead of update()
 */

import * as fs from 'fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execAsync = promisify(exec);

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  errors?: string[];
  details?: string;
}

interface TestCase {
  name: string;
  validate: () => Promise<ValidationResult>;
}

const RPC_API_PATH = 'repos/metabob-rpc-api';

/**
 * Test Case 1: Static Analysis - No unawaited get_surreal_client() calls
 */
async function validateNoUnawaitedGetSurrealClient(): Promise<ValidationResult> {
  try {
    const { stdout } = await execAsync(
      `cd ${RPC_API_PATH} && grep -r "^\\s*db\\s*=\\s*get_surreal_client()" --include="*.py" server/db/operations/ server/routes/ server/cli.py || true`,
      { maxBuffer: 1024 * 1024 }
    );

    const matches = stdout.trim().split('\n').filter(line => line.length > 0);
    const expected = 0;
    const actual = matches.length;

    return {
      pass: actual === expected,
      actual: { unawaitedCalls: actual, matches: matches.slice(0, 10) },
      expected: { unawaitedCalls: expected },
      details: actual > 0 
        ? `Found ${actual} unawaited get_surreal_client() calls:\n${matches.join('\n')}`
        : 'All get_surreal_client() calls are properly awaited'
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { unawaitedCalls: 0 },
      errors: [`Static analysis failed: ${error.message}`]
    };
  }
}

/**
 * Test Case 2: All operation modules have async def signatures
 */
async function validateAsyncDefSignatures(): Promise<ValidationResult> {
  const operationModules = [
    'server/db/operations/failure_pattern.py',
    'server/db/operations/task_execution.py',
    'server/db/operations/activity_content.py',
    'server/db/operations/activity_execution.py',
    'server/db/operations/impulse_data.py',
    'server/db/operations/activity_data.py',
    'server/db/operations/impulse_learning.py',
    'server/db/operations/template_data.py',
  ];

  const expectedAsyncFunctions = [6, 5, 3, 6, 5, 5, 4, 6]; // Expected count per module
  const results: any[] = [];
  let allPass = true;

  for (let i = 0; i < operationModules.length; i++) {
    const modulePath = path.join(RPC_API_PATH, operationModules[i]);
    
    try {
      const content = await fs.readFile(modulePath, 'utf-8');
      
      // Count async def functions (exclude nested class methods)
      const asyncDefMatches = content.match(/^async def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/gm);
      const asyncDefCount = asyncDefMatches ? asyncDefMatches.length : 0;
      
      // Count sync def functions (exclude nested class methods and helper functions)
      const syncDefMatches = content.match(/^def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/gm);
      const syncDefCount = syncDefMatches ? syncDefMatches.length : 0;
      
      const expected = expectedAsyncFunctions[i];
      const pass = asyncDefCount === expected && syncDefCount <= 2; // Allow up to 2 helper functions
      
      results.push({
        module: operationModules[i],
        asyncFunctions: asyncDefCount,
        syncFunctions: syncDefCount,
        expected: expected,
        pass: pass
      });
      
      if (!pass) allPass = false;
    } catch (error) {
      results.push({
        module: operationModules[i],
        error: error.message,
        pass: false
      });
      allPass = false;
    }
  }

  return {
    pass: allPass,
    actual: results,
    expected: { allModulesAsync: true, expectedCounts: expectedAsyncFunctions },
    details: allPass 
      ? 'All operation modules have correct async def signatures'
      : `Some modules have incorrect async signatures:\n${JSON.stringify(results.filter(r => !r.pass), null, 2)}`
  };
}

/**
 * Test Case 3: Verify route handlers properly await db operations
 */
async function validateRouteHandlersAwait(): Promise<ValidationResult> {
  try {
    const routesPath = path.join(RPC_API_PATH, 'server/routes/activity.py');
    const content = await fs.readFile(routesPath, 'utf-8');

    // Check for specific patterns that should have await
    const patterns = [
      { pattern: /await\s+get_metrics\(/g, name: 'await get_metrics()' },
      { pattern: /await\s+create_metrics\(/g, name: 'await create_metrics()' },
      { pattern: /await\s+get_surreal_client\(/g, name: 'await get_surreal_client()' },
      { pattern: /await\s+db\.(merge|query|select|create|update|delete)\(/g, name: 'await db operations' },
      { pattern: /await\s+insert_task_execution\(/g, name: 'await insert_task_execution()' },
    ];

    const results = patterns.map(({ pattern, name }) => {
      const matches = content.match(pattern);
      return {
        pattern: name,
        found: matches ? matches.length : 0,
        pass: matches && matches.length > 0
      };
    });

    const allPass = results.every(r => r.pass);

    return {
      pass: allPass,
      actual: results,
      expected: { allPatternsFound: true },
      details: allPass
        ? 'All route handlers properly await db operations'
        : `Missing await keywords in route handlers:\n${JSON.stringify(results.filter(r => !r.pass), null, 2)}`
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { allPatternsFound: true },
      errors: [`Route handler validation failed: ${error.message}`]
    };
  }
}

/**
 * Test Case 4: CLI commands use asyncio.run() wrapper
 */
async function validateCliAsyncioWrapper(): Promise<ValidationResult> {
  try {
    const cliPath = path.join(RPC_API_PATH, 'server/cli.py');
    const content = await fs.readFile(cliPath, 'utf-8');

    // Check for asyncio.run() usage in CLI commands
    const asyncioRunMatches = content.match(/asyncio\.run\(/g);
    const asyncioRunCount = asyncioRunMatches ? asyncioRunMatches.length : 0;

    // We expect at least 8 asyncio.run() calls (3 commands × ~3-4 db calls each)
    const expected = { minAsyncioRunCalls: 8 };
    const actual = { asyncioRunCount };
    const pass = asyncioRunCount >= expected.minAsyncioRunCalls;

    return {
      pass,
      actual,
      expected,
      details: pass
        ? `CLI commands properly use asyncio.run() wrapper (${asyncioRunCount} calls)`
        : `CLI commands missing asyncio.run() wrapper: found ${asyncioRunCount}, expected >= ${expected.minAsyncioRunCalls}`
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { minAsyncioRunCalls: 8 },
      errors: [`CLI validation failed: ${error.message}`]
    };
  }
}

/**
 * Test Case 5: Verify merge() is used instead of update() for partial updates
 */
async function validateMergeInsteadOfUpdate(): Promise<ValidationResult> {
  try {
    const filesToCheck = [
      'server/db/operations/failure_pattern.py',
      'server/db/operations/task_execution.py',
      'server/db/operations/template_data.py',
      'server/routes/activity.py',
    ];

    const results: any[] = [];
    let allPass = true;

    for (const file of filesToCheck) {
      const filePath = path.join(RPC_API_PATH, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for db.update() usage (should be minimal or in specific contexts)
      const updateMatches = content.match(/db\.update\(/g);
      const updateCount = updateMatches ? updateMatches.length : 0;

      // Check for db.merge() usage (should be present for partial updates)
      const mergeMatches = content.match(/db\.merge\(/g);
      const mergeCount = mergeMatches ? mergeMatches.length : 0;

      const pass = mergeCount > 0 || updateCount === 0;

      results.push({
        file,
        updateCalls: updateCount,
        mergeCalls: mergeCount,
        pass
      });

      if (!pass) allPass = false;
    }

    return {
      pass: allPass,
      actual: results,
      expected: { allFilesUseMerge: true },
      details: allPass
        ? 'All files properly use merge() for partial updates'
        : `Some files still use update() instead of merge():\n${JSON.stringify(results.filter(r => !r.pass), null, 2)}`
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: error.message },
      expected: { allFilesUseMerge: true },
      errors: [`merge() validation failed: ${error.message}`]
    };
  }
}

/**
 * Test Case 6: Python compilation check
 */
async function validatePythonCompilation(): Promise<ValidationResult> {
  const filesToCompile = [
    'server/db/operations/failure_pattern.py',
    'server/db/operations/task_execution.py',
    'server/db/operations/activity_content.py',
    'server/db/operations/activity_execution.py',
    'server/db/operations/impulse_data.py',
    'server/db/operations/activity_data.py',
    'server/db/operations/impulse_learning.py',
    'server/db/operations/template_data.py',
    'server/routes/activity.py',
    'server/cli.py',
  ];

  const results: any[] = [];
  let allPass = true;

  for (const file of filesToCompile) {
    try {
      const { stdout, stderr } = await execAsync(
        `cd ${RPC_API_PATH} && python -m py_compile ${file}`,
        { maxBuffer: 1024 * 1024 }
      );

      results.push({
        file,
        pass: true,
        stdout: stdout.trim() || 'OK',
        stderr: stderr.trim() || ''
      });
    } catch (error) {
      results.push({
        file,
        pass: false,
        error: error.message
      });
      allPass = false;
    }
  }

  return {
    pass: allPass,
    actual: results,
    expected: { allFilesCompile: true },
    details: allPass
      ? 'All Python files compile successfully'
      : `Some files failed to compile:\n${JSON.stringify(results.filter(r => !r.pass), null, 2)}`
  };
}

/**
 * Main validation function
 */
export async function runValidation(input?: any): Promise<ValidationResult> {
  const testCases: TestCase[] = [
    { name: 'No unawaited get_surreal_client() calls', validate: validateNoUnawaitedGetSurrealClient },
    { name: 'All operation modules have async def', validate: validateAsyncDefSignatures },
    { name: 'Route handlers properly await db operations', validate: validateRouteHandlersAwait },
    { name: 'CLI commands use asyncio.run() wrapper', validate: validateCliAsyncioWrapper },
    { name: 'merge() used instead of update()', validate: validateMergeInsteadOfUpdate },
    { name: 'Python compilation check', validate: validatePythonCompilation },
  ];

  const results: any[] = [];
  let overallPass = true;

  console.log('🔍 Running validation harness for: Complete Async Ripple Changes for SurrealDB Official Library\n');

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    const result = await testCase.validate();
    
    console.log(result.pass ? '✅ PASS' : '❌ FAIL');
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.errors) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }

    results.push({
      testCase: testCase.name,
      ...result
    });

    if (!result.pass) overallPass = false;
  }

  console.log('\n' + '='.repeat(80));
  console.log(overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  console.log('='.repeat(80));

  return {
    pass: overallPass,
    actual: {
      testResults: results,
      totalTests: testCases.length,
      passed: results.filter(r => r.pass).length,
      failed: results.filter(r => !r.pass).length
    },
    expected: {
      allTestsPass: true,
      totalTests: testCases.length,
      passed: testCases.length,
      failed: 0
    }
  };
}

// Allow running as a standalone script
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  runValidation().then(result => {
    if (typeof process !== 'undefined') {
      process.exit(result.pass ? 0 : 1);
    }
  }).catch((error: Error) => {
    console.error('Validation harness failed:', error);
    if (typeof process !== 'undefined') {
      process.exit(1);
    }
  });
}
