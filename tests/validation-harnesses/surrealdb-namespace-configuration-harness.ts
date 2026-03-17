#!/usr/bin/env ts-node
/**
 * Validation Harness: SurrealDB Namespace Configuration
 * 
 * Validates that Activity API correctly connects to SurrealDB in the 
 * activity-system namespace and can successfully query templates.
 * 
 * Strategy:
 * 1. Check Kubernetes ConfigMap has correct namespace configuration
 * 2. Port-forward Activity API service to localhost:8080
 * 3. Call /v2/activities/templates endpoint and verify HTTP 200
 * 4. Check pod logs for successful connection (no auth errors)
 * 5. Verify queries execute in correct namespace (activity-system.learning_loop)
 * 
 * Usage:
 *   ts-node tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts
 * 
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation failed
 *   2 - Setup error (K8s not accessible, pod not ready, etc.)
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as http from 'http';

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

interface TestCase {
  name: string;
  description: string;
  expectedOutput: any;
  validate: () => Promise<ValidationResult>;
}

/**
 * Execute shell command and return output
 */
function exec(command: string, options?: { silent?: boolean }): string {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8',
      stdio: options?.silent ? 'pipe' : 'inherit'
    });
    return result.trim();
  } catch (error: any) {
    if (error.stdout) {
      return error.stdout.toString().trim();
    }
    throw error;
  }
}

/**
 * Check if kubectl is available and cluster is accessible
 */
function checkKubectlAccess(): ValidationResult {
  try {
    exec('kubectl cluster-info', { silent: true });
    return {
      pass: true,
      actual: 'kubectl accessible',
      expected: 'kubectl accessible'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'kubectl not accessible',
      expected: 'kubectl accessible',
      error: error.message
    };
  }
}

/**
 * Check if Activity API pod is running in activity-system namespace
 */
function checkPodRunning(): ValidationResult {
  try {
    const output = exec(
      'kubectl get pods -n activity-system -l app=metabob-activity-api -o jsonpath="{.items[0].status.phase}"',
      { silent: true }
    );
    
    const isRunning = output === 'Running';
    return {
      pass: isRunning,
      actual: output,
      expected: 'Running',
      details: isRunning ? 'Pod is running' : 'Pod is not in Running state'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Pod not found',
      expected: 'Running',
      error: error.message
    };
  }
}

/**
 * Test Case 1: Verify ConfigMap has correct namespace
 */
async function testConfigMapNamespace(): Promise<ValidationResult> {
  try {
    const output = exec(
      'kubectl get configmap -n activity-system -l app=metabob-activity-api -o yaml 2>/dev/null | grep -A5 surrealdb | grep namespace || echo "NOT_FOUND"',
      { silent: true }
    );
    
    const hasActivitySystem = output.includes('activity-system');
    const hasMetabob = output.includes('"metabob"') || output.includes('namespace: metabob');
    
    if (output === 'NOT_FOUND' || output === '') {
      return {
        pass: false,
        actual: 'ConfigMap not found or no surrealdb namespace config',
        expected: 'namespace: "activity-system"',
        error: 'ConfigMap might not be deployed yet'
      };
    }
    
    return {
      pass: hasActivitySystem && !hasMetabob,
      actual: output,
      expected: 'namespace: "activity-system"',
      details: hasMetabob 
        ? 'FAIL: Still using legacy "metabob" namespace' 
        : 'PASS: Using correct "activity-system" namespace'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Error checking ConfigMap',
      expected: 'namespace: "activity-system"',
      error: error.message
    };
  }
}

/**
 * Test Case 2: Verify pod environment variable
 */
async function testPodEnvironment(): Promise<ValidationResult> {
  try {
    const output = exec(
      'kubectl exec -n activity-system deployment/metabob-activity-api -- env | grep SURREALDB_NAMESPACE',
      { silent: true }
    );
    
    const expectedValue = 'SURREALDB_NAMESPACE=activity-system';
    const isCorrect = output === expectedValue;
    
    return {
      pass: isCorrect,
      actual: output,
      expected: expectedValue,
      details: isCorrect 
        ? 'PASS: Correct namespace in environment' 
        : 'FAIL: Wrong namespace in environment'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Error reading pod environment',
      expected: 'SURREALDB_NAMESPACE=activity-system',
      error: error.message
    };
  }
}

/**
 * Test Case 3: Check pod logs for successful connection
 */
async function testPodLogs(): Promise<ValidationResult> {
  try {
    const logs = exec(
      'kubectl logs -n activity-system deployment/metabob-activity-api --tail=100 2>/dev/null',
      { silent: true }
    );
    
    const hasConnectionSuccess = logs.includes('Connected to SurrealDB successfully');
    const hasAuthError = logs.includes('authentication problem') || logs.includes('Failed to connect');
    const hasNamespaceError = logs.includes('Cannot access namespace');
    
    if (hasAuthError || hasNamespaceError) {
      return {
        pass: false,
        actual: 'Connection failed with error in logs',
        expected: 'Connected to SurrealDB successfully',
        error: hasAuthError ? 'Authentication error found' : 'Namespace access error found',
        details: logs.split('\n').filter(line => 
          line.includes('error') || line.includes('Error') || line.includes('failed')
        ).join('\n')
      };
    }
    
    return {
      pass: hasConnectionSuccess,
      actual: hasConnectionSuccess ? 'Connection successful' : 'Connection not confirmed',
      expected: 'Connected to SurrealDB successfully',
      details: hasConnectionSuccess 
        ? 'PASS: SurrealDB connection established' 
        : 'WARNING: No connection success message in recent logs'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Error reading logs',
      expected: 'Connected to SurrealDB successfully',
      error: error.message
    };
  }
}

/**
 * Test Case 4: Port-forward and test /v2/activities/templates endpoint
 */
async function testTemplatesEndpoint(): Promise<ValidationResult> {
  let portForwardProcess: ChildProcess | null = null;
  
  try {
    // Start port-forward in background
    portForwardProcess = spawn('kubectl', [
      'port-forward',
      '-n', 'activity-system',
      'svc/metabob-activity-api',
      '8080:8080'
    ], {
      stdio: 'pipe'
    });
    
    // Wait for port-forward to be ready (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Make HTTP request to templates endpoint
    const result = await new Promise<ValidationResult>((resolve) => {
      const req = http.get('http://localhost:8080/v2/activities/templates', (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const statusCode = res.statusCode || 0;
            const isSuccess = statusCode === 200;
            
            let parsedData: any;
            try {
              parsedData = JSON.parse(data);
            } catch {
              parsedData = data;
            }
            
            resolve({
              pass: isSuccess,
              actual: {
                statusCode,
                response: parsedData
              },
              expected: {
                statusCode: 200,
                response: 'JSON with templates array'
              },
              details: isSuccess 
                ? `PASS: HTTP ${statusCode} - Templates endpoint working`
                : `FAIL: HTTP ${statusCode} - ${data.substring(0, 200)}`
            });
          } catch (error: any) {
            resolve({
              pass: false,
              actual: 'Error parsing response',
              expected: { statusCode: 200 },
              error: error.message
            });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({
          pass: false,
          actual: 'Connection refused',
          expected: { statusCode: 200 },
          error: error.message,
          details: 'Could not connect to localhost:8080 - port-forward may have failed'
        });
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({
          pass: false,
          actual: 'Request timeout',
          expected: { statusCode: 200 },
          error: 'Request timed out after 5 seconds'
        });
      });
    });
    
    return result;
    
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Error testing endpoint',
      expected: { statusCode: 200 },
      error: error.message
    };
  } finally {
    // Clean up port-forward process
    if (portForwardProcess) {
      portForwardProcess.kill();
    }
  }
}

/**
 * Test Case 5: Verify namespace in pod logs (implicit verification)
 */
async function testNamespaceInLogs(): Promise<ValidationResult> {
  try {
    const logs = exec(
      'kubectl logs -n activity-system deployment/metabob-activity-api --tail=200 2>/dev/null',
      { silent: true }
    );
    
    // Look for namespace mentions in logs
    const hasActivitySystemMention = logs.includes('namespace":"activity-system"') || 
                                      logs.includes('namespace: activity-system');
    const hasMetabobMention = logs.includes('namespace":"metabob"') || 
                               logs.includes('namespace: metabob');
    
    // Check for successful verification message
    const hasVerified = logs.includes('"verified":true') || logs.includes('verified: true');
    
    return {
      pass: hasActivitySystemMention && !hasMetabobMention && hasVerified,
      actual: {
        hasActivitySystem: hasActivitySystemMention,
        hasMetabob: hasMetabobMention,
        hasVerified: hasVerified
      },
      expected: {
        hasActivitySystem: true,
        hasMetabob: false,
        hasVerified: true
      },
      details: hasMetabobMention 
        ? 'FAIL: Logs show "metabob" namespace usage'
        : hasVerified
        ? 'PASS: Namespace verified as activity-system'
        : 'WARNING: Could not confirm namespace verification in logs'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Error reading logs',
      expected: 'Namespace verified in logs',
      error: error.message
    };
  }
}

/**
 * Main validation runner
 */
async function runValidation(): Promise<void> {
  console.log('='.repeat(80));
  console.log('Validation Harness: SurrealDB Namespace Configuration');
  console.log('='.repeat(80));
  console.log();
  
  // Pre-flight checks
  console.log('Pre-flight Checks:');
  console.log('-'.repeat(80));
  
  const kubectlCheck = checkKubectlAccess();
  console.log(`✓ kubectl access: ${kubectlCheck.pass ? 'PASS' : 'FAIL'}`);
  if (!kubectlCheck.pass) {
    console.error(`ERROR: ${kubectlCheck.error}`);
    process.exit(2);
  }
  
  const podCheck = checkPodRunning();
  console.log(`✓ Pod running: ${podCheck.pass ? 'PASS' : 'FAIL'} (${podCheck.actual})`);
  if (!podCheck.pass) {
    console.error(`ERROR: ${podCheck.error || podCheck.details}`);
    process.exit(2);
  }
  
  console.log();
  
  // Test cases
  const testCases: TestCase[] = [
    {
      name: 'ConfigMap Namespace',
      description: 'Verify Helm-deployed ConfigMap has namespace: "activity-system"',
      expectedOutput: { namespace: 'activity-system' },
      validate: testConfigMapNamespace
    },
    {
      name: 'Pod Environment Variable',
      description: 'Verify SURREALDB_NAMESPACE=activity-system in pod',
      expectedOutput: { envVar: 'SURREALDB_NAMESPACE=activity-system' },
      validate: testPodEnvironment
    },
    {
      name: 'Connection Success in Logs',
      description: 'Verify no authentication/connection errors in pod logs',
      expectedOutput: { message: 'Connected to SurrealDB successfully' },
      validate: testPodLogs
    },
    {
      name: 'Templates Endpoint HTTP 200',
      description: 'Verify /v2/activities/templates returns 200 (not 500)',
      expectedOutput: { statusCode: 200 },
      validate: testTemplatesEndpoint
    },
    {
      name: 'Namespace Verification in Logs',
      description: 'Verify logs show activity-system namespace with verified:true',
      expectedOutput: { namespace: 'activity-system', verified: true },
      validate: testNamespaceInLogs
    }
  ];
  
  console.log('Running Test Cases:');
  console.log('-'.repeat(80));
  
  let allPassed = true;
  const results: Array<{ name: string; result: ValidationResult }> = [];
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`  Description: ${testCase.description}`);
    
    const result = await testCase.validate();
    results.push({ name: testCase.name, result });
    
    console.log(`  Status: ${result.pass ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Expected: ${JSON.stringify(result.expected)}`);
    console.log(`  Actual: ${JSON.stringify(result.actual)}`);
    
    if (result.details) {
      console.log(`  Details: ${result.details}`);
    }
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    
    if (!result.pass) {
      allPassed = false;
    }
  }
  
  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('Validation Summary');
  console.log('='.repeat(80));
  
  const passCount = results.filter(r => r.result.pass).length;
  const failCount = results.filter(r => !r.result.pass).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log();
  
  if (allPassed) {
    console.log('✓ ALL VALIDATIONS PASSED');
    console.log('SurrealDB namespace configuration is correct.');
    process.exit(0);
  } else {
    console.log('✗ VALIDATION FAILED');
    console.log('SurrealDB namespace configuration has issues.');
    console.log();
    console.log('Failed Tests:');
    results.filter(r => !r.result.pass).forEach(r => {
      console.log(`  - ${r.name}`);
    });
    process.exit(1);
  }
}

// Export for programmatic use
export { runValidation, ValidationResult };

// Run if called directly
if (require.main === module) {
  runValidation().catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}
