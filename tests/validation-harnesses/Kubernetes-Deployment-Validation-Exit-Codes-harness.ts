#!/usr/bin/env ts-node
/**
 * Validation Harness: Kubernetes-Deployment-Validation-Exit-Codes
 * 
 * Purpose: Validate that repos/platform/scripts/validate-local-deployment.sh 
 *          returns correct exit codes based on deployment health
 * 
 * Specification:
 * - Script MUST return exit code 0 when deployment is healthy (all pods Running, all services have endpoints)
 * - Script MUST return exit code 1 when deployment has failures (pods in CrashLoopBackOff/ImagePullBackOff, services without endpoints)
 * - Output MUST contain "✅ VALIDATION PASSED" on success
 * - Output MUST contain "❌ VALIDATION FAILED" on failure
 * 
 * Test Strategy:
 * 1. Run validation script and capture exit code
 * 2. Capture stdout/stderr output
 * 3. Check current deployment state (pods, services)
 * 4. Verify exit code matches deployment health
 * 5. Verify output messages match exit code
 * 
 * Returns: PASS/FAIL without LLM interaction
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface ValidationResult {
  pass: boolean;
  actual: {
    exitCode: number;
    output: string;
    podsNotReady: number;
    totalPods: number;
    servicesWithoutEndpoints: number;
    totalServices: number;
    containsPassMessage: boolean;
    containsFailMessage: boolean;
  };
  expected: {
    exitCode: number;
    shouldDetectFailures: boolean;
    outputPattern: string;
    minPodsExpected: number;
  };
  errors: string[];
  summary: string;
}

interface TestCase {
  id: string;
  description: string;
  input: {
    scriptPath: string;
    deploymentState: 'healthy' | 'unhealthy' | 'current';
  };
  expectedOutput: {
    exitCode: number;
    shouldDetectFailures: boolean;
    outputPattern: string;
    minPodsExpected: number;
  };
}

// Utility functions
function executeCommand(command: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = spawnSync('bash', ['-c', command], {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 60000, // 60 seconds
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.status ?? 255
    };
  } catch (error: any) {
    return {
      stdout: '',
      stderr: error.message || 'Command execution failed',
      exitCode: 255
    };
  }
}

function getDeploymentState(): {
  podsNotReady: number;
  totalPods: number;
  servicesWithoutEndpoints: number;
  totalServices: number;
  podDetails: string[];
} {
  // Get pod status
  const podsResult = executeCommand('kubectl get pods -n metabob --no-headers 2>/dev/null || echo ""');
  const podLines = podsResult.stdout.split('\n').filter(line => line.trim());
  const totalPods = podLines.length;
  const podsNotReady = podLines.filter(line => !line.includes('Running') && !line.includes('Completed')).length;
  const podDetails = podLines.map(line => {
    const parts = line.split(/\s+/);
    return `${parts[0]}: ${parts[2]}`;
  });

  // Get service endpoints
  const endpointsResult = executeCommand('kubectl get endpoints -n metabob --no-headers 2>/dev/null || echo ""');
  const endpointLines = endpointsResult.stdout.split('\n').filter(line => line.trim());
  const totalServices = endpointLines.length;
  const servicesWithoutEndpoints = endpointLines.filter(line => line.includes('<none>')).length;

  return {
    podsNotReady,
    totalPods,
    servicesWithoutEndpoints,
    totalServices,
    podDetails
  };
}

// Main validation function
export function runValidation(testCase: TestCase): ValidationResult {
  const errors: string[] = [];
  
  console.log(`\n🧪 Running test case: ${testCase.id}`);
  console.log(`   Description: ${testCase.description}`);
  
  // Step 1: Get current deployment state
  console.log('\n1️⃣  Checking current deployment state...');
  const deploymentState = getDeploymentState();
  
  console.log(`   Total pods: ${deploymentState.totalPods}`);
  console.log(`   Pods not ready: ${deploymentState.podsNotReady}`);
  console.log(`   Total services: ${deploymentState.totalServices}`);
  console.log(`   Services without endpoints: ${deploymentState.servicesWithoutEndpoints}`);
  
  if (deploymentState.podDetails.length > 0) {
    console.log('   Pod details:');
    deploymentState.podDetails.forEach(detail => console.log(`     - ${detail}`));
  }
  
  // Step 2: Run validation script
  console.log('\n2️⃣  Running validation script...');
  const scriptPath = path.resolve(process.cwd(), testCase.input.scriptPath);
  
  if (!fs.existsSync(scriptPath)) {
    errors.push(`Script not found: ${scriptPath}`);
    return {
      pass: false,
      actual: {
        exitCode: -1,
        output: '',
        podsNotReady: deploymentState.podsNotReady,
        totalPods: deploymentState.totalPods,
        servicesWithoutEndpoints: deploymentState.servicesWithoutEndpoints,
        totalServices: deploymentState.totalServices,
        containsPassMessage: false,
        containsFailMessage: false
      },
      expected: testCase.expectedOutput,
      errors,
      summary: `FAILED: Script not found at ${scriptPath}`
    };
  }
  
  const scriptResult = executeCommand(scriptPath);
  const output = scriptResult.stdout + scriptResult.stderr;
  
  console.log(`   Exit code: ${scriptResult.exitCode}`);
  console.log(`   Output length: ${output.length} characters`);
  
  // Step 3: Analyze output
  console.log('\n3️⃣  Analyzing output...');
  const containsPassMessage = output.includes('✅ VALIDATION PASSED');
  const containsFailMessage = output.includes('❌ VALIDATION FAILED');
  
  console.log(`   Contains "✅ VALIDATION PASSED": ${containsPassMessage}`);
  console.log(`   Contains "❌ VALIDATION FAILED": ${containsFailMessage}`);
  
  // Step 4: Determine expected exit code based on deployment state
  const hasFailures = deploymentState.podsNotReady > 0 || deploymentState.servicesWithoutEndpoints > 0;
  const expectedExitCode = hasFailures ? 1 : 0;
  const expectedMessage = hasFailures ? '❌ VALIDATION FAILED' : '✅ VALIDATION PASSED';
  
  console.log(`\n4️⃣  Expected behavior:`);
  console.log(`   Has failures: ${hasFailures}`);
  console.log(`   Expected exit code: ${expectedExitCode}`);
  console.log(`   Expected message: ${expectedMessage}`);
  
  // Step 5: Validate results
  console.log('\n5️⃣  Validating results...');
  
  // Check exit code
  if (scriptResult.exitCode !== expectedExitCode) {
    errors.push(`Exit code mismatch: expected ${expectedExitCode}, got ${scriptResult.exitCode}`);
  } else {
    console.log(`   ✅ Exit code correct: ${scriptResult.exitCode}`);
  }
  
  // Check output message
  if (hasFailures && !containsFailMessage) {
    errors.push(`Output should contain "❌ VALIDATION FAILED" when deployment has failures`);
  } else if (!hasFailures && !containsPassMessage) {
    errors.push(`Output should contain "✅ VALIDATION PASSED" when deployment is healthy`);
  } else {
    console.log(`   ✅ Output message correct`);
  }
  
  // Check that both messages don't appear simultaneously
  if (containsPassMessage && containsFailMessage) {
    errors.push(`Output contains both PASS and FAIL messages - this should not happen`);
  }
  
  // Verify minimum pods exist
  if (deploymentState.totalPods < testCase.expectedOutput.minPodsExpected) {
    errors.push(`Expected at least ${testCase.expectedOutput.minPodsExpected} pods, found ${deploymentState.totalPods}`);
  } else {
    console.log(`   ✅ Minimum pod count satisfied: ${deploymentState.totalPods} >= ${testCase.expectedOutput.minPodsExpected}`);
  }
  
  // Step 6: Final result
  const pass = errors.length === 0;
  const summary = pass 
    ? `PASSED: Validation script correctly returned exit code ${scriptResult.exitCode} for ${hasFailures ? 'unhealthy' : 'healthy'} deployment`
    : `FAILED: ${errors.join('; ')}`;
  
  console.log(`\n📊 Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   ${summary}`);
  
  return {
    pass,
    actual: {
      exitCode: scriptResult.exitCode,
      output: output.substring(0, 1000), // Truncate for readability
      podsNotReady: deploymentState.podsNotReady,
      totalPods: deploymentState.totalPods,
      servicesWithoutEndpoints: deploymentState.servicesWithoutEndpoints,
      totalServices: deploymentState.totalServices,
      containsPassMessage,
      containsFailMessage
    },
    expected: {
      exitCode: expectedExitCode,
      shouldDetectFailures: hasFailures,
      outputPattern: expectedMessage,
      minPodsExpected: testCase.expectedOutput.minPodsExpected
    },
    errors,
    summary
  };
}

// CLI execution
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Validation Harness: Kubernetes-Deployment-Validation-Exit-Codes');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Load test cases
  const testCasesPath = path.join(process.cwd(), 'tests/validation-harnesses/test-cases', 'kubernetes-deployment-validation-exit-codes-cases.json');
  
  let testCases: TestCase[];
  if (fs.existsSync(testCasesPath)) {
    testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
    console.log(`📋 Loaded ${testCases.length} test cases from ${testCasesPath}\n`);
  } else {
    // Default test case if file doesn't exist
    console.log('⚠️  Test cases file not found, using default test case\n');
    testCases = [
      {
        id: 'validation-Kubernetes-Deployment-Validation-Exit-Codes-case-1',
        description: 'Verify script returns exit code 1 when deployment has failures (current state with CrashLoopBackOff and ImagePullBackOff)',
        input: {
          scriptPath: 'repos/platform/scripts/validate-local-deployment.sh',
          deploymentState: 'current'
        },
        expectedOutput: {
          exitCode: 1,
          shouldDetectFailures: true,
          outputPattern: '❌ VALIDATION FAILED',
          minPodsExpected: 1
        }
      }
    ];
  }
  
  // Run all test cases
  const results: ValidationResult[] = [];
  let passCount = 0;
  let failCount = 0;
  
  for (const testCase of testCases) {
    const result = runValidation(testCase);
    results.push(result);
    
    if (result.pass) {
      passCount++;
    } else {
      failCount++;
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passCount} ✅`);
  console.log(`Failed: ${failCount} ❌`);
  console.log(`Success rate: ${((passCount / testCases.length) * 100).toFixed(1)}%`);
  
  // Write results to file
  const outputPath = path.join(process.cwd(), 'tests/validation-harnesses/validation-results-kubernetes-deployment-validation-exit-codes.json');
  fs.writeFileSync(outputPath, JSON.stringify({ testCases, results, summary: { total: testCases.length, passed: passCount, failed: failCount } }, null, 2));
  console.log(`\n📄 Results written to: ${outputPath}`);
  
  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run main if this is the entry point
if (require.main === module) {
  main();
}
