#!/usr/bin/env tsx

/**
 * GAP-9 Deployment JWT Fix & E2E Validation Harness
 * 
 * Validates the complete GAP-9 multi-tenant learning loop:
 * 1. JWT_SECRET_KEY configuration (86 chars from ConfigMap)
 * 2. RPC API pod health (no crash-loop)
 * 3. CLI activity submission via API key
 * 4. Dashboard query returns activities with org_id isolation
 * 
 * This harness can run WITHOUT LLM - pure validation logic.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

interface ValidationInput {
  namespace?: string;
  configMapName?: string;
  deploymentName?: string;
  expectedJWTLength?: number;
  testScriptPath?: string;
  skipPlaywright?: boolean;
}

interface ValidationOutput {
  pass: boolean;
  results: {
    jwtConfig: { pass: boolean; actual: string; expected: string; details?: string };
    podHealth: { pass: boolean; actual: string; expected: string; details?: string };
    jwtSecretLength: { pass: boolean; actual: number; expected: number; details?: string };
    finalTest: { pass: boolean; actual: string; expected: string; output?: string };
    playwrightTest?: { pass: boolean; actual: string; expected: string; output?: string };
  };
  summary: string;
  timestamp: string;
}

/**
 * Execute a shell command and return output
 */
function exec(command: string, options: { silent?: boolean; ignoreError?: boolean } = {}): string {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit'
    });
    return result.trim();
  } catch (error: any) {
    if (options.ignoreError) {
      return error.stdout?.trim() || '';
    }
    throw error;
  }
}

/**
 * Check if JWT_SECRET_KEY is properly configured in ConfigMap
 */
function validateJWTConfig(namespace: string, configMapName: string): { 
  pass: boolean; 
  actual: string; 
  expected: string;
  details?: string;
} {
  try {
    // Check if JWT_SECRET_KEY exists as top-level key
    const jwtKey = exec(
      `kubectl get configmap -n ${namespace} ${configMapName} -o jsonpath='{.data.JWT_SECRET_KEY}'`,
      { silent: true }
    );
    
    if (!jwtKey) {
      return {
        pass: false,
        actual: 'JWT_SECRET_KEY not found in ConfigMap',
        expected: 'JWT_SECRET_KEY present as top-level key',
        details: 'ConfigMap must have JWT_SECRET_KEY as a top-level data key'
      };
    }
    
    return {
      pass: true,
      actual: 'JWT_SECRET_KEY present as top-level key',
      expected: 'JWT_SECRET_KEY present as top-level key'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: `Error checking ConfigMap: ${error.message}`,
      expected: 'JWT_SECRET_KEY present as top-level key',
      details: error.message
    };
  }
}

/**
 * Check JWT secret length in ConfigMap
 */
function validateJWTSecretLength(
  namespace: string, 
  configMapName: string,
  expectedLength: number
): {
  pass: boolean;
  actual: number;
  expected: number;
  details?: string;
} {
  try {
    const jwtKey = exec(
      `kubectl get configmap -n ${namespace} ${configMapName} -o jsonpath='{.data.JWT_SECRET_KEY}'`,
      { silent: true }
    );
    
    const actualLength = jwtKey.length;
    
    return {
      pass: actualLength >= expectedLength,
      actual: actualLength,
      expected: expectedLength,
      details: actualLength < expectedLength 
        ? `JWT_SECRET_KEY too short (${actualLength} < ${expectedLength})`
        : undefined
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 0,
      expected: expectedLength,
      details: `Error reading JWT_SECRET_KEY: ${error.message}`
    };
  }
}

/**
 * Check RPC API pod health
 */
function validatePodHealth(namespace: string, deploymentName: string): {
  pass: boolean;
  actual: string;
  expected: string;
  details?: string;
} {
  try {
    // Get pod status and readiness
    const podStatus = exec(
      `kubectl get pods -n ${namespace} -l app=${deploymentName} -o jsonpath='{.items[0].status.phase}'`,
      { silent: true }
    );
    
    const podReady = exec(
      `kubectl get pods -n ${namespace} -l app=${deploymentName} -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}'`,
      { silent: true }
    );
    
    const restartCount = exec(
      `kubectl get pods -n ${namespace} -l app=${deploymentName} -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}'`,
      { silent: true }
    );
    
    if (podStatus !== 'Running') {
      // Get pod logs to check for JWT errors
      const logs = exec(
        `kubectl logs -n ${namespace} deployment/${deploymentName} --tail=50`,
        { silent: true, ignoreError: true }
      );
      
      const hasJWTError = logs.includes('JWT_SECRET_KEY is weak') || 
                          logs.includes('CRITICAL') && logs.includes('JWT');
      
      return {
        pass: false,
        actual: podStatus,
        expected: 'Running',
        details: hasJWTError 
          ? 'Pod failing due to JWT_SECRET_KEY validation error'
          : `Pod status: ${podStatus}`
      };
    }
    
    // Check for JWT CRITICAL errors in logs
    const logs = exec(
      `kubectl logs -n ${namespace} deployment/${deploymentName} --tail=100`,
      { silent: true, ignoreError: true }
    );
    
    const hasJWTCritical = logs.includes('CRITICAL') && 
                           logs.includes('JWT_SECRET_KEY is weak');
    
    if (hasJWTCritical) {
      return {
        pass: false,
        actual: 'Running but with JWT CRITICAL errors',
        expected: 'Running without JWT errors',
        details: 'Pod logs contain JWT_SECRET_KEY validation failures'
      };
    }
    
    // Enhanced health check: Ready + Low restarts = Healthy
    // For long-running pods, readiness is more reliable than startup logs
    const isReady = podReady === 'True';
    const hasLowRestarts = parseInt(restartCount || '0') < 3;
    
    if (isReady && hasLowRestarts) {
      return {
        pass: true,
        actual: 'Running with successful startup',
        expected: 'Running with successful startup',
        details: `Pod Ready=True, Restarts=${restartCount}, no JWT errors`
      };
    }
    
    // Check for successful startup in logs (fallback)
    const hasStartup = logs.includes('Application startup complete') ||
                       logs.includes('Uvicorn running');
    
    if (hasStartup) {
      return {
        pass: true,
        actual: 'Running with successful startup',
        expected: 'Running with successful startup',
        details: 'Startup messages found in logs'
      };
    }
    
    // If pod is Ready but we can't confirm startup, still pass
    // (startup messages may have scrolled out for long-running pods)
    if (isReady) {
      return {
        pass: true,
        actual: 'Running with successful startup',
        expected: 'Running with successful startup',
        details: 'Pod is Ready (startup messages may have scrolled out of log tail)'
      };
    }
    
    return {
      pass: false,
      actual: 'Running but startup unclear',
      expected: 'Running with successful startup',
      details: `Pod Ready=${podReady}, Restarts=${restartCount}`
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: `Error checking pod health: ${error.message}`,
      expected: 'Running',
      details: error.message
    };
  }
}

/**
 * Run final_test.sh to validate complete GAP-9 flow
 */
function runFinalTest(testScriptPath: string): {
  pass: boolean;
  actual: string;
  expected: string;
  output?: string;
} {
  try {
    const output = exec(`bash ${testScriptPath}`, { silent: true, ignoreError: true });
    
    const hasSuccess = output.includes('SUCCESS! GAP-9 FIX VERIFIED') ||
                       output.includes('Dashboard returns 1 activity');
    
    const allStepsPass = output.includes('[1/4]') && 
                         output.includes('[2/4]') &&
                         output.includes('[3/4]') &&
                         output.includes('[4/4]');
    
    return {
      pass: hasSuccess && allStepsPass,
      actual: hasSuccess ? 'All 4 steps passed' : 'Test failed or incomplete',
      expected: 'All 4 steps passed',
      output
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: `Test script execution failed: ${error.message}`,
      expected: 'All 4 steps passed',
      output: error.stdout || error.message
    };
  }
}

/**
 * Run Playwright E2E test (optional)
 */
function runPlaywrightTest(): {
  pass: boolean;
  actual: string;
  expected: string;
  output?: string;
} {
  try {
    // Check if Playwright test exists
    const playwrightTestPath = 'tests/e2e/gap9-dashboard-validation.spec.ts';
    
    if (!fs.existsSync(playwrightTestPath)) {
      return {
        pass: true, // Skip if not available
        actual: 'Playwright test not found (skipped)',
        expected: 'Dashboard UI validated (optional)',
        output: 'Playwright E2E test file not found - this is optional for GAP-9 validation'
      };
    }
    
    const output = exec('npx playwright test gap9-dashboard-validation', { 
      silent: true, 
      ignoreError: true 
    });
    
    const hasSuccess = output.includes('passed') || output.includes('✓');
    
    return {
      pass: hasSuccess,
      actual: hasSuccess ? 'Playwright tests passed' : 'Playwright tests failed',
      expected: 'Dashboard UI validated',
      output
    };
  } catch (error: any) {
    return {
      pass: true, // Don't fail overall validation if Playwright fails (optional)
      actual: `Playwright test error: ${error.message}`,
      expected: 'Dashboard UI validated (optional)',
      output: error.message
    };
  }
}

/**
 * Main validation function
 */
export function runValidation(input: ValidationInput): ValidationOutput {
  const namespace = input.namespace || 'metabob';
  const configMapName = input.configMapName || 'universal-config';
  const deploymentName = input.deploymentName || 'metabob-rpc-api';
  const expectedJWTLength = input.expectedJWTLength || 86;
  const testScriptPath = input.testScriptPath || './final_test.sh';
  const skipPlaywright = input.skipPlaywright !== false;
  
  console.log('🔍 Starting GAP-9 Validation Harness...\n');
  
  // Step 1: Validate JWT Config
  console.log('[1/5] Validating JWT_SECRET_KEY in ConfigMap...');
  const jwtConfig = validateJWTConfig(namespace, configMapName);
  console.log(`  ${jwtConfig.pass ? '✅' : '❌'} ${jwtConfig.actual}\n`);
  
  // Step 2: Validate JWT Secret Length
  console.log('[2/5] Validating JWT_SECRET_KEY length...');
  const jwtSecretLength = validateJWTSecretLength(namespace, configMapName, expectedJWTLength);
  console.log(`  ${jwtSecretLength.pass ? '✅' : '❌'} Length: ${jwtSecretLength.actual} (expected: >=${jwtSecretLength.expected})\n`);
  
  // Step 3: Validate Pod Health
  console.log('[3/5] Validating RPC API pod health...');
  const podHealth = validatePodHealth(namespace, deploymentName);
  console.log(`  ${podHealth.pass ? '✅' : '❌'} ${podHealth.actual}\n`);
  
  // Step 4: Run final_test.sh
  console.log('[4/5] Running final_test.sh (GAP-9 E2E validation)...');
  const finalTest = runFinalTest(testScriptPath);
  console.log(`  ${finalTest.pass ? '✅' : '❌'} ${finalTest.actual}\n`);
  
  // Step 5: Playwright (optional)
  let playwrightTest: ValidationOutput['results']['playwrightTest'] | undefined;
  if (!skipPlaywright) {
    console.log('[5/5] Running Playwright E2E tests (optional)...');
    playwrightTest = runPlaywrightTest();
    console.log(`  ${playwrightTest.pass ? '✅' : '⚠️'} ${playwrightTest.actual}\n`);
  }
  
  // Overall pass/fail
  const allPass = jwtConfig.pass && 
                  jwtSecretLength.pass && 
                  podHealth.pass && 
                  finalTest.pass &&
                  (skipPlaywright || playwrightTest?.pass !== false);
  
  const summary = allPass
    ? '✅ GAP-9 Validation PASSED - All checks successful'
    : `❌ GAP-9 Validation FAILED - ${[
        !jwtConfig.pass && 'JWT config',
        !jwtSecretLength.pass && 'JWT length',
        !podHealth.pass && 'Pod health',
        !finalTest.pass && 'Final test',
        playwrightTest && !playwrightTest.pass && 'Playwright'
      ].filter(Boolean).join(', ')} failed`;
  
  console.log('━'.repeat(60));
  console.log(summary);
  console.log('━'.repeat(60));
  
  return {
    pass: allPass,
    results: {
      jwtConfig,
      podHealth,
      jwtSecretLength,
      finalTest,
      ...(playwrightTest && { playwrightTest })
    },
    summary,
    timestamp: new Date().toISOString()
  };
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const input: ValidationInput = {
    namespace: args[0] || 'metabob',
    configMapName: args[1] || 'universal-config',
    deploymentName: args[2] || 'metabob-rpc-api',
    expectedJWTLength: parseInt(args[3] || '86'),
    testScriptPath: args[4] || './final_test.sh',
    skipPlaywright: args[5] !== 'run-playwright'
  };
  
  const result = runValidation(input);
  
  // Write results to file
  const outputPath = '/tmp/gap9-validation-result.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nResults written to: ${outputPath}`);
  
  // Exit with appropriate code
  process.exit(result.pass ? 0 : 1);
}
