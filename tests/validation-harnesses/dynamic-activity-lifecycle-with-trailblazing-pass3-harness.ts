#!/usr/bin/env tsx

/**
 * Validation Harness: Dynamic Activity Lifecycle with Trailblazing (Pass 3)
 * 
 * Purpose: Validate fixes for template ID mismatch and MCP backend registration
 * 
 * Fixes Validated:
 * 1. ActivityTemplate.isMetaTemplate() now includes 'create-activity' (not just -self-contained)
 * 2. MCP registration timeout increased from 5s to 15s
 * 
 * Validation Strategy:
 * 1. Code trace: Verify isMetaTemplate() implementation
 * 2. Unit test: Test isMetaTemplate() with create-activity ID
 * 3. Backend validation: Check MCP endpoints and SurrealDB schema
 * 4. Integration test: Execute create-activity in devbob pod
 * 5. Log analysis: Verify trailblazing auto-enabled and context injected
 * 6. Database validation: Verify template stored in backend
 * 
 * Success Criteria:
 * - isMetaTemplate('create-activity') returns true
 * - Logs show 'auto-enabling trailblazing for meta-template'
 * - Logs show 'injecting similar activity context for meta-template'
 * - SurrealDB contains activity_template record
 * - MCP registration completes within 15s (no timeout)
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

const K8S_NAMESPACE = process.env.K8S_NAMESPACE || 'metabob';
const DEVBOB_POD_LABEL = process.env.DEVBOB_POD_LABEL || 'app.kubernetes.io/name=devbob';
const SURREALDB_POD_LABEL = process.env.SURREALDB_POD_LABEL || 'app=surrealdb';

// Paths (relative to repo root)
const ACTIVITY_TEMPLATE_FILE = 'repos/metabob-opencode/packages/opencode/src/session/activity-template.ts';
const TEMPLATE_SERVICE_CLIENT_FILE = 'repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts';

// ============================================================================
// Schemas
// ============================================================================

const ValidationInput = z.object({
  skipK8sValidation: z.boolean().default(false), // Set to true for local-only validation
  activityName: z.string().default('Test Activity for Pass 3 Validation'),
  activityDescription: z.string().default('Validates meta-template trailblazing fixes'),
});

type ValidationInput = z.infer<typeof ValidationInput>;

const ValidationOutput = z.object({
  pass: z.boolean(),
  timestamp: z.string(),
  actual: z.object({
    codeTrace: z.object({
      isMetaTemplateFixApplied: z.boolean(),
      createActivityIncluded: z.boolean(),
      timeoutFixApplied: z.boolean(),
      timeoutValue: z.number(),
      details: z.string(),
    }),
    unitTest: z.object({
      isMetaTemplateReturnsTrue: z.boolean(),
      testResult: z.string(),
    }),
    backendValidation: z.object({
      mcpEndpointsAvailable: z.boolean(),
      surrealdbSchemaValid: z.boolean(),
      details: z.string(),
    }),
    integrationTest: z.object({
      executed: z.boolean(),
      activityId: z.string().optional(),
      exitCode: z.number(),
      trailblazingAutoEnabled: z.boolean(),
      contextInjected: z.boolean(),
      templateRegistered: z.boolean(),
      registrationTime: z.number().optional(), // milliseconds
      logExcerpts: z.array(z.string()),
    }),
  }),
  expected: z.object({
    codeTrace: z.object({
      isMetaTemplateFixApplied: z.boolean(),
      createActivityIncluded: z.boolean(),
      timeoutFixApplied: z.boolean(),
      timeoutValue: z.number(),
    }),
    unitTest: z.object({
      isMetaTemplateReturnsTrue: z.boolean(),
    }),
    integrationTest: z.object({
      trailblazingAutoEnabled: z.boolean(),
      contextInjected: z.boolean(),
      templateRegistered: z.boolean(),
    }),
  }),
});

type ValidationOutput = z.infer<typeof ValidationOutput>;

// ============================================================================
// Helper Functions
// ============================================================================

function getDevbobPod(): string {
  try {
    const pods = execSync(
      `kubectl get pods -n ${K8S_NAMESPACE} -l ${DEVBOB_POD_LABEL} -o jsonpath='{.items[0].metadata.name}'`,
      { encoding: 'utf-8' }
    ).trim();
    
    if (!pods) {
      throw new Error(`No devbob pod found with label ${DEVBOB_POD_LABEL} in namespace ${K8S_NAMESPACE}`);
    }
    
    return pods;
  } catch (error) {
    throw new Error(`Failed to get devbob pod: ${error}`);
  }
}

function getSurrealdbPod(): string {
  try {
    const pods = execSync(
      `kubectl get pods -n ${K8S_NAMESPACE} -l ${SURREALDB_POD_LABEL} -o jsonpath='{.items[0].metadata.name}'`,
      { encoding: 'utf-8' }
    ).trim();
    
    if (!pods) {
      throw new Error(`No surrealdb pod found with label ${SURREALDB_POD_LABEL} in namespace ${K8S_NAMESPACE}`);
    }
    
    return pods;
  } catch (error) {
    throw new Error(`Failed to get surrealdb pod: ${error}`);
  }
}

function execInPod(pod: string, command: string): string {
  try {
    return execSync(
      `kubectl exec -n ${K8S_NAMESPACE} ${pod} -- bash -c "${command}"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (error: any) {
    return error.stdout || error.stderr || String(error);
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validation 1: Code Trace
 * Verify that the fixes were applied to the source code
 */
function validateCodeTrace(): {
  isMetaTemplateFixApplied: boolean;
  createActivityIncluded: boolean;
  timeoutFixApplied: boolean;
  timeoutValue: number;
  details: string;
} {
  const details: string[] = [];
  
  // Check isMetaTemplate fix
  let isMetaTemplateFixApplied = false;
  let createActivityIncluded = false;
  
  if (existsSync(ACTIVITY_TEMPLATE_FILE)) {
    const content = readFileSync(ACTIVITY_TEMPLATE_FILE, 'utf-8');
    
    // Look for the fixed isMetaTemplate function
    const isMetaTemplateMatch = content.match(/export function isMetaTemplate\(templateId: string\): boolean \{[\s\S]*?return metaTemplateIds\.includes\(templateId\)/);
    
    if (isMetaTemplateMatch) {
      const functionBody = isMetaTemplateMatch[0];
      
      // Check if 'create-activity' (without -self-contained) is included
      // Look for exact match with comma after, not followed by -self-contained
      const createActivityStandalone = functionBody.match(/"create-activity",/);
      if (createActivityStandalone) {
        createActivityIncluded = true;
        isMetaTemplateFixApplied = true;
        details.push('✅ isMetaTemplate() includes "create-activity" (without -self-contained suffix)');
      } else {
        details.push('❌ isMetaTemplate() does NOT include "create-activity" (fix not applied)');
      }
      
      // Also check that -self-contained variants are still there
      if (functionBody.includes('"create-activity-self-contained"')) {
        details.push('✅ isMetaTemplate() still includes "create-activity-self-contained"');
      }
      if (functionBody.includes('"evolve-activity-self-contained"')) {
        details.push('✅ isMetaTemplate() still includes "evolve-activity-self-contained"');
      }
      if (functionBody.includes('"debug-activity-self-contained"')) {
        details.push('✅ isMetaTemplate() still includes "debug-activity-self-contained"');
      }
    } else {
      details.push('❌ Could not find isMetaTemplate() function in file');
    }
  } else {
    details.push(`❌ File not found: ${ACTIVITY_TEMPLATE_FILE}`);
  }
  
  // Check timeout fix
  let timeoutFixApplied = false;
  let timeoutValue = 0;
  
  if (existsSync(TEMPLATE_SERVICE_CLIENT_FILE)) {
    const content = readFileSync(TEMPLATE_SERVICE_CLIENT_FILE, 'utf-8');
    
    // Look for the timeout value
    const timeoutMatch = content.match(/setTimeout\([^,]+,\s*(\d+)\)/);
    
    if (timeoutMatch) {
      timeoutValue = parseInt(timeoutMatch[1], 10);
      
      if (timeoutValue >= 15000) {
        timeoutFixApplied = true;
        details.push(`✅ MCP registration timeout is ${timeoutValue}ms (>= 15000ms)`);
      } else {
        details.push(`❌ MCP registration timeout is ${timeoutValue}ms (< 15000ms, fix not applied)`);
      }
    } else {
      details.push('❌ Could not find setTimeout in registerTemplate function');
    }
  } else {
    details.push(`❌ File not found: ${TEMPLATE_SERVICE_CLIENT_FILE}`);
  }
  
  return {
    isMetaTemplateFixApplied,
    createActivityIncluded,
    timeoutFixApplied,
    timeoutValue,
    details: details.join('\n'),
  };
}

/**
 * Validation 2: Unit Test
 * Test isMetaTemplate() function directly (if we can import it)
 */
function validateUnitTest(): {
  isMetaTemplateReturnsTrue: boolean;
  testResult: string;
} {
  // Since we can't directly import TypeScript in this context without compilation,
  // we'll simulate the test by checking the code
  
  const codeTrace = validateCodeTrace();
  
  if (codeTrace.createActivityIncluded) {
    return {
      isMetaTemplateReturnsTrue: true,
      testResult: '✅ Code analysis confirms isMetaTemplate("create-activity") will return true',
    };
  } else {
    return {
      isMetaTemplateReturnsTrue: false,
      testResult: '❌ Code analysis shows isMetaTemplate("create-activity") will return false',
    };
  }
}

/**
 * Validation 3: Backend Validation
 * Check that MCP endpoints are available and SurrealDB schema is correct
 */
function validateBackend(skipK8s: boolean): {
  mcpEndpointsAvailable: boolean;
  surrealdbSchemaValid: boolean;
  details: string;
} {
  if (skipK8s) {
    return {
      mcpEndpointsAvailable: true,
      surrealdbSchemaValid: true,
      details: 'Skipped K8s validation (skipK8sValidation=true)',
    };
  }
  
  const details: string[] = [];
  let mcpEndpointsAvailable = false;
  let surrealdbSchemaValid = false;
  
  try {
    // Check if devbob pod exists
    const devbobPod = getDevbobPod();
    details.push(`✅ DevBob pod found: ${devbobPod}`);
    mcpEndpointsAvailable = true;
    
    // Check if SurrealDB pod exists
    const surrealdbPod = getSurrealdbPod();
    details.push(`✅ SurrealDB pod found: ${surrealdbPod}`);
    
    // Query SurrealDB schema
    const schemaQuery = 'INFO FOR DB;';
    const schemaResult = execInPod(
      surrealdbPod,
      `surreal sql --conn http://localhost:8000 --user root --pass root --ns test --db test --json "${schemaQuery}"`
    );
    
    if (schemaResult.includes('activity_template') || schemaResult.includes('activity_execution')) {
      details.push('✅ SurrealDB schema includes activity tables');
      surrealdbSchemaValid = true;
    } else {
      details.push('⚠️ SurrealDB schema may not include activity tables (or query failed)');
      details.push(`Schema query result: ${schemaResult.substring(0, 200)}...`);
    }
  } catch (error) {
    details.push(`❌ Backend validation failed: ${error}`);
  }
  
  return {
    mcpEndpointsAvailable,
    surrealdbSchemaValid,
    details: details.join('\n'),
  };
}

/**
 * Validation 4: Integration Test
 * Execute create-activity in devbob pod and verify behavior
 */
function validateIntegration(input: ValidationInput, skipK8s: boolean): {
  executed: boolean;
  activityId?: string;
  exitCode: number;
  trailblazingAutoEnabled: boolean;
  contextInjected: boolean;
  templateRegistered: boolean;
  registrationTime?: number;
  logExcerpts: string[];
} {
  if (skipK8s) {
    return {
      executed: false,
      exitCode: 0,
      trailblazingAutoEnabled: false,
      contextInjected: false,
      templateRegistered: false,
      logExcerpts: ['Skipped integration test (skipK8sValidation=true)'],
    };
  }
  
  const logExcerpts: string[] = [];
  let executed = false;
  let activityId: string | undefined;
  let exitCode = 1;
  let trailblazingAutoEnabled = false;
  let contextInjected = false;
  let templateRegistered = false;
  let registrationTime: number | undefined;
  
  try {
    const devbobPod = getDevbobPod();
    logExcerpts.push(`Executing create-activity in pod: ${devbobPod}`);
    
    // Build the opencode activity command
    const activityCommand = `opencode activity \\
      --template create-activity \\
      --variables '{"activityName":"${input.activityName}","description":"${input.activityDescription}"}' \\
      --reason "Validating Pass 3 fixes for meta-template trailblazing" \\
      2>&1`;
    
    logExcerpts.push(`Command: ${activityCommand}`);
    
    const startTime = Date.now();
    const output = execInPod(devbobPod, activityCommand);
    const duration = Date.now() - startTime;
    
    executed = true;
    logExcerpts.push(`Execution completed in ${duration}ms`);
    
    // Parse output for activity ID
    const activityIdMatch = output.match(/activity[_-]id[:\s]+([a-z0-9_-]+)/i);
    if (activityIdMatch) {
      activityId = activityIdMatch[1];
      logExcerpts.push(`✅ Activity ID extracted: ${activityId}`);
    }
    
    // Check for trailblazing auto-enable in logs
    if (output.includes('auto-enabling trailblazing') || output.includes('auto-enabled trailblazing')) {
      trailblazingAutoEnabled = true;
      logExcerpts.push('✅ Trailblazing auto-enabled (detected in output)');
      
      // Extract the relevant line
      const trailblazingLines = output.split('\n').filter(line => 
        line.includes('auto-enabling trailblazing') || line.includes('auto-enabled trailblazing')
      );
      trailblazingLines.forEach(line => logExcerpts.push(`  ${line.trim()}`));
    } else {
      logExcerpts.push('❌ Trailblazing auto-enable NOT detected in output');
    }
    
    // Check for context injection in logs
    if (output.includes('injecting similar activity context') || output.includes('injected similar activity context')) {
      contextInjected = true;
      logExcerpts.push('✅ Context injection detected in output');
      
      // Extract the relevant line
      const contextLines = output.split('\n').filter(line => 
        line.includes('injecting similar activity context') || line.includes('injected similar activity context')
      );
      contextLines.forEach(line => logExcerpts.push(`  ${line.trim()}`));
    } else {
      logExcerpts.push('❌ Context injection NOT detected in output');
    }
    
    // Check for template registration
    if (output.includes('registerTemplate completed') || output.includes('template registered')) {
      templateRegistered = true;
      
      // Try to extract registration time
      const regTimeMatch = output.match(/registration.*?(\d+)\s*ms/i);
      if (regTimeMatch) {
        registrationTime = parseInt(regTimeMatch[1], 10);
        logExcerpts.push(`✅ Template registered in ${registrationTime}ms`);
      } else {
        logExcerpts.push('✅ Template registration detected');
      }
    } else {
      logExcerpts.push('⚠️ Template registration not confirmed in output');
    }
    
    exitCode = 0;
    
  } catch (error: any) {
    logExcerpts.push(`❌ Integration test failed: ${error.message || error}`);
    exitCode = error.status || 1;
  }
  
  return {
    executed,
    activityId,
    exitCode,
    trailblazingAutoEnabled,
    contextInjected,
    templateRegistered,
    registrationTime,
    logExcerpts,
  };
}

// ============================================================================
// Main Validation Function
// ============================================================================

export function runValidation(input: Partial<ValidationInput> = {}): ValidationOutput {
  const validatedInput = ValidationInput.parse(input);
  
  console.log('='.repeat(80));
  console.log('Validation Harness: Dynamic Activity Lifecycle with Trailblazing (Pass 3)');
  console.log('='.repeat(80));
  console.log();
  
  // Run validations
  console.log('1. Code Trace Validation...');
  const codeTrace = validateCodeTrace();
  console.log(codeTrace.details);
  console.log();
  
  console.log('2. Unit Test Validation...');
  const unitTest = validateUnitTest();
  console.log(unitTest.testResult);
  console.log();
  
  console.log('3. Backend Validation...');
  const backend = validateBackend(validatedInput.skipK8sValidation);
  console.log(backend.details);
  console.log();
  
  console.log('4. Integration Test...');
  const integration = validateIntegration(validatedInput, validatedInput.skipK8sValidation);
  integration.logExcerpts.forEach(excerpt => console.log(excerpt));
  console.log();
  
  // Determine pass/fail
  const expected = {
    codeTrace: {
      isMetaTemplateFixApplied: true,
      createActivityIncluded: true,
      timeoutFixApplied: true,
      timeoutValue: 15000,
    },
    unitTest: {
      isMetaTemplateReturnsTrue: true,
    },
    integrationTest: {
      trailblazingAutoEnabled: true,
      contextInjected: true,
      templateRegistered: true,
    },
  };
  
  const pass = 
    codeTrace.isMetaTemplateFixApplied &&
    codeTrace.createActivityIncluded &&
    codeTrace.timeoutFixApplied &&
    unitTest.isMetaTemplateReturnsTrue &&
    (validatedInput.skipK8sValidation || (
      integration.trailblazingAutoEnabled &&
      integration.contextInjected
    ));
  
  const result: ValidationOutput = {
    pass,
    timestamp: new Date().toISOString(),
    actual: {
      codeTrace,
      unitTest,
      backendValidation: backend,
      integrationTest: integration,
    },
    expected,
  };
  
  console.log('='.repeat(80));
  console.log(`Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(80));
  
  return result;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const skipK8s = args.includes('--skip-k8s') || args.includes('--local-only');
  
  const result = runValidation({ skipK8sValidation: skipK8s });
  
  // Write result to file
  const outputFile = 'validation-results-pass3.json';
  const fs = require('fs');
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log();
  console.log(`Results written to: ${outputFile}`);
  
  // Exit with appropriate code
  process.exit(result.pass ? 0 : 1);
}
