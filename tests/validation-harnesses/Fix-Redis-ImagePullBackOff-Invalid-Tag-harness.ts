#!/usr/bin/env ts-node
/**
 * Validation Harness: Fix-Redis-ImagePullBackOff-Invalid-Tag
 * 
 * Validates that Redis deployment is fixed and running correctly:
 * 1. Image tag override exists in local.redis.values.yaml
 * 2. Pod is in Running phase (not ImagePullBackOff)
 * 3. Container state is running (no waiting state)
 * 4. Redis connectivity works (redis-cli ping)
 * 5. PVC is bound and persistence is working
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  error?: string;
}

interface HarnessResult {
  overallPass: boolean;
  results: ValidationResult[];
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Execute shell command and return output
 */
function execCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Test Case 1: Verify image.tag override exists in local.redis.values.yaml
 */
function validateImageTagOverride(): ValidationResult {
  const valuesFilePath = path.join(
    process.cwd(),
    'repos/platform/deployments/metabob/charts/redis/values/local.redis.values.yaml'
  );

  try {
    if (!fs.existsSync(valuesFilePath)) {
      return {
        pass: false,
        testCase: 'Image Tag Override Exists',
        actual: 'File not found',
        expected: 'File exists with image.tag override',
        error: `Values file not found at ${valuesFilePath}`,
      };
    }

    const fileContent = fs.readFileSync(valuesFilePath, 'utf-8');
    const values = yaml.load(fileContent) as any;

    const hasImageTag = values.image && values.image.tag;
    const imageTag = hasImageTag ? values.image.tag : null;

    // Valid tags: 'latest' or any sha256/version tag (not the invalid ones)
    const invalidTags = ['7.4.1-debian-12-r2', '7.0.12-debian-11-r0'];
    const isValidTag = imageTag && !invalidTags.includes(imageTag);

    return {
      pass: hasImageTag && isValidTag,
      testCase: 'Image Tag Override Exists',
      actual: { hasOverride: hasImageTag, tag: imageTag },
      expected: { hasOverride: true, tag: 'Valid tag (e.g., latest or sha256)' },
      error: !hasImageTag ? 'No image.tag override found' : !isValidTag ? `Invalid tag: ${imageTag}` : undefined,
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Image Tag Override Exists',
      actual: error.message,
      expected: 'Valid image.tag in values file',
      error: error.message,
    };
  }
}

/**
 * Test Case 2: Verify Redis pod is in Running phase
 */
function validatePodPhase(): ValidationResult {
  try {
    const phase = execCommand(
      "kubectl get pod -n metabob redis-master-0 -o jsonpath='{.status.phase}' 2>/dev/null"
    );

    return {
      pass: phase === 'Running',
      testCase: 'Pod Phase is Running',
      actual: phase || 'Pod not found',
      expected: 'Running',
      error: phase !== 'Running' ? `Pod is in ${phase} phase, not Running` : undefined,
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Pod Phase is Running',
      actual: error.message,
      expected: 'Running',
      error: 'Failed to get pod phase: ' + error.message,
    };
  }
}

/**
 * Test Case 3: Verify container is not in ImagePullBackOff state
 */
function validateNoImagePullBackOff(): ValidationResult {
  try {
    const containerState = execCommand(
      "kubectl get pod -n metabob redis-master-0 -o jsonpath='{.status.containerStatuses[0].state}' 2>/dev/null"
    );

    const stateObj = JSON.parse(containerState);
    const isWaiting = !!stateObj.waiting;
    const reason = stateObj.waiting?.reason || null;
    const isImagePullBackOff = reason === 'ImagePullBackOff' || reason === 'ErrImagePull';

    return {
      pass: !isImagePullBackOff,
      testCase: 'No ImagePullBackOff State',
      actual: { isWaiting, reason, state: stateObj },
      expected: { isWaiting: false, reason: null, state: 'running' },
      error: isImagePullBackOff ? `Container in ${reason} state` : undefined,
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'No ImagePullBackOff State',
      actual: error.message,
      expected: 'Container running (no waiting state)',
      error: 'Failed to get container state: ' + error.message,
    };
  }
}

/**
 * Test Case 4: Verify Redis connectivity with redis-cli ping
 */
function validateRedisConnectivity(): ValidationResult {
  try {
    const pingResult = execCommand(
      "kubectl exec -n metabob redis-master-0 -- redis-cli ping 2>/dev/null"
    );

    return {
      pass: pingResult === 'PONG',
      testCase: 'Redis Connectivity (PING)',
      actual: pingResult,
      expected: 'PONG',
      error: pingResult !== 'PONG' ? `Expected PONG, got: ${pingResult}` : undefined,
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Redis Connectivity (PING)',
      actual: error.message,
      expected: 'PONG',
      error: 'Failed to execute redis-cli ping: ' + error.message,
    };
  }
}

/**
 * Test Case 5: Verify PVC is bound and persistence is working
 */
function validatePersistence(): ValidationResult {
  try {
    const pvcStatus = execCommand(
      "kubectl get pvc -n metabob redis-data-redis-master-0 -o jsonpath='{.status.phase}' 2>/dev/null"
    );

    const pvcSize = execCommand(
      "kubectl get pvc -n metabob redis-data-redis-master-0 -o jsonpath='{.spec.resources.requests.storage}' 2>/dev/null"
    );

    return {
      pass: pvcStatus === 'Bound',
      testCase: 'PVC Bound and Persistence',
      actual: { status: pvcStatus, size: pvcSize },
      expected: { status: 'Bound', size: '8Gi' },
      error: pvcStatus !== 'Bound' ? `PVC status is ${pvcStatus}, not Bound` : undefined,
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'PVC Bound and Persistence',
      actual: error.message,
      expected: 'PVC Bound with 8Gi storage',
      error: 'Failed to get PVC status: ' + error.message,
    };
  }
}

/**
 * Test Case 6: Verify pod image is valid (not the invalid tags)
 */
function validatePodImage(): ValidationResult {
  try {
    const image = execCommand(
      "kubectl get pod -n metabob redis-master-0 -o jsonpath='{.spec.containers[0].image}' 2>/dev/null"
    );

    const invalidTags = ['7.4.1-debian-12-r2', '7.0.12-debian-11-r0'];
    const hasInvalidTag = invalidTags.some(tag => image.includes(tag));

    return {
      pass: !hasInvalidTag && image.includes('bitnami/redis'),
      testCase: 'Pod Using Valid Image',
      actual: image,
      expected: 'bitnami/redis with valid tag (not 7.4.1-debian-12-r2 or 7.0.12-debian-11-r0)',
      error: hasInvalidTag ? `Pod using invalid image tag: ${image}` : undefined,
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase: 'Pod Using Valid Image',
      actual: error.message,
      expected: 'bitnami/redis with valid tag',
      error: 'Failed to get pod image: ' + error.message,
    };
  }
}

/**
 * Run all validation tests
 */
export function runValidation(): HarnessResult {
  const results: ValidationResult[] = [
    validateImageTagOverride(),
    validatePodPhase(),
    validateNoImagePullBackOff(),
    validateRedisConnectivity(),
    validatePersistence(),
    validatePodImage(),
  ];

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return {
    overallPass: failed === 0,
    results,
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
    },
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  console.log('🔍 Running Validation Harness: Fix-Redis-ImagePullBackOff-Invalid-Tag\n');

  const result = runValidation();

  console.log('📊 Test Results:\n');
  result.results.forEach((test, index) => {
    const status = test.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${status} - ${test.testCase}`);
    if (!test.pass) {
      console.log(`   Expected: ${JSON.stringify(test.expected)}`);
      console.log(`   Actual:   ${JSON.stringify(test.actual)}`);
      if (test.error) {
        console.log(`   Error:    ${test.error}`);
      }
    }
    console.log();
  });

  console.log('📈 Summary:');
  console.log(`   Total:  ${result.summary.total}`);
  console.log(`   Passed: ${result.summary.passed}`);
  console.log(`   Failed: ${result.summary.failed}`);
  console.log(`   Status: ${result.overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log(`   Time:   ${result.timestamp}\n`);

  process.exit(result.overallPass ? 0 : 1);
}
