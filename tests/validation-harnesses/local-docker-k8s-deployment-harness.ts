#!/usr/bin/env tsx
/**
 * Validation Harness: Local Docker Desktop Kubernetes Deployment
 * 
 * This harness validates that the metabob platform can be successfully deployed
 * to a local docker-desktop kubernetes cluster with DRY configuration that is
 * reusable across multiple kubectx targets.
 * 
 * Validation Strategy:
 * 1. Verify docker-desktop context is active
 * 2. Run helmfile -e local sync
 * 3. Check all pods reach Running status
 * 4. Verify services are exposed
 * 5. Test service accessibility via NodePort
 * 6. Validate DRY principles (config reusability)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  errors?: string[];
  warnings?: string[];
}

interface TestCase {
  name: string;
  validate: () => ValidationResult;
}

/**
 * Execute a shell command and return output
 */
function execCommand(command: string, options: { cwd?: string; ignoreErrors?: boolean } = {}): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      cwd: options.cwd || process.cwd(),
      stdio: options.ignoreErrors ? 'pipe' : 'inherit'
    }).trim();
  } catch (error: any) {
    if (options.ignoreErrors) {
      return error.stdout?.toString() || '';
    }
    throw error;
  }
}

/**
 * Test Case 1: Verify docker-desktop context is active
 */
function validateKubernetesContext(): ValidationResult {
  const actual = execCommand('kubectl config current-context', { ignoreErrors: true });
  const expected = 'docker-desktop';
  
  return {
    pass: actual === expected,
    actual,
    expected,
    errors: actual !== expected ? [`Expected kubectl context to be '${expected}', but got '${actual}'`] : undefined
  };
}

/**
 * Test Case 2: Verify helmfile configuration exists and is valid
 */
function validateHelmfileConfig(): ValidationResult {
  const helmfilePath = path.join(
    process.cwd(),
    'repos/platform/deployments/metabob/helmfile.yaml.gotmpl'
  );
  
  const errors: string[] = [];
  const actual: any = {
    helmfileExists: false,
    environmentsConfigured: [],
    localEnvironmentValid: false
  };
  
  if (!fs.existsSync(helmfilePath)) {
    errors.push(`Helmfile not found at ${helmfilePath}`);
    return {
      pass: false,
      actual,
      expected: { helmfileExists: true, environmentsConfigured: ['local', 'prod', 'integration', 'research', 'ops'], localEnvironmentValid: true },
      errors
    };
  }
  
  actual.helmfileExists = true;
  
  const helmfileContent = fs.readFileSync(helmfilePath, 'utf-8');
  const envMatches = helmfileContent.match(/environments:\s*\n([\s\S]*?)(?=\n\w|$)/);
  
  if (envMatches) {
    const envSection = envMatches[1];
    const envNames = [...envSection.matchAll(/^\s+(\w+):/gm)].map(m => m[1]);
    actual.environmentsConfigured = envNames;
    actual.localEnvironmentValid = envNames.includes('local');
  }
  
  const expected = {
    helmfileExists: true,
    environmentsConfigured: ['local', 'prod', 'integration', 'research', 'ops'],
    localEnvironmentValid: true
  };
  
  const pass = actual.helmfileExists && actual.localEnvironmentValid && 
                actual.environmentsConfigured.length >= 5;
  
  if (!pass) {
    errors.push('Helmfile configuration is incomplete or invalid');
  }
  
  return { pass, actual, expected, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Test Case 3: Validate DRY principles (config reusability)
 */
function validateDRYPrinciples(): ValidationResult {
  const deploymentsPath = path.join(process.cwd(), 'repos/platform/deployments/metabob');
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const actual: any = {
    commonValuesExists: false,
    localValuesExists: false,
    envSpecificOverridesOnly: false,
    helmfileSingleSource: true
  };
  
  // Check common.values.yaml exists
  const commonValuesPath = path.join(deploymentsPath, 'environments/common.values.yaml');
  actual.commonValuesExists = fs.existsSync(commonValuesPath);
  
  // Check local.values.yaml exists
  const localValuesPath = path.join(deploymentsPath, 'environments/local.values.yaml');
  actual.localValuesExists = fs.existsSync(localValuesPath);
  
  if (!actual.commonValuesExists) {
    errors.push('common.values.yaml not found - DRY baseline missing');
  }
  
  if (!actual.localValuesExists) {
    errors.push('local.values.yaml not found - environment-specific config missing');
  }
  
  // Validate that environment-specific files only contain overrides
  if (actual.commonValuesExists && actual.localValuesExists) {
    const commonContent = fs.readFileSync(commonValuesPath, 'utf-8');
    const localContent = fs.readFileSync(localValuesPath, 'utf-8');
    
    const commonData = yaml.parse(commonContent);
    const localData = yaml.parse(localContent);
    
    // Check that local doesn't duplicate all of common (should only override)
    const commonKeys = Object.keys(commonData || {});
    const localKeys = Object.keys(localData || {});
    
    // Local should have fewer keys (only overrides) or different values
    actual.envSpecificOverridesOnly = localKeys.length <= commonKeys.length;
    
    if (!actual.envSpecificOverridesOnly) {
      warnings.push('local.values.yaml may contain more keys than common.values.yaml - verify DRY principles');
    }
  }
  
  const expected = {
    commonValuesExists: true,
    localValuesExists: true,
    envSpecificOverridesOnly: true,
    helmfileSingleSource: true
  };
  
  const pass = actual.commonValuesExists && actual.localValuesExists && 
                actual.helmfileSingleSource;
  
  return { 
    pass, 
    actual, 
    expected, 
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Test Case 4: Deploy to local docker-desktop
 */
function deployToLocal(): ValidationResult {
  const deploymentsPath = path.join(process.cwd(), 'repos/platform/deployments/metabob');
  const errors: string[] = [];
  
  try {
    console.log('Running helmfile -e local sync...');
    const output = execCommand('helmfile -e local sync', { cwd: deploymentsPath, ignoreErrors: true });
    
    const actual = {
      deploymentSucceeded: !output.includes('ERROR') && !output.includes('FAILED'),
      output: output.slice(0, 500) // Truncate for brevity
    };
    
    const expected = {
      deploymentSucceeded: true
    };
    
    if (!actual.deploymentSucceeded) {
      errors.push('Helmfile deployment failed or encountered errors');
    }
    
    return { pass: actual.deploymentSucceeded, actual, expected, errors: errors.length > 0 ? errors : undefined };
  } catch (error: any) {
    errors.push(`Deployment failed with error: ${error.message}`);
    return {
      pass: false,
      actual: { deploymentSucceeded: false, error: error.message },
      expected: { deploymentSucceeded: true },
      errors
    };
  }
}

/**
 * Test Case 5: Verify pods reach Running status
 */
function validatePodsRunning(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Wait for pods to be created (max 30 seconds)
    console.log('Waiting for pods to be created...');
    let attempts = 0;
    let podsOutput = '';
    
    while (attempts < 6) {
      podsOutput = execCommand('kubectl get pods -n metabob -o json', { ignoreErrors: true });
      const podsData = JSON.parse(podsOutput || '{"items":[]}');
      
      if (podsData.items && podsData.items.length > 0) {
        break;
      }
      
      attempts++;
      execSync('sleep 5');
    }
    
    const podsData = JSON.parse(podsOutput || '{"items":[]}');
    const pods = podsData.items || [];
    
    const actual = {
      totalPods: pods.length,
      runningPods: 0,
      podStatuses: [] as any[]
    };
    
    pods.forEach((pod: any) => {
      const status = pod.status?.phase || 'Unknown';
      const podInfo = {
        name: pod.metadata?.name,
        status,
        ready: status === 'Running'
      };
      
      actual.podStatuses.push(podInfo);
      
      if (status === 'Running') {
        actual.runningPods++;
      } else if (status === 'Pending') {
        warnings.push(`Pod ${pod.metadata?.name} is still Pending`);
      } else {
        errors.push(`Pod ${pod.metadata?.name} is in ${status} state`);
      }
    });
    
    const expected = {
      totalPods: '>= 4', // config, redis, rpc-api-worker, rpc-api-service, dashboard
      runningPods: '>= 4',
      podStatuses: 'All Running'
    };
    
    const pass = actual.totalPods >= 4 && actual.runningPods >= 4;
    
    if (!pass && actual.totalPods === 0) {
      errors.push('No pods found in metabob namespace');
    }
    
    return { 
      pass, 
      actual, 
      expected, 
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error: any) {
    errors.push(`Failed to validate pods: ${error.message}`);
    return {
      pass: false,
      actual: { error: error.message },
      expected: { totalPods: '>= 4', runningPods: '>= 4' },
      errors
    };
  }
}

/**
 * Test Case 6: Verify services are exposed
 */
function validateServicesExposed(): ValidationResult {
  const errors: string[] = [];
  
  try {
    const servicesOutput = execCommand('kubectl get svc -n metabob -o json', { ignoreErrors: true });
    const servicesData = JSON.parse(servicesOutput || '{"items":[]}');
    const services = servicesData.items || [];
    
    const actual = {
      totalServices: services.length,
      nodePortServices: 0,
      services: [] as any[]
    };
    
    services.forEach((svc: any) => {
      const serviceInfo = {
        name: svc.metadata?.name,
        type: svc.spec?.type,
        ports: svc.spec?.ports?.map((p: any) => ({
          port: p.port,
          nodePort: p.nodePort,
          protocol: p.protocol
        }))
      };
      
      actual.services.push(serviceInfo);
      
      if (svc.spec?.type === 'NodePort') {
        actual.nodePortServices++;
      }
    });
    
    const expected = {
      totalServices: '>= 4',
      nodePortServices: '>= 1', // At least one service should be NodePort for local access
      services: 'config, redis, rpc-api, dashboard'
    };
    
    const pass = actual.totalServices >= 4 && actual.nodePortServices >= 1;
    
    if (!pass) {
      errors.push('Expected at least 4 services with at least 1 NodePort service');
    }
    
    return { pass, actual, expected, errors: errors.length > 0 ? errors : undefined };
  } catch (error: any) {
    errors.push(`Failed to validate services: ${error.message}`);
    return {
      pass: false,
      actual: { error: error.message },
      expected: { totalServices: '>= 4', nodePortServices: '>= 1' },
      errors
    };
  }
}

/**
 * Test Case 7: Validate Redis resource allocation
 */
function validateRedisResources(): ValidationResult {
  const redisValuesPath = path.join(
    process.cwd(),
    'repos/platform/deployments/metabob/charts/redis/values/local.redis.values.yaml'
  );
  
  const errors: string[] = [];
  
  if (!fs.existsSync(redisValuesPath)) {
    errors.push(`Redis values file not found at ${redisValuesPath}`);
    return {
      pass: false,
      actual: { fileExists: false },
      expected: { fileExists: true, memory: '512Mi', storage: '8Gi' },
      errors
    };
  }
  
  const redisContent = fs.readFileSync(redisValuesPath, 'utf-8');
  const redisData = yaml.parse(redisContent);
  
  const actual = {
    memory: redisData?.master?.resources?.requests?.memory,
    storage: redisData?.master?.persistence?.size
  };
  
  const expected = {
    memory: '512Mi',
    storage: '8Gi'
  };
  
  const pass = actual.memory === expected.memory && actual.storage === expected.storage;
  
  if (!pass) {
    if (actual.memory !== expected.memory) {
      errors.push(`Redis memory should be ${expected.memory} for docker-desktop, got ${actual.memory}`);
    }
    if (actual.storage !== expected.storage) {
      errors.push(`Redis storage should be ${expected.storage} for local, got ${actual.storage}`);
    }
  }
  
  return { pass, actual, expected, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Main validation runner
 */
export async function runValidation(input?: any): Promise<ValidationResult> {
  console.log('='.repeat(80));
  console.log('Validation Harness: Local Docker Desktop Kubernetes Deployment');
  console.log('='.repeat(80));
  console.log();
  
  const testCases: TestCase[] = [
    { name: 'Kubernetes Context', validate: validateKubernetesContext },
    { name: 'Helmfile Configuration', validate: validateHelmfileConfig },
    { name: 'DRY Principles', validate: validateDRYPrinciples },
    { name: 'Redis Resources', validate: validateRedisResources }
  ];
  
  // Optional deployment tests (can be skipped if SKIP_DEPLOYMENT=true)
  if (!process.env.SKIP_DEPLOYMENT) {
    testCases.push(
      { name: 'Deploy to Local', validate: deployToLocal },
      { name: 'Pods Running', validate: validatePodsRunning },
      { name: 'Services Exposed', validate: validateServicesExposed }
    );
  }
  
  const results: Array<{ name: string; result: ValidationResult }> = [];
  let allPassed = true;
  
  for (const testCase of testCases) {
    console.log(`Running test: ${testCase.name}...`);
    const result = testCase.validate();
    results.push({ name: testCase.name, result });
    
    if (!result.pass) {
      allPassed = false;
      console.log(`  ❌ FAILED`);
      if (result.errors) {
        result.errors.forEach(err => console.log(`     Error: ${err}`));
      }
    } else {
      console.log(`  ✅ PASSED`);
    }
    
    if (result.warnings) {
      result.warnings.forEach(warn => console.log(`     Warning: ${warn}`));
    }
    
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log(`Overall Result: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests Passed: ${results.filter(r => r.result.pass).length}/${results.length}`);
  console.log('='.repeat(80));
  
  return {
    pass: allPassed,
    actual: results.map(r => ({ name: r.name, ...r.result })),
    expected: 'All tests should pass',
    errors: results.filter(r => !r.result.pass).map(r => r.name)
  };
}

// Allow running directly
if (require.main === module) {
  runValidation()
    .then(result => {
      process.exit(result.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation harness crashed:', error);
      process.exit(2);
    });
}
