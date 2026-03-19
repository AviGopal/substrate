/**
 * Run WebSocket Real-Time Dashboard Updates Validation
 * 
 * This script runs the validation harness and captures results.
 */

import { runValidation, runMultiClientValidation, TEST_CASES } from './tests/validation-harnesses/websocket-real-time-dashboard-updates-harness';

interface ValidationSummary {
  specificationName: string;
  validationResults: Array<{
    testCase: string;
    status: 'PASS' | 'FAIL';
    actual: any;
    expected: any;
    difference?: string;
    duration: number;
    details: string;
  }>;
  overallStatus: 'PASS' | 'FAIL';
  timestamp: string;
  totalDuration: number;
}

async function main() {
  console.log('================================================================================');
  console.log('WebSocket Real-Time Dashboard Updates - Validation Execution');
  console.log('================================================================================\n');

  const startTime = Date.now();
  const results: ValidationSummary['validationResults'] = [];

  // Test Case 1: Success Execution
  console.log('\n[Test Case 1] Running success execution validation...\n');
  try {
    const testCase = TEST_CASES.successCase;
    const result = await runValidation(testCase);
    
    results.push({
      testCase: 'validation-WebSocket-Real-Time-Dashboard-Updates-case-1',
      status: result.pass ? 'PASS' : 'FAIL',
      actual: result.actual,
      expected: result.expected,
      difference: result.pass ? undefined : result.details,
      duration: result.duration,
      details: result.details,
    });

    console.log(`\n[Test Case 1] ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Details: ${result.details}`);
  } catch (error: any) {
    console.error(`\n[Test Case 1] ❌ EXCEPTION: ${error.message}`);
    results.push({
      testCase: 'validation-WebSocket-Real-Time-Dashboard-Updates-case-1',
      status: 'FAIL',
      actual: { error: error.message },
      expected: { pass: true },
      difference: `Exception thrown: ${error.message}`,
      duration: 0,
      details: `Exception: ${error.message}\nStack: ${error.stack}`,
    });
  }

  // Test Case 2: Failure Execution
  console.log('\n[Test Case 2] Running failure execution validation...\n');
  try {
    const testCase = TEST_CASES.failureCase;
    const result = await runValidation(testCase);
    
    results.push({
      testCase: 'validation-WebSocket-Real-Time-Dashboard-Updates-case-2',
      status: result.pass ? 'PASS' : 'FAIL',
      actual: result.actual,
      expected: result.expected,
      difference: result.pass ? undefined : result.details,
      duration: result.duration,
      details: result.details,
    });

    console.log(`\n[Test Case 2] ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Details: ${result.details}`);
  } catch (error: any) {
    console.error(`\n[Test Case 2] ❌ EXCEPTION: ${error.message}`);
    results.push({
      testCase: 'validation-WebSocket-Real-Time-Dashboard-Updates-case-2',
      status: 'FAIL',
      actual: { error: error.message },
      expected: { pass: true },
      difference: `Exception thrown: ${error.message}`,
      duration: 0,
      details: `Exception: ${error.message}\nStack: ${error.stack}`,
    });
  }

  // Multi-Client Test
  console.log('\n[Multi-Client Test] Running multi-client validation...\n');
  try {
    const testCase = TEST_CASES.successCase;
    const result = await runMultiClientValidation(testCase);
    
    results.push({
      testCase: 'validation-WebSocket-Real-Time-Dashboard-Updates-multi-client',
      status: result.pass ? 'PASS' : 'FAIL',
      actual: result.actual,
      expected: result.expected,
      difference: result.pass ? undefined : result.details,
      duration: result.duration,
      details: result.details,
    });

    console.log(`\n[Multi-Client Test] ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Details: ${result.details}`);
  } catch (error: any) {
    console.error(`\n[Multi-Client Test] ❌ EXCEPTION: ${error.message}`);
    results.push({
      testCase: 'validation-WebSocket-Real-Time-Dashboard-Updates-multi-client',
      status: 'FAIL',
      actual: { error: error.message },
      expected: { pass: true },
      difference: `Exception thrown: ${error.message}`,
      duration: 0,
      details: `Exception: ${error.message}\nStack: ${error.stack}`,
    });
  }

  const totalDuration = Date.now() - startTime;
  const overallStatus = results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL';

  const summary: ValidationSummary = {
    specificationName: 'WebSocket-Real-Time-Dashboard-Updates',
    validationResults: results,
    overallStatus,
    timestamp: new Date().toISOString(),
    totalDuration,
  };

  // Write results to file
  const resultsFile = 'VALIDATION_RESULTS_WebSocket-Real-Time-Dashboard-Updates.json';
  const fs = await import('fs/promises');
  await fs.writeFile(resultsFile, JSON.stringify(summary, null, 2));

  console.log('\n================================================================================');
  console.log('Validation Summary');
  console.log('================================================================================');
  console.log(`Overall Status: ${overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.status === 'PASS').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'FAIL').length}`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Results saved to: ${resultsFile}`);
  console.log('================================================================================\n');

  // Return results for programmatic usage
  return summary;
}

if (typeof process !== 'undefined' && require.main === module) {
  main()
    .then((summary) => {
      process.exit(summary.overallStatus === 'PASS' ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error running validation:', error);
      process.exit(1);
    });
}

export { main as runValidationTests };
