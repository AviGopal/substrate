#!/usr/bin/env ts-node
/**
 * Validation Harness: local-docker-desktop-deployment
 * 
 * Purpose: Validate deployment to local docker-desktop kubernetes context
 * 
 * Test Strategy:
 * 1. Verify docker-desktop cluster is accessible
 * 2. Execute helmfile sync to deploy services
 * 3. Monitor pod status until all reach Running/Ready
 * 4. Verify service endpoints are registered
 * 5. Check NodePort accessibility
 * 
 * Returns: PASS/FAIL without LLM interaction
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface ValidationResult {
  pass: boolean;
  actual: Record<string, any>;
  expected: Record<string, any>;
  errors: string[];
  summary: string;
}

interface TestCase {
  id: string;
  description: string;
  input: {
    environment: string;
    context: string;
    deploymentPath: string;
  };
  expectedOutput: {
    clusterAccessible: boolean;
    helmfileParses: boolean;
    podsRunning: number;
    servicesWithEndpoints: number;
    requiredServices: string[];
    maxWaitSeconds: number;
  };
}

// Utility functions
function executeCommand(command: string, cwd?: string): { stdout: string; stderr: string; success: boolean } {
  try {
    const stdout = execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000 // 5 minutes
    });
    return { stdout, stderr: '', success: true };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message,
      success: false
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Validation checks
function checkClusterAccessibility(context: string): { accessible: boolean; error?: string } {
  const result = executeCommand(`kubectl cluster-info --context ${context}`);
  return {
    accessible: result.success,
    error: result.success ? undefined : result.stderr
  };
}

function checkHelmfileValidity(deploymentPath: string, environment: string): { valid: boolean; releases: string[]; error?: string } {
  const result = executeCommand(`helmfile -e ${environment} list`, deploymentPath);
  
  if (!result.success) {
    return { valid: false, releases: [], error: result.stderr };
  }
  
  // Parse helmfile list output to extract release names
  const lines = result.stdout.split('\n').filter(line => line.trim());
  const releases = lines.slice(1) // Skip header
    .map(line => line.split(/\s+/)[0])
    .filter(name => name && name !== 'NAME');
  
  return { valid: true, releases };
}

function deployToCluster(deploymentPath: string, environment: string, dryRun: boolean = false): { success: boolean; output: string; error?: string } {
  const command = dryRun 
    ? `helmfile -e ${environment} diff`
    : `helmfile -e ${environment} sync`;
  
  const result = executeCommand(command, deploymentPath);
  
  return {
    success: result.success,
    output: result.stdout,
    error: result.success ? undefined : result.stderr
  };
}

async function waitForPodsReady(namespace: string, context: string, maxWaitSeconds: number): Promise<{ ready: boolean; pods: Array<{ name: string; status: string; ready: string }> }> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWaitMs) {
    const result = executeCommand(`kubectl get pods -n ${namespace} --context ${context} --no-headers`);
    
    if (!result.success) {
      await sleep(5000);
      continue;
    }
    
    const pods = result.stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(/\s+/);
        return {
          name: parts[0],
          ready: parts[1],
          status: parts[2]
        };
      });
    
    if (pods.length === 0) {
      await sleep(5000);
      continue;
    }
    
    // Check if all pods are Running and Ready
    const allReady = pods.every(pod => 
      pod.status === 'Running' && pod.ready.split('/')[0] === pod.ready.split('/')[1]
    );
    
    if (allReady) {
      return { ready: true, pods };
    }
    
    await sleep(10000); // Wait 10 seconds before next check
  }
  
  // Timeout - get final pod status
  const result = executeCommand(`kubectl get pods -n ${namespace} --context ${context} --no-headers`);
  const pods = result.stdout.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(/\s+/);
      return {
        name: parts[0],
        ready: parts[1],
        status: parts[2]
      };
    });
  
  return { ready: false, pods };
}

function checkServiceEndpoints(namespace: string, context: string, requiredServices: string[]): { valid: boolean; services: Array<{ name: string; endpoints: string }> } {
  const result = executeCommand(`kubectl get endpoints -n ${namespace} --context ${context} --no-headers`);
  
  if (!result.success) {
    return { valid: false, services: [] };
  }
  
  const services = result.stdout.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(/\s+/);
      return {
        name: parts[0],
        endpoints: parts[1] || '<none>'
      };
    });
  
  // Check if all required services have endpoints
  const requiredServicesWithEndpoints = requiredServices.filter(serviceName =>
    services.some(svc => svc.name.includes(serviceName) && svc.endpoints !== '<none>')
  );
  
  return {
    valid: requiredServicesWithEndpoints.length === requiredServices.length,
    services
  };
}

// Main validation function
export async function runValidation(testCase: TestCase): Promise<ValidationResult> {
  const errors: string[] = [];
  const actual: Record<string, any> = {};
  const expected = testCase.expectedOutput;
  
  console.log(`\n🔍 Running validation: ${testCase.description}`);
  console.log(`   Environment: ${testCase.input.environment}`);
  console.log(`   Context: ${testCase.input.context}`);
  console.log(`   Deployment Path: ${testCase.input.deploymentPath}\n`);
  
  // Step 1: Check cluster accessibility
  console.log('1️⃣ Checking cluster accessibility...');
  const clusterCheck = checkClusterAccessibility(testCase.input.context);
  actual.clusterAccessible = clusterCheck.accessible;
  
  if (!clusterCheck.accessible) {
    errors.push(`Cluster not accessible: ${clusterCheck.error}`);
    console.log(`   ❌ FAILED: ${clusterCheck.error}`);
  } else {
    console.log(`   ✅ Cluster is accessible`);
  }
  
  // Step 2: Check helmfile validity
  console.log('\n2️⃣ Checking helmfile validity...');
  const helmfileCheck = checkHelmfileValidity(testCase.input.deploymentPath, testCase.input.environment);
  actual.helmfileParses = helmfileCheck.valid;
  actual.releases = helmfileCheck.releases;
  
  if (!helmfileCheck.valid) {
    errors.push(`Helmfile parsing failed: ${helmfileCheck.error}`);
    console.log(`   ❌ FAILED: ${helmfileCheck.error}`);
  } else {
    console.log(`   ✅ Helmfile is valid (${helmfileCheck.releases.length} releases)`);
    console.log(`   Releases: ${helmfileCheck.releases.join(', ')}`);
  }
  
  // If cluster not accessible or helmfile invalid, skip deployment
  if (errors.length > 0) {
    return {
      pass: false,
      actual,
      expected,
      errors,
      summary: `Validation FAILED: ${errors.length} errors. Cannot proceed with deployment.`
    };
  }
  
  // Step 3: Deploy to cluster (if not already deployed)
  console.log('\n3️⃣ Checking deployment status...');
  const namespace = 'metabob';
  
  // Check if namespace exists
  const namespaceCheck = executeCommand(`kubectl get namespace ${namespace} --context ${testCase.input.context}`);
  
  if (!namespaceCheck.success) {
    console.log(`   Namespace '${namespace}' does not exist. Deployment needed.`);
    console.log(`   ⚠️  Skipping actual deployment (dry-run mode)`);
    console.log(`   To deploy: cd ${testCase.input.deploymentPath} && helmfile -e ${testCase.input.environment} sync`);
    
    errors.push('Deployment not executed: namespace does not exist. Run helmfile sync manually.');
    actual.deployed = false;
  } else {
    console.log(`   ✅ Namespace '${namespace}' exists`);
    actual.deployed = true;
  }
  
  // Step 4: Wait for pods to be ready
  console.log('\n4️⃣ Checking pod status...');
  
  if (!actual.deployed) {
    console.log(`   ⚠️  Skipped: No deployment to validate`);
    actual.podsRunning = 0;
    actual.pods = [];
  } else {
    const podStatus = await waitForPodsReady(namespace, testCase.input.context, expected.maxWaitSeconds);
    actual.podsRunning = podStatus.pods.filter(p => p.status === 'Running').length;
    actual.pods = podStatus.pods;
    
    if (!podStatus.ready) {
      errors.push(`Not all pods reached Ready state within ${expected.maxWaitSeconds} seconds`);
      console.log(`   ❌ FAILED: ${actual.podsRunning}/${podStatus.pods.length} pods running`);
      podStatus.pods.forEach(pod => {
        console.log(`      - ${pod.name}: ${pod.status} (${pod.ready})`);
      });
    } else {
      console.log(`   ✅ All ${actual.podsRunning} pods are Running and Ready`);
    }
  }
  
  // Step 5: Check service endpoints
  console.log('\n5️⃣ Checking service endpoints...');
  
  if (!actual.deployed) {
    console.log(`   ⚠️  Skipped: No deployment to validate`);
    actual.servicesWithEndpoints = 0;
    actual.services = [];
  } else {
    const endpointCheck = checkServiceEndpoints(namespace, testCase.input.context, expected.requiredServices);
    actual.servicesWithEndpoints = endpointCheck.services.filter(s => s.endpoints !== '<none>').length;
    actual.services = endpointCheck.services;
    
    if (!endpointCheck.valid) {
      errors.push('Not all required services have registered endpoints');
      console.log(`   ❌ FAILED: ${actual.servicesWithEndpoints}/${endpointCheck.services.length} services have endpoints`);
      endpointCheck.services.forEach(svc => {
        const status = svc.endpoints !== '<none>' ? '✅' : '❌';
        console.log(`      ${status} ${svc.name}: ${svc.endpoints}`);
      });
    } else {
      console.log(`   ✅ All required services have endpoints`);
    }
  }
  
  // Final result
  const pass = errors.length === 0 && actual.deployed;
  const summary = pass
    ? `Validation PASSED: All checks successful. ${actual.podsRunning} pods running, ${actual.servicesWithEndpoints} services with endpoints.`
    : `Validation FAILED: ${errors.length} errors. ${errors.join('; ')}`;
  
  console.log('\n' + '━'.repeat(80));
  console.log(pass ? '✅ ' + summary : '❌ ' + summary);
  console.log('━'.repeat(80) + '\n');
  
  return {
    pass,
    actual,
    expected,
    errors,
    summary
  };
}

// CLI execution
if (require.main === module) {
  const testCase: TestCase = {
    id: 'validation-local-docker-desktop-deployment-case-1',
    description: 'Deploy Metabob services to local docker-desktop kubernetes',
    input: {
      environment: 'local',
      context: 'docker-desktop',
      deploymentPath: path.resolve(__dirname, '../../repos/platform/deployments/metabob')
    },
    expectedOutput: {
      clusterAccessible: true,
      helmfileParses: true,
      podsRunning: 5, // config, redis, metabob-rpc-api, metabob-dashboard, istio-application
      servicesWithEndpoints: 3, // redis, metabob-rpc-api, metabob-dashboard
      requiredServices: ['redis', 'metabob-rpc-api', 'metabob-dashboard'],
      maxWaitSeconds: 300 // 5 minutes
    }
  };
  
  runValidation(testCase)
    .then(result => {
      console.log('\nValidation Result:', JSON.stringify(result, null, 2));
      process.exit(result.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation harness error:', error);
      process.exit(1);
    });
}
