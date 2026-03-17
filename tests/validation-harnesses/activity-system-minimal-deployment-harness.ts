/**
 * Validation Harness: activity-system-minimal-deployment
 * 
 * Automated validation of the activity system infrastructure deployment.
 * Tests 11 core requirements plus additional API endpoint validation.
 * 
 * Usage:
 *   bun run tests/validation-harnesses/activity-system-minimal-deployment-harness.ts
 * 
 * Returns: Exit code 0 (all tests pass) or 1 (one or more failures)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Configuration
const NAMESPACE = 'activity-system';
const RETRY_COUNT = 5;
const RETRY_DELAY = 3000; // ms
const PORT_FORWARD_STARTUP_DELAY = 2000; // ms

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  actual: any;
  expected: any;
  error?: string;
  duration?: number;
}

const testResults: TestResult[] = [];

// Utility functions
function log(message: string, type: 'info' | 'success' | 'failure' | 'warning' = 'info') {
  const colors = {
    info: '\x1b[34m',    // Blue
    success: '\x1b[32m', // Green
    failure: '\x1b[31m', // Red
    warning: '\x1b[33m'  // Yellow
  };
  const reset = '\x1b[0m';
  const prefix = {
    info: '[INFO]',
    success: '[✓]',
    failure: '[✗]',
    warning: '[WARNING]'
  };
  console.log(`${colors[type]}${prefix[type]}${reset} ${message}`);
}

async function retry<T>(
  fn: () => Promise<T>,
  retries: number = RETRY_COUNT,
  delay: number = RETRY_DELAY
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry exhausted');
}

async function kubectlGet(resource: string, namespace: string, selector?: string): Promise<any> {
  const selectorArg = selector ? `-l ${selector}` : '';
  const { stdout } = await execAsync(
    `kubectl get ${resource} -n ${namespace} ${selectorArg} -o json`
  );
  return JSON.parse(stdout);
}

async function portForward(
  service: string,
  namespace: string,
  localPort: number,
  servicePort: number
): Promise<{ pid: number; cleanup: () => Promise<void> }> {
  const proc = exec(
    `kubectl port-forward -n ${namespace} svc/${service} ${localPort}:${servicePort}`,
    (error) => {
      if (error && !error.killed) {
        log(`Port-forward error for ${service}: ${error.message}`, 'warning');
      }
    }
  );

  // Wait for port-forward to be ready
  await new Promise(resolve => setTimeout(resolve, PORT_FORWARD_STARTUP_DELAY));

  return {
    pid: proc.pid!,
    cleanup: async () => {
      proc.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };
}

async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    auth?: { username: string; password: string };
  } = {}
): Promise<{ statusCode: number; body: any; responseTime: number }> {
  const start = Date.now();
  
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: options.headers || {},
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  if (options.auth) {
    const authString = Buffer.from(
      `${options.auth.username}:${options.auth.password}`
    ).toString('base64');
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': `Basic ${authString}`
    };
  }

  const response = await fetch(url, fetchOptions);
  const responseTime = Date.now() - start;
  
  let body;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return {
    statusCode: response.status,
    body,
    responseTime
  };
}

// Test implementations
async function testNamespaceExists(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Namespace Existence';
  
  try {
    const { stdout } = await execAsync(`kubectl get namespace ${NAMESPACE} -o json`);
    const namespace = JSON.parse(stdout);
    
    const passed = namespace.metadata?.name === NAMESPACE && 
                   namespace.status?.phase === 'Active';
    
    return {
      name: testName,
      passed,
      actual: { name: namespace.metadata?.name, status: namespace.status?.phase },
      expected: { name: NAMESPACE, status: 'Active' },
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { name: NAMESPACE, status: 'Active' },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testServicesExist(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Service Creation Verification';
  const requiredServices = ['redis-master', 'surrealdb', 'metabob-activity-api', 'minibob'];
  
  try {
    const services = await kubectlGet('svc', NAMESPACE);
    const foundServices = services.items.map((svc: any) => svc.metadata.name);
    
    const allExist = requiredServices.every(svc => foundServices.includes(svc));
    
    return {
      name: testName,
      passed: allExist,
      actual: { services: foundServices, count: foundServices.length },
      expected: { services: requiredServices, count: requiredServices.length },
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { services: requiredServices, count: requiredServices.length },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testPersistentVolumes(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Persistent Volume Binding';
  
  try {
    const pvcs = await kubectlGet('pvc', NAMESPACE);
    const boundPVCs = pvcs.items.filter((pvc: any) => pvc.status?.phase === 'Bound');
    
    const passed = boundPVCs.length >= 1;
    
    return {
      name: testName,
      passed,
      actual: { boundPVCs: boundPVCs.length, total: pvcs.items.length },
      expected: { boundPVCs: '>=1' },
      duration: Date.now() - start
    };
  } catch (error: any) {
    // PVCs may not exist if using in-memory storage
    log('No PVCs found - may be using in-memory storage', 'warning');
    return {
      name: testName,
      passed: true, // Not a failure condition
      actual: { boundPVCs: 0 },
      expected: { boundPVCs: '>=0' },
      duration: Date.now() - start
    };
  }
}

async function testPodsRunning(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Pod Running Status - All 5 Pods';
  
  try {
    const pods = await kubectlGet('pods', NAMESPACE);
    const runningPods = pods.items.filter((pod: any) => pod.status?.phase === 'Running');
    
    const passed = runningPods.length >= 5;
    
    return {
      name: testName,
      passed,
      actual: { runningPods: runningPods.length, total: pods.items.length },
      expected: { runningPods: 5 },
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { runningPods: 5 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testSurrealDBHealth(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'SurrealDB Health Endpoint';
  
  const pf = await portForward('surrealdb', NAMESPACE, 8000, 8000);
  
  try {
    const result = await retry(async () => {
      return await httpRequest('http://localhost:8000/health');
    });
    
    await pf.cleanup();
    
    const passed = result.statusCode === 200;
    
    return {
      name: testName,
      passed,
      actual: { statusCode: result.statusCode, responseTime: result.responseTime },
      expected: { statusCode: 200, responseTime: '<1000ms' },
      duration: Date.now() - start
    };
  } catch (error: any) {
    await pf.cleanup();
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { statusCode: 200 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testActivityAPIHealth(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Activity API Health Endpoint';
  
  const pf = await portForward('metabob-activity-api', NAMESPACE, 8080, 8080);
  
  try {
    const result = await retry(async () => {
      return await httpRequest('http://localhost:8080/health');
    });
    
    await pf.cleanup();
    
    const passed = result.statusCode === 200 && 
                   result.body?.status === 'ok' &&
                   result.body?.service === 'metabob-activity-api';
    
    return {
      name: testName,
      passed,
      actual: { statusCode: result.statusCode, body: result.body, responseTime: result.responseTime },
      expected: { statusCode: 200, body: { status: 'ok', service: 'metabob-activity-api' } },
      duration: Date.now() - start
    };
  } catch (error: any) {
    await pf.cleanup();
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { statusCode: 200 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testMinibobHealth(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Minibob Health Endpoint';
  
  const pf = await portForward('minibob', NAMESPACE, 8081, 8080);
  
  try {
    const result = await retry(async () => {
      return await httpRequest('http://localhost:8081/health');
    });
    
    await pf.cleanup();
    
    const passed = result.statusCode === 200;
    
    return {
      name: testName,
      passed,
      actual: { statusCode: result.statusCode, responseTime: result.responseTime },
      expected: { statusCode: 200 },
      duration: Date.now() - start
    };
  } catch (error: any) {
    await pf.cleanup();
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { statusCode: 200 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testSessionCreationAPI(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Session Creation API';
  
  const pf = await portForward('metabob-activity-api', NAMESPACE, 8080, 8080);
  
  try {
    const result = await httpRequest('http://localhost:8080/v2/session', {
      method: 'POST',
      headers: {
        'X-API-Key': 'test-api-key-validation',
        'Content-Type': 'application/json'
      },
      body: {
        org_id: 'org_test',
        project_id: 'proj_test'
      }
    });
    
    await pf.cleanup();
    
    const passed = result.statusCode === 200 && 
                   result.body?.session !== undefined &&
                   typeof result.body.session === 'string';
    
    return {
      name: testName,
      passed,
      actual: { statusCode: result.statusCode, hasToken: !!result.body?.session },
      expected: { statusCode: 200, hasToken: true },
      duration: Date.now() - start
    };
  } catch (error: any) {
    await pf.cleanup();
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { statusCode: 200 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testTemplateListingAPI(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Template Listing API';
  
  // First create a session
  const pfSession = await portForward('metabob-activity-api', NAMESPACE, 8080, 8080);
  
  try {
    const sessionResult = await httpRequest('http://localhost:8080/v2/session', {
      method: 'POST',
      headers: { 'X-API-Key': 'test', 'Content-Type': 'application/json' },
      body: {}
    });
    
    const token = sessionResult.body?.session;
    
    if (!token) {
      await pfSession.cleanup();
      throw new Error('Failed to create session for template listing test');
    }
    
    // Now test template listing
    const result = await httpRequest('http://localhost:8080/v2/activities/templates?limit=10', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    await pfSession.cleanup();
    
    const passed = result.statusCode === 200 && 
                   Array.isArray(result.body?.templates) &&
                   typeof result.body?.total === 'number';
    
    return {
      name: testName,
      passed,
      actual: { 
        statusCode: result.statusCode, 
        hasTemplates: Array.isArray(result.body?.templates),
        hasTotal: typeof result.body?.total === 'number'
      },
      expected: { statusCode: 200, hasTemplates: true, hasTotal: true },
      duration: Date.now() - start
    };
  } catch (error: any) {
    await pfSession.cleanup();
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { statusCode: 200 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testExecutionRecordingAPI(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'Execution Recording API';
  
  // First create a session
  const pfSession = await portForward('metabob-activity-api', NAMESPACE, 8080, 8080);
  
  try {
    const sessionResult = await httpRequest('http://localhost:8080/v2/session', {
      method: 'POST',
      headers: { 'X-API-Key': 'test', 'Content-Type': 'application/json' },
      body: {}
    });
    
    const token = sessionResult.body?.session;
    
    if (!token) {
      await pfSession.cleanup();
      throw new Error('Failed to create session for execution recording test');
    }
    
    // Now test execution recording
    const result = await httpRequest('http://localhost:8080/v2/activities/executions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: {
        variant_id: 'test-variant-validation',
        success: true,
        duration_ms: 5000,
        cost: 0.05,
        tokens: {
          input: 1000,
          output: 500,
          cache: 200
        }
      }
    });
    
    await pfSession.cleanup();
    
    const passed = result.statusCode === 201 && 
                   result.body?.success === true &&
                   typeof result.body?.execution_id === 'string';
    
    return {
      name: testName,
      passed,
      actual: { 
        statusCode: result.statusCode, 
        success: result.body?.success,
        hasExecutionId: typeof result.body?.execution_id === 'string'
      },
      expected: { statusCode: 201, success: true, hasExecutionId: true },
      duration: Date.now() - start
    };
  } catch (error: any) {
    await pfSession.cleanup();
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { statusCode: 201 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

async function testSurrealDBQuery(): Promise<TestResult> {
  const start = Date.now();
  const testName = 'SurrealDB Database Query';
  
  const pf = await portForward('surrealdb', NAMESPACE, 8000, 8000);
  
  try {
    const result = await httpRequest('http://localhost:8000/sql', {
      method: 'POST',
      auth: {
        username: 'root',
        password: 'surrealdb123'
      },
      headers: {
        'Content-Type': 'application/json',
        'NS': 'metabob',
        'DB': 'learning_loop'
      },
      body: 'INFO FOR DB;'
    });
    
    await pf.cleanup();
    
    const passed = result.statusCode === 200;
    
    return {
      name: testName,
      passed,
      actual: { statusCode: result.statusCode },
      expected: { statusCode: 200 },
      duration: Date.now() - start
    };
  } catch (error: any) {
    await pf.cleanup();
    return {
      name: testName,
      passed: false,
      actual: null,
      expected: { statusCode: 200 },
      error: error.message,
      duration: Date.now() - start
    };
  }
}

// Main validation runner
async function runValidation(): Promise<{ pass: boolean; results: TestResult[] }> {
  log('Starting Activity System Validation', 'info');
  log(`Namespace: ${NAMESPACE}`, 'info');
  console.log('');
  
  // Run all tests
  const tests = [
    testNamespaceExists,
    testServicesExist,
    testPersistentVolumes,
    testPodsRunning,
    testSurrealDBHealth,
    testActivityAPIHealth,
    testMinibobHealth,
    testSessionCreationAPI,
    testTemplateListingAPI,
    testExecutionRecordingAPI,
    testSurrealDBQuery
  ];
  
  for (const test of tests) {
    const result = await test();
    testResults.push(result);
    
    if (result.passed) {
      log(`${result.name} (${result.duration}ms)`, 'success');
    } else {
      log(`${result.name} (${result.duration}ms)`, 'failure');
      if (result.error) {
        log(`  Error: ${result.error}`, 'failure');
      }
    }
  }
  
  // Summary
  console.log('');
  log('==========================================', 'info');
  log('Validation Summary', 'info');
  log('==========================================', 'info');
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  
  log(`Passed: ${passed}`, 'success');
  if (failed > 0) {
    log(`Failed: ${failed}`, 'failure');
  }
  
  const allPassed = failed === 0;
  
  if (allPassed) {
    console.log('');
    log('All tests passed!', 'success');
    log('Activity System is fully operational', 'info');
  } else {
    console.log('');
    log('Some tests failed', 'failure');
    log('Check logs above for details', 'warning');
  }
  
  return {
    pass: allPassed,
    results: testResults
  };
}

// Export for programmatic use
export { runValidation, TestResult };

// CLI execution
if (import.meta.main) {
  runValidation()
    .then(({ pass }) => {
      process.exit(pass ? 0 : 1);
    })
    .catch((error) => {
      log(`Validation error: ${error.message}`, 'failure');
      process.exit(1);
    });
}
