#!/usr/bin/env ts-node
/**
 * Validation Harness: SurrealDB v3.0.0 Authentication
 * 
 * Validates that Activity API successfully authenticates to SurrealDB v3.0.0
 * using proper scope-based credentials (NS/DB parameters in signin).
 * 
 * Strategy:
 * 1. Port-forward Activity API to localhost:8080
 * 2. Call GET /v2/activities/templates expecting HTTP 200 (not 500)
 * 3. Check Activity API logs for successful SurrealDB connection (no auth errors)
 * 4. Verify SurrealDB accepts connections (check server logs)
 * 5. Test direct SurrealDB connection with kubectl exec
 * 
 * Usage:
 *   ts-node tests/validation-harnesses/surrealdb-v3-authentication-harness.ts
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
 * Execute async shell command with timeout
 */
function execAsync(command: string, timeoutMs: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const result = execSync(command, { 
        encoding: 'utf-8',
        timeout: timeoutMs
      });
      clearTimeout(timeout);
      resolve(result.trim());
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.stdout) {
        resolve(error.stdout.toString().trim());
      } else {
        reject(error);
      }
    }
  });
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
 * Check if Activity API pod is running
 */
function checkActivityApiPodRunning(): ValidationResult {
  try {
    const output = exec(
      'kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api -o jsonpath="{.items[0].status.phase}"',
      { silent: true }
    );
    
    const isRunning = output === 'Running';
    return {
      pass: isRunning,
      actual: output,
      expected: 'Running',
      details: isRunning ? 'Activity API pod is running' : 'Activity API pod is not in Running state'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Error checking pod',
      expected: 'Running',
      error: error.message
    };
  }
}

/**
 * Check if SurrealDB pod is running
 */
function checkSurrealDBPodRunning(): ValidationResult {
  try {
    const output = exec(
      'kubectl get pods -n activity-system -l app=surrealdb -o jsonpath="{.items[0].status.phase}"',
      { silent: true }
    );
    
    const isRunning = output === 'Running';
    return {
      pass: isRunning,
      actual: output,
      expected: 'Running',
      details: isRunning ? 'SurrealDB pod is running' : 'SurrealDB pod is not in Running state'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: 'Error checking pod',
      expected: 'Running',
      error: error.message
    };
  }
}

/**
 * Start port-forward for Activity API
 */
function startPortForward(): { process: ChildProcess; ready: Promise<void> } {
  console.log('Starting port-forward to Activity API...');
  
  const portForward = spawn('kubectl', [
    'port-forward',
    '-n', 'activity-system',
    'svc/metabob-activity-api',
    '8080:8080'
  ]);

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Port-forward timed out'));
    }, 10000);

    portForward.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes('Forwarding from')) {
        clearTimeout(timeout);
        console.log('Port-forward ready');
        resolve();
      }
    });

    portForward.stderr?.on('data', (data: Buffer) => {
      console.error('Port-forward error:', data.toString());
    });

    portForward.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return { process: portForward, ready };
}

/**
 * Make HTTP GET request
 */
function httpGet(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          body
        });
      });
    }).on('error', reject);
  });
}

/**
 * Test Case 1: Templates endpoint returns HTTP 200
 */
async function testTemplatesEndpoint(): Promise<ValidationResult> {
  try {
    const response = await httpGet('http://localhost:8080/v2/activities/templates');
    
    const pass = response.statusCode === 200;
    return {
      pass,
      actual: `HTTP ${response.statusCode}`,
      expected: 'HTTP 200',
      details: pass 
        ? 'Templates endpoint accessible, authentication successful'
        : `Expected HTTP 200 but got ${response.statusCode}. Response: ${response.body.substring(0, 200)}`
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: `Error: ${error.message}`,
      expected: 'HTTP 200',
      error: error.message,
      details: 'Failed to connect to templates endpoint'
    };
  }
}

/**
 * Test Case 2: Activity API logs show successful SurrealDB connection
 */
async function testActivityApiLogs(): Promise<ValidationResult> {
  try {
    const logs = await execAsync(
      'kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100',
      5000
    );

    // Check for success indicators
    const hasSuccessMessage = logs.includes('Connected to SurrealDB successfully');
    const hasVerified = logs.includes('verified: true');
    const noAuthError = !logs.includes('There was a problem with authentication');
    const noNamespaceError = !logs.includes('Cannot access namespace');

    const pass = hasSuccessMessage && hasVerified && noAuthError && noNamespaceError;

    return {
      pass,
      actual: {
        hasSuccessMessage,
        hasVerified,
        noAuthError,
        noNamespaceError
      },
      expected: {
        hasSuccessMessage: true,
        hasVerified: true,
        noAuthError: true,
        noNamespaceError: true
      },
      details: pass
        ? 'Activity API logs show successful SurrealDB connection with namespace verification'
        : `Activity API logs indicate connection issues. Check: ${!hasSuccessMessage ? 'missing success message, ' : ''}${!hasVerified ? 'missing verification, ' : ''}${!noAuthError ? 'has auth error, ' : ''}${!noNamespaceError ? 'has namespace error' : ''}`
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: `Error: ${error.message}`,
      expected: 'Successful connection logs',
      error: error.message
    };
  }
}

/**
 * Test Case 3: SurrealDB logs show no authentication errors
 */
async function testSurrealDBLogs(): Promise<ValidationResult> {
  try {
    const logs = await execAsync(
      'kubectl logs -n activity-system -l app=surrealdb --tail=50',
      5000
    );

    // Check for error indicators
    const noAuthRejection = !logs.includes('authentication failed') && 
                            !logs.includes('invalid credentials') &&
                            !logs.includes('unauthorized');
    
    const hasAcceptedConnection = logs.includes('accepted') || 
                                   logs.includes('connected') ||
                                   logs.length > 0; // If logs exist, server is running

    const pass = noAuthRejection && hasAcceptedConnection;

    return {
      pass,
      actual: {
        noAuthRejection,
        hasAcceptedConnection
      },
      expected: {
        noAuthRejection: true,
        hasAcceptedConnection: true
      },
      details: pass
        ? 'SurrealDB logs show no authentication rejections'
        : 'SurrealDB logs indicate authentication issues'
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: `Error: ${error.message}`,
      expected: 'No authentication errors in SurrealDB logs',
      error: error.message
    };
  }
}

/**
 * Test Case 4: Direct SurrealDB connection test
 */
async function testDirectSurrealDBConnection(): Promise<ValidationResult> {
  try {
    // Get credentials from secret
    const username = await execAsync(
      'kubectl get secret -n activity-system surrealdb-credentials -o jsonpath="{.data.username}" | base64 -d',
      5000
    );
    
    const password = await execAsync(
      'kubectl get secret -n activity-system surrealdb-credentials -o jsonpath="{.data.password}" | base64 -d',
      5000
    );

    // Check if credentials are rendered (not template placeholders)
    const credentialsRendered = !username.includes('{{') && !password.includes('{{');

    if (!credentialsRendered) {
      return {
        pass: false,
        actual: { username, password: '[REDACTED]' },
        expected: 'Rendered credentials (not Helmfile templates)',
        details: 'Secret contains unrendered Helmfile templates. Run: export SURREALDB_USERNAME=root SURREALDB_PASSWORD=surrealdb-local-dev-123 && helmfile apply'
      };
    }

    // Test SQL query via kubectl exec
    const podName = await execAsync(
      'kubectl get pods -n activity-system -l app=surrealdb -o jsonpath="{.items[0].metadata.name}"',
      5000
    );

    try {
      const sqlResult = await execAsync(
        `kubectl exec -n activity-system ${podName} -- surreal sql --conn http://localhost:8000 --user ${username} --pass ${password} --ns activity-system --db learning_loop --pretty "INFO FOR NS;"`,
        5000
      );

      const pass = sqlResult.includes('activity-system') || sqlResult.includes('learning_loop');

      return {
        pass,
        actual: 'Direct SQL connection succeeded',
        expected: 'Direct SQL connection with NS/DB scope',
        details: pass
          ? 'Direct SurrealDB connection with credentials works'
          : 'Direct connection succeeded but namespace info missing'
      };
    } catch (sqlError: any) {
      return {
        pass: false,
        actual: `SQL query failed: ${sqlError.message}`,
        expected: 'Successful SQL query',
        error: sqlError.message,
        details: 'Direct SurrealDB connection failed. This indicates credentials or authentication method issue.'
      };
    }
  } catch (error: any) {
    return {
      pass: false,
      actual: `Error: ${error.message}`,
      expected: 'Successful direct connection',
      error: error.message
    };
  }
}

/**
 * Test Case 5: Namespace configuration matches between server and client
 */
async function testNamespaceConfiguration(): Promise<ValidationResult> {
  try {
    // Check Activity API configuration
    const apiConfig = await execAsync(
      'kubectl get deployment -n activity-system metabob-activity-api -o jsonpath="{.spec.template.spec.containers[0].env[?(@.name==\'SURREALDB_NAMESPACE\')].value}"',
      5000
    );

    const apiNamespace = apiConfig.trim() || 'activity-system';
    const expectedNamespace = 'activity-system';

    const pass = apiNamespace === expectedNamespace;

    return {
      pass,
      actual: { apiNamespace },
      expected: { apiNamespace: expectedNamespace },
      details: pass
        ? 'Namespace configuration is consistent'
        : `Namespace mismatch: API expects ${apiNamespace}, should be ${expectedNamespace}`
    };
  } catch (error: any) {
    return {
      pass: false,
      actual: `Error: ${error.message}`,
      expected: 'Consistent namespace configuration',
      error: error.message
    };
  }
}

/**
 * Main validation runner
 */
async function runValidation(): Promise<number> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SurrealDB v3.0.0 Authentication Validation Harness');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Pre-flight checks
  console.log('Running pre-flight checks...\n');

  const kubectlCheck = checkKubectlAccess();
  console.log(`✓ kubectl access: ${kubectlCheck.pass ? 'PASS' : 'FAIL'}`);
  if (!kubectlCheck.pass) {
    console.error('ERROR: kubectl not accessible');
    return 2;
  }

  const apiPodCheck = checkActivityApiPodRunning();
  console.log(`✓ Activity API pod: ${apiPodCheck.pass ? 'PASS' : 'FAIL'} (${apiPodCheck.actual})`);
  if (!apiPodCheck.pass) {
    console.error('ERROR: Activity API pod not running');
    return 2;
  }

  const surrealPodCheck = checkSurrealDBPodRunning();
  console.log(`✓ SurrealDB pod: ${surrealPodCheck.pass ? 'PASS' : 'FAIL'} (${surrealPodCheck.actual})`);
  if (!surrealPodCheck.pass) {
    console.error('ERROR: SurrealDB pod not running');
    return 2;
  }

  console.log('\n✓ All pre-flight checks passed\n');

  // Start port-forward
  const portForward = startPortForward();
  let portForwardProcess: ChildProcess | null = portForward.process;

  try {
    await portForward.ready;
    console.log('✓ Port-forward established\n');

    // Wait for service to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run test cases
    console.log('Running validation test cases...\n');

    const testCases: TestCase[] = [
      {
        name: 'Templates Endpoint HTTP 200',
        description: 'GET /v2/activities/templates returns HTTP 200 (not 500)',
        expectedOutput: { statusCode: 200 },
        validate: testTemplatesEndpoint
      },
      {
        name: 'Activity API Logs',
        description: 'Activity API logs show successful SurrealDB connection',
        expectedOutput: { 
          hasSuccessMessage: true,
          hasVerified: true,
          noAuthError: true,
          noNamespaceError: true
        },
        validate: testActivityApiLogs
      },
      {
        name: 'SurrealDB Logs',
        description: 'SurrealDB logs show no authentication errors',
        expectedOutput: {
          noAuthRejection: true,
          hasAcceptedConnection: true
        },
        validate: testSurrealDBLogs
      },
      {
        name: 'Direct SurrealDB Connection',
        description: 'Direct SQL connection with kubectl exec works',
        expectedOutput: 'Successful SQL query',
        validate: testDirectSurrealDBConnection
      },
      {
        name: 'Namespace Configuration',
        description: 'Namespace configuration is consistent',
        expectedOutput: { apiNamespace: 'activity-system' },
        validate: testNamespaceConfiguration
      }
    ];

    let allPassed = true;
    const results: Array<{ name: string; result: ValidationResult }> = [];

    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.name}`);
      console.log(`  Description: ${testCase.description}`);
      
      const result = await testCase.validate();
      results.push({ name: testCase.name, result });

      if (result.pass) {
        console.log(`  ✓ PASS`);
        if (result.details) {
          console.log(`    ${result.details}`);
        }
      } else {
        console.log(`  ✗ FAIL`);
        console.log(`    Expected: ${JSON.stringify(result.expected)}`);
        console.log(`    Actual: ${JSON.stringify(result.actual)}`);
        if (result.details) {
          console.log(`    Details: ${result.details}`);
        }
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
        allPassed = false;
      }
      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Validation Summary');
    console.log('═══════════════════════════════════════════════════════════\n');

    const passCount = results.filter(r => r.result.pass).length;
    const totalCount = results.length;

    console.log(`Tests Passed: ${passCount}/${totalCount}`);
    console.log(`Tests Failed: ${totalCount - passCount}/${totalCount}\n`);

    if (allPassed) {
      console.log('✓ All validations PASSED');
      console.log('\nSurrealDB v3.0.0 authentication is working correctly:');
      console.log('  - Activity API authenticates successfully with NS/DB scope');
      console.log('  - Templates endpoint returns HTTP 200');
      console.log('  - No authentication errors in logs');
      console.log('  - Direct SurrealDB connection works');
      console.log('  - Namespace configuration is consistent\n');
      return 0;
    } else {
      console.log('✗ Validation FAILED');
      console.log('\nFailed tests:');
      results
        .filter(r => !r.result.pass)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.result.details || r.result.error || 'Unknown error'}`);
        });
      console.log('');
      return 1;
    }

  } catch (error: any) {
    console.error('ERROR during validation:', error.message);
    return 2;
  } finally {
    // Cleanup port-forward
    if (portForwardProcess) {
      console.log('Cleaning up port-forward...');
      portForwardProcess.kill();
    }
  }
}

// Run validation if executed directly
if (require.main === module) {
  runValidation()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('FATAL ERROR:', error);
      process.exit(2);
    });
}

// Export for programmatic use
export { runValidation, ValidationResult, TestCase };
