#!/usr/bin/env ts-node

/**
 * Create validation case impulses for dynamic activity creation with trailblazing pass 2
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// Test Case 1: Create REST endpoint
const testCase1 = {
  id: 'validation-dynamic-activity-creation-with-trailblazing-pass2-case-1',
  type: 'memo',
  pointer: {
    type: 'memo',
    content: JSON.stringify({
      input: {
        createActivityGoal: 'Create REST endpoint for user management',
        evolveActivityChanges: 'Add authentication middleware',
        debugActivityError: 'Database connection timeout on user fetch',
      },
      expectedOutput: {
        trailblazingObserved: true,
        lifecycleHooksObserved: true,
        httpRequestsObserved: true,
        activitiesInDatabase: 3,
        activityStructureValid: true,
        recoveryAttemptsPresent: true,
        stateDeltaPresent: true,
      },
      description: 'Basic workflow test: create, evolve, and debug activities for REST endpoint feature',
    }, null, 2),
    source: 'validation-harness',
  },
  priority: 'medium',
  budget: 1000,
  metadata: {
    specification: 'dynamic-activity-creation-with-trailblazing-pass2',
    category: 'validation-test-case',
    testType: 'e2e-workflow',
    purpose: 'Validate complete data flow: DevBob agent → trailblazing → lifecycle hooks → SurrealDB',
  },
  createdAt: new Date().toISOString(),
};

// Test Case 2: GraphQL API with complex error scenario
const testCase2 = {
  id: 'validation-dynamic-activity-creation-with-trailblazing-pass2-case-2',
  type: 'memo',
  pointer: {
    type: 'memo',
    content: JSON.stringify({
      input: {
        createActivityGoal: 'Create GraphQL API for product catalog',
        evolveActivityChanges: 'Add caching layer for expensive queries',
        debugActivityError: 'Memory leak in resolver chain causing pod crash',
      },
      expectedOutput: {
        trailblazingObserved: true,
        lifecycleHooksObserved: true,
        httpRequestsObserved: true,
        activitiesInDatabase: 3,
        activityStructureValid: true,
        recoveryAttemptsPresent: true,
        stateDeltaPresent: true,
      },
      description: 'Complex scenario test: GraphQL API with caching and memory leak debugging',
    }, null, 2),
    source: 'validation-harness',
  },
  priority: 'medium',
  budget: 1000,
  metadata: {
    specification: 'dynamic-activity-creation-with-trailblazing-pass2',
    category: 'validation-test-case',
    testType: 'e2e-workflow',
    purpose: 'Validate complex error scenarios trigger proper trailblazing recovery',
  },
  createdAt: new Date().toISOString(),
};

// Test Case 3: Microservice with intentional failure to trigger trailblazing
const testCase3 = {
  id: 'validation-dynamic-activity-creation-with-trailblazing-pass2-case-3',
  type: 'memo',
  pointer: {
    type: 'memo',
    content: JSON.stringify({
      input: {
        createActivityGoal: 'Create payment processing microservice',
        evolveActivityChanges: 'Add retry logic for transient payment gateway errors',
        debugActivityError: 'Race condition in concurrent transaction handling',
      },
      expectedOutput: {
        trailblazingObserved: true,
        lifecycleHooksObserved: true,
        httpRequestsObserved: true,
        activitiesInDatabase: 3,
        activityStructureValid: true,
        recoveryAttemptsPresent: true,
        stateDeltaPresent: true,
      },
      description: 'Trailblazing focus test: payment service with race condition requiring retry',
    }, null, 2),
    source: 'validation-harness',
  },
  priority: 'high',
  budget: 1500,
  metadata: {
    specification: 'dynamic-activity-creation-with-trailblazing-pass2',
    category: 'validation-test-case',
    testType: 'trailblazing-recovery',
    purpose: 'Validate trailblazing turn-by-turn retry with AI-generated continuation prompts',
    criticalTest: true,
  },
  createdAt: new Date().toISOString(),
};

// Harness impulse
const harnessImpulse = {
  id: 'harness-dynamic-activity-creation-with-trailblazing-pass2',
  type: 'file',
  pointer: {
    type: 'file',
    filePath: 'tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass2-harness.ts',
    source: 'validation-harness-creation',
  },
  priority: 'high',
  budget: 2000,
  metadata: {
    specification: 'dynamic-activity-creation-with-trailblazing-pass2',
    category: 'validation-harness',
    purpose: 'Execute end-to-end validation in DevBob Kubernetes environment',
    testCases: [
      'validation-dynamic-activity-creation-with-trailblazing-pass2-case-1',
      'validation-dynamic-activity-creation-with-trailblazing-pass2-case-2',
      'validation-dynamic-activity-creation-with-trailblazing-pass2-case-3',
    ],
    executionEnvironment: 'devbob.metabob.local (Kubernetes)',
    validationStrategy: 'kubectl exec → observe logs → query SurrealDB → verify structure',
    successCriteria: [
      'kubectl logs show turn-by-turn trailblazing',
      'Lifecycle hooks visible in logs',
      'SurrealDB contains 3+ activities',
      'Activity records have tasks, metadata, execution tracking',
      'End-to-end flow DevBob → RPC API → SurrealDB confirmed',
    ],
  },
  createdAt: new Date().toISOString(),
};

// Write impulses to disk
const impulseDir = './impulses';

writeFileSync(
  join(impulseDir, 'validation-dynamic-activity-creation-with-trailblazing-pass2-case-1.json'),
  JSON.stringify(testCase1, null, 2)
);

writeFileSync(
  join(impulseDir, 'validation-dynamic-activity-creation-with-trailblazing-pass2-case-2.json'),
  JSON.stringify(testCase2, null, 2)
);

writeFileSync(
  join(impulseDir, 'validation-dynamic-activity-creation-with-trailblazing-pass2-case-3.json'),
  JSON.stringify(testCase3, null, 2)
);

writeFileSync(
  join(impulseDir, 'harness-dynamic-activity-creation-with-trailblazing-pass2.json'),
  JSON.stringify(harnessImpulse, null, 2)
);

console.log('✅ Validation impulses created successfully');
console.log('\nTest Cases:');
console.log('  1. validation-dynamic-activity-creation-with-trailblazing-pass2-case-1 (REST endpoint)');
console.log('  2. validation-dynamic-activity-creation-with-trailblazing-pass2-case-2 (GraphQL API)');
console.log('  3. validation-dynamic-activity-creation-with-trailblazing-pass2-case-3 (Payment microservice - CRITICAL)');
console.log('\nHarness Impulse:');
console.log('  - harness-dynamic-activity-creation-with-trailblazing-pass2');
console.log('\nValidation Strategy:');
console.log('  kubectl exec into DevBob pod → execute create/evolve/debug activities');
console.log('  → observe kubectl logs for trailblazing and lifecycle hooks');
console.log('  → query SurrealDB for activity persistence');
console.log('  → verify structure: tasks, metadata, execution tracking');
console.log('\nSuccess Criteria:');
console.log('  ✓ Turn-by-turn trailblazing observed in logs');
console.log('  ✓ Lifecycle hooks (memory-management, activity-recommendations) visible');
console.log('  ✓ HTTP requests reach RPC API (POST/PATCH activity-execution)');
console.log('  ✓ SurrealDB contains 3+ activities with proper structure');
console.log('  ✓ End-to-end flow confirmed: DevBob → RPC API → SurrealDB');
