/**
 * Validation Harness: Deployment DRYness - Zero Manual Steps
 * 
 * This harness validates that Helm deployment works with zero manual kubectl commands.
 * ENVIRONMENT variable and JWT_SECRET_KEY must be configured declaratively in helm values
 * and templates, not manually added after deployment.
 * 
 * Validation Strategy:
 * 1. Pre-deployment: Verify helm chart has proper values and templates
 * 2. Clean deployment: helmfile destroy && helmfile apply
 * 3. Pod startup: Verify RPC API pod reaches Running state without manual intervention
 * 4. ConfigMap verification: Confirm universal-config ConfigMap exists with JWT_SECRET_KEY
 * 5. Environment variable: Verify ENVIRONMENT is set in pod without kubectl set env
 * 6. Functionality: Run basic API health check to confirm application works
 * 
 * Expected Behavior:
 * - helmfile apply succeeds with exit code 0
 * - universal-config ConfigMap created automatically
 * - RPC API pod reaches Running state within 60 seconds
 * - ENVIRONMENT variable set from helm values (no manual kubectl)
 * - JWT_SECRET_KEY available from ConfigMap
 * - API responds to health checks
 * 
 * PASS Criteria:
 * - No CrashLoopBackOff state
 * - No manual kubectl commands needed
 * - All configuration declarative in helm files
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface ValidationInput {
  namespace: string;
  helmfileEnvironment: string;
  rpcApiBaseUrl: string;
  deploymentName: string;
  configMapName: string;
  expectedEnvironment: string;
  expectedJwtSecretKey: string;
  maxPodStartupSeconds: number;
}

export interface ValidationOutput {
  pass: boolean;
  results: {
    helmChartValidation: TestResult;
    cleanDeployment: TestResult;
    configMapCreation: TestResult;
    podStartup: TestResult;
    environmentVariable: TestResult;
    jwtSecretKey: TestResult;
    apiHealthCheck: TestResult;
    zeroManualSteps: TestResult;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    errors: string[];
  };
}

export interface TestResult {
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
  details?: string;
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const results: ValidationOutput['results'] = {
    helmChartValidation: { pass: false, actual: null, expected: null },
    cleanDeployment: { pass: false, actual: null, expected: null },
    configMapCreation: { pass: false, actual: null, expected: null },
    podStartup: { pass: false, actual: null, expected: null },
    environmentVariable: { pass: false, actual: null, expected: null },
    jwtSecretKey: { pass: false, actual: null, expected: null },
    apiHealthCheck: { pass: false, actual: null, expected: null },
    zeroManualSteps: { pass: false, actual: null, expected: null },
  };

  const errors: string[] = [];

  // Test 1: Helm Chart Validation
  console.log('\n[TEST 1] Validating Helm chart configuration...');
  try {
    results.helmChartValidation = await testHelmChartConfiguration();
  } catch (error) {
    results.helmChartValidation = {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { configMapTemplate: true, environmentVars: true },
      error: `Helm chart validation failed: ${(error as Error).message}`,
    };
    errors.push(results.helmChartValidation.error!);
  }

  // Test 2: Clean Deployment
  console.log('\n[TEST 2] Running clean deployment (destroy + apply)...');
  try {
    results.cleanDeployment = await testCleanDeployment(input.helmfileEnvironment);
  } catch (error) {
    results.cleanDeployment = {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { exitCode: 0 },
      error: `Clean deployment failed: ${(error as Error).message}`,
    };
    errors.push(results.cleanDeployment.error!);
    // If deployment fails, no point continuing
    return buildOutput(results, errors);
  }

  // Wait a bit for resources to be created
  console.log('\nWaiting 5 seconds for resources to be created...');
  await sleep(5000);

  // Test 3: ConfigMap Creation
  console.log('\n[TEST 3] Verifying ConfigMap creation...');
  try {
    results.configMapCreation = await testConfigMapCreation(
      input.namespace,
      input.configMapName
    );
  } catch (error) {
    results.configMapCreation = {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { exists: true },
      error: `ConfigMap verification failed: ${(error as Error).message}`,
    };
    errors.push(results.configMapCreation.error!);
  }

  // Test 4: Pod Startup
  console.log('\n[TEST 4] Verifying pod startup...');
  try {
    results.podStartup = await testPodStartup(
      input.namespace,
      input.deploymentName,
      input.maxPodStartupSeconds
    );
  } catch (error) {
    results.podStartup = {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { state: 'Running', noCrashLoop: true },
      error: `Pod startup verification failed: ${(error as Error).message}`,
    };
    errors.push(results.podStartup.error!);
  }

  // Test 5: Environment Variable
  console.log('\n[TEST 5] Verifying ENVIRONMENT variable...');
  try {
    results.environmentVariable = await testEnvironmentVariable(
      input.namespace,
      input.deploymentName,
      input.expectedEnvironment
    );
  } catch (error) {
    results.environmentVariable = {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { value: input.expectedEnvironment },
      error: `Environment variable verification failed: ${(error as Error).message}`,
    };
    errors.push(results.environmentVariable.error!);
  }

  // Test 6: JWT Secret Key
  console.log('\n[TEST 6] Verifying JWT_SECRET_KEY in ConfigMap...');
  try {
    results.jwtSecretKey = await testJwtSecretKey(
      input.namespace,
      input.configMapName
    );
  } catch (error) {
    results.jwtSecretKey = {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { exists: true },
      error: `JWT secret key verification failed: ${(error as Error).message}`,
    };
    errors.push(results.jwtSecretKey.error!);
  }

  // Test 7: API Health Check
  console.log('\n[TEST 7] Running API health check...');
  try {
    results.apiHealthCheck = await testApiHealth(input.rpcApiBaseUrl);
  } catch (error) {
    results.apiHealthCheck = {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { status: 200 },
      error: `API health check failed: ${(error as Error).message}`,
    };
    errors.push(results.apiHealthCheck.error!);
  }

  // Test 8: Zero Manual Steps Verification
  console.log('\n[TEST 8] Verifying zero manual steps...');
  results.zeroManualSteps = testZeroManualSteps(results);

  return buildOutput(results, errors);
}

/**
 * Test 1: Validate Helm chart has proper templates and values
 */
async function testHelmChartConfiguration(): Promise<TestResult> {
  const checks = {
    configMapTemplate: false,
    valuesYamlEnvironment: false,
    valuesYamlJwtKey: false,
    localValuesEnvironment: false,
    localValuesJwtKey: false,
    deploymentApiEnvironmentVar: false,
    deploymentWorkerEnvironmentVar: false,
  };

  // Check ConfigMap template exists
  try {
    await execAsync('ls helm/charts/metabob-rpc-api/templates/configmap.yaml');
    checks.configMapTemplate = true;
  } catch (error) {
    return {
      pass: false,
      actual: checks,
      expected: { configMapTemplate: true },
      error: 'ConfigMap template does not exist',
    };
  }

  // Check base values.yaml has environment and jwtSecretKey
  try {
    const { stdout } = await execAsync('cat helm/charts/metabob-rpc-api/values.yaml');
    checks.valuesYamlEnvironment = stdout.includes('environment:');
    checks.valuesYamlJwtKey = stdout.includes('jwtSecretKey:');
  } catch (error) {
    // Non-critical, continue
  }

  // Check local.values.yaml has metabobRpcApi configuration
  try {
    const { stdout } = await execAsync('cat helm/environments/local.values.yaml');
    checks.localValuesEnvironment = stdout.includes('environment:');
    checks.localValuesJwtKey = stdout.includes('jwtSecretKey:');
  } catch (error) {
    // Non-critical, continue
  }

  // Check deployment-api.yaml has ENVIRONMENT env var
  try {
    const { stdout } = await execAsync('cat helm/charts/metabob-rpc-api/templates/deployment-api.yaml');
    checks.deploymentApiEnvironmentVar = stdout.includes('name: ENVIRONMENT');
  } catch (error) {
    // Non-critical, continue
  }

  // Check deployment-worker.yaml has ENVIRONMENT env var
  try {
    const { stdout } = await execAsync('cat helm/charts/metabob-rpc-api/templates/deployment-worker.yaml');
    checks.deploymentWorkerEnvironmentVar = stdout.includes('name: ENVIRONMENT');
  } catch (error) {
    // Non-critical, continue
  }

  const allPassed = Object.values(checks).every(v => v === true);

  return {
    pass: allPassed,
    actual: checks,
    expected: {
      configMapTemplate: true,
      valuesYamlEnvironment: true,
      valuesYamlJwtKey: true,
      localValuesEnvironment: true,
      localValuesJwtKey: true,
      deploymentApiEnvironmentVar: true,
      deploymentWorkerEnvironmentVar: true,
    },
    details: allPassed ? 'All helm chart files have required configuration' : 'Some helm chart files missing required configuration',
  };
}

/**
 * Test 2: Clean deployment (destroy + apply)
 */
async function testCleanDeployment(environment: string): Promise<TestResult> {
  try {
    // Destroy existing deployment
    console.log('  Destroying existing deployment...');
    try {
      await execAsync(`helmfile -e ${environment} destroy`, { timeout: 120000 });
    } catch (error) {
      // Destroy may fail if nothing exists, that's ok
      console.log('  Destroy completed (or nothing to destroy)');
    }

    // Wait for cleanup
    await sleep(10000);

    // Apply fresh deployment
    console.log('  Applying fresh deployment...');
    const { stdout } = await execAsync(`helmfile -e ${environment} apply`, { timeout: 300000 });

    return {
      pass: true,
      actual: { exitCode: 0, output: stdout },
      expected: { exitCode: 0 },
      details: 'Clean deployment succeeded',
    };
  } catch (error) {
    const err = error as any;
    return {
      pass: false,
      actual: { exitCode: err.code || 1, error: err.message, stderr: err.stderr },
      expected: { exitCode: 0 },
      error: `Helmfile apply failed: ${err.message}`,
    };
  }
}

/**
 * Test 3: Verify ConfigMap was created
 */
async function testConfigMapCreation(namespace: string, configMapName: string): Promise<TestResult> {
  try {
    const { stdout } = await execAsync(`kubectl get configmap ${configMapName} -n ${namespace} -o json`);
    const configMap = JSON.parse(stdout);

    return {
      pass: true,
      actual: { exists: true, name: configMap.metadata.name },
      expected: { exists: true, name: configMapName },
      details: `ConfigMap ${configMapName} created successfully`,
    };
  } catch (error) {
    return {
      pass: false,
      actual: { exists: false },
      expected: { exists: true },
      error: `ConfigMap ${configMapName} does not exist`,
    };
  }
}

/**
 * Test 4: Verify pod reaches Running state without CrashLoopBackOff
 */
async function testPodStartup(
  namespace: string,
  deploymentName: string,
  maxSeconds: number
): Promise<TestResult> {
  const startTime = Date.now();
  const maxMs = maxSeconds * 1000;

  while (Date.now() - startTime < maxMs) {
    try {
      const { stdout } = await execAsync(
        `kubectl get pods -n ${namespace} -l app=metabob-rpc-api -o json`
      );
      const pods = JSON.parse(stdout);

      if (pods.items.length === 0) {
        console.log('  No pods found yet, waiting...');
        await sleep(5000);
        continue;
      }

      const pod = pods.items[0];
      const status = pod.status.phase;
      const containerStatuses = pod.status.containerStatuses || [];

      // Check for CrashLoopBackOff
      const hasCrashLoop = containerStatuses.some((cs: any) =>
        cs.state?.waiting?.reason === 'CrashLoopBackOff'
      );

      if (hasCrashLoop) {
        return {
          pass: false,
          actual: { state: 'CrashLoopBackOff' },
          expected: { state: 'Running' },
          error: 'Pod entered CrashLoopBackOff state - manual kubectl command likely needed',
        };
      }

      // Check if Running
      if (status === 'Running') {
        const allReady = containerStatuses.every((cs: any) => cs.ready === true);
        if (allReady) {
          return {
            pass: true,
            actual: { state: 'Running', ready: true, elapsedSeconds: Math.floor((Date.now() - startTime) / 1000) },
            expected: { state: 'Running', ready: true },
            details: `Pod reached Running state in ${Math.floor((Date.now() - startTime) / 1000)} seconds`,
          };
        }
      }

      console.log(`  Pod status: ${status}, waiting...`);
      await sleep(5000);
    } catch (error) {
      console.log('  Error checking pod status, retrying...');
      await sleep(5000);
    }
  }

  return {
    pass: false,
    actual: { state: 'Timeout', elapsedSeconds: maxSeconds },
    expected: { state: 'Running' },
    error: `Pod did not reach Running state within ${maxSeconds} seconds`,
  };
}

/**
 * Test 5: Verify ENVIRONMENT variable is set in pod
 */
async function testEnvironmentVariable(
  namespace: string,
  _deploymentName: string,
  expectedValue: string
): Promise<TestResult> {
  try {
    const { stdout } = await execAsync(
      `kubectl get deployment ${_deploymentName} -n ${namespace} -o json`
    );
    const deployment = JSON.parse(stdout);
    const containers = deployment.spec.template.spec.containers;
    const env = containers[0].env || [];

    const environmentVar = env.find((e: any) => e.name === 'ENVIRONMENT');

    if (!environmentVar) {
      return {
        pass: false,
        actual: { exists: false },
        expected: { exists: true, value: expectedValue },
        error: 'ENVIRONMENT variable not found in deployment spec',
      };
    }

    const actualValue = environmentVar.value;
    const pass = actualValue === expectedValue;

    return {
      pass,
      actual: { exists: true, value: actualValue },
      expected: { exists: true, value: expectedValue },
      details: pass
        ? `ENVIRONMENT variable correctly set to ${expectedValue}`
        : `ENVIRONMENT variable set to ${actualValue}, expected ${expectedValue}`,
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { exists: true, value: expectedValue },
      error: `Failed to check ENVIRONMENT variable: ${(error as Error).message}`,
    };
  }
}

/**
 * Test 6: Verify JWT_SECRET_KEY exists in ConfigMap
 */
async function testJwtSecretKey(namespace: string, configMapName: string): Promise<TestResult> {
  try {
    const { stdout } = await execAsync(`kubectl get configmap ${configMapName} -n ${namespace} -o json`);
    const configMap = JSON.parse(stdout);
    const data = configMap.data || {};

    const hasJwtKey = 'JWT_SECRET_KEY' in data;
    const jwtKeyValue = data.JWT_SECRET_KEY;

    if (!hasJwtKey) {
      return {
        pass: false,
        actual: { exists: false },
        expected: { exists: true },
        error: 'JWT_SECRET_KEY not found in ConfigMap',
      };
    }

    return {
      pass: true,
      actual: { exists: true, length: jwtKeyValue.length },
      expected: { exists: true },
      details: `JWT_SECRET_KEY found in ConfigMap (length: ${jwtKeyValue.length})`,
    };
  } catch (error) {
    return {
      pass: false,
      actual: { error: (error as Error).message },
      expected: { exists: true },
      error: `Failed to check JWT_SECRET_KEY: ${(error as Error).message}`,
    };
  }
}

/**
 * Test 7: API health check
 */
async function testApiHealth(baseUrl: string): Promise<TestResult> {
  try {
    const response = await axios.get(`${baseUrl}/health`, { timeout: 10000 });

    return {
      pass: response.status === 200,
      actual: { status: response.status, data: response.data },
      expected: { status: 200 },
      details: 'API health check passed',
    };
  } catch (error) {
    const err = error as any;
    return {
      pass: false,
      actual: { status: err.response?.status || 0, error: err.message },
      expected: { status: 200 },
      error: `API health check failed: ${err.message}`,
    };
  }
}

/**
 * Test 8: Verify zero manual steps were needed
 */
function testZeroManualSteps(results: ValidationOutput['results']): TestResult {
  // This is a meta-test that checks if all previous tests passed
  // If all passed, it means no manual kubectl commands were needed

  const criticalTests = [
    results.cleanDeployment.pass,
    results.configMapCreation.pass,
    results.podStartup.pass,
    results.environmentVariable.pass,
  ];

  const allCriticalPassed = criticalTests.every(t => t === true);

  return {
    pass: allCriticalPassed,
    actual: {
      deploymentSucceeded: results.cleanDeployment.pass,
      configMapAutoCreated: results.configMapCreation.pass,
      podStartedWithoutCrash: results.podStartup.pass,
      environmentVarSet: results.environmentVariable.pass,
    },
    expected: {
      deploymentSucceeded: true,
      configMapAutoCreated: true,
      podStartedWithoutCrash: true,
      environmentVarSet: true,
    },
    details: allCriticalPassed
      ? 'Zero manual steps required - deployment fully declarative'
      : 'Manual steps would have been required - some tests failed',
  };
}

/**
 * Build final validation output
 */
function buildOutput(
  results: ValidationOutput['results'],
  errors: string[]
): ValidationOutput {
  const testResults = Object.values(results);
  const passed = testResults.filter(r => r.pass).length;
  const failed = testResults.filter(r => !r.pass).length;
  const totalTests = testResults.length;

  return {
    pass: failed === 0,
    results,
    summary: {
      totalTests,
      passed,
      failed,
      errors,
    },
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const input: ValidationInput = {
    namespace: 'metabob',
    helmfileEnvironment: 'default',
    rpcApiBaseUrl: 'http://localhost:8000',
    deploymentName: 'metabob-rpc-api',
    configMapName: 'universal-config',
    expectedEnvironment: 'development',
    expectedJwtSecretKey: 'dev-secret-key-change-in-production-12345',
    maxPodStartupSeconds: 120,
  };

  console.log('='.repeat(80));
  console.log('Deployment DRYness - Zero Manual Steps Validation');
  console.log('='.repeat(80));

  runValidation(input)
    .then(output => {
      console.log('\n' + '='.repeat(80));
      console.log('VALIDATION RESULTS');
      console.log('='.repeat(80));
      console.log(`Total Tests: ${output.summary.totalTests}`);
      console.log(`Passed: ${output.summary.passed}`);
      console.log(`Failed: ${output.summary.failed}`);
      console.log(`Overall: ${output.pass ? 'PASS ✅' : 'FAIL ❌'}`);

      if (output.summary.errors.length > 0) {
        console.log('\nErrors:');
        output.summary.errors.forEach(err => console.log(`  - ${err}`));
      }

      console.log('\nDetailed Results:');
      Object.entries(output.results).forEach(([name, result]) => {
        const icon = result.pass ? '✅' : '❌';
        console.log(`  ${icon} ${name}: ${result.pass ? 'PASS' : 'FAIL'}`);
        if (result.details) {
          console.log(`      ${result.details}`);
        }
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });

      process.exit(output.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('\nFATAL ERROR:', error);
      process.exit(1);
    });
}
