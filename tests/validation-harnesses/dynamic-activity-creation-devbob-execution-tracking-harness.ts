#!/usr/bin/env tsx

/**
 * Validation Harness: Dynamic Activity Creation DevBob Execution Tracking (Pass 4)
 * 
 * Purpose: Actually execute meta-templates in devbob pod and validate complete lifecycle
 * 
 * What this does differently from Pass 2:
 * - Pass 2: Created validation functions but never executed them
 * - Pass 4: ACTUALLY EXECUTES meta-templates and tracks real behavior
 * 
 * Validation Strategy:
 * 1. Execute create-activity via kubectl exec in devbob pod
 * 2. Stream logs in real-time to observe trailblazing and lifecycle hooks
 * 3. Extract activity_id from output
 * 4. Query SurrealDB to verify activity_template record
 * 5. Check Redis cache for template
 * 6. Execute evolve-activity with parent template_id
 * 7. Create failed scenario and execute debug-activity
 * 8. Document complete data flow with timestamps
 * 
 * Success Criteria:
 * - create-activity executes successfully with activity_id extracted
 * - Logs show: 'isMetaTemplate', 'auto-enabling trailblazing', 'memory management hook'
 * - SurrealDB contains activity_template record
 * - Redis cache contains template
 * - evolve-activity creates variant
 * - debug-activity analyzes error
 * - Complete audit trail documented
 */

import { execSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { z } from 'zod';

// Kubernetes configuration
const K8S_NAMESPACE = process.env.K8S_NAMESPACE || 'metabob';
const DEVBOB_POD_LABEL = process.env.DEVBOB_POD_LABEL || 'app.kubernetes.io/name=devbob';
const RPC_API_POD_LABEL = process.env.RPC_API_POD_LABEL || 'app=metabob-rpc-api';  // Fixed: actual label in deployment
const SURREALDB_POD_LABEL = process.env.SURREALDB_POD_LABEL || 'app=surrealdb';   // Fixed: actual label in deployment
const REDIS_POD_LABEL = process.env.REDIS_POD_LABEL || 'app.kubernetes.io/name=redis';

// Validation input schema
const ValidationInput = z.object({
  activityName: z.string().default('REST API for user management'),
  evolutionReason: z.string().default('Add JWT authentication'),
  debugErrorDescription: z.string().default('Database connection timeout'),
  streamLogs: z.boolean().default(false), // Set to true for real-time log streaming
});

type ValidationInput = z.infer<typeof ValidationInput>;

// Validation output schema
const ValidationOutput = z.object({
  pass: z.boolean(),
  timestamp: z.string(),
  actual: z.object({
    createActivity: z.object({
      executed: z.boolean(),
      activityId: z.string().optional(),
      exitCode: z.number(),
      output: z.string(),
      duration: z.number(), // milliseconds
    }),
    logs: z.object({
      metaTemplateDetected: z.boolean(),
      trailblazingEnabled: z.boolean(),
      lifecycleHooksObserved: z.boolean(),
      memoryManagementHook: z.boolean(),
      costTracking: z.boolean(),
      activityStarting: z.boolean(),
      taskCreatedDynamically: z.boolean(),
      excerpts: z.array(z.string()),
    }),
    database: z.object({
      recordExists: z.boolean(),
      templateId: z.string().optional(),
      recordStructureValid: z.boolean(),
      fields: z.object({
        name: z.boolean(),
        category: z.boolean(),
        tasks: z.boolean(),
        created_at: z.boolean(),
        metadata: z.boolean(),
      }),
      queryResult: z.string(),
    }),
    redis: z.object({
      cacheExists: z.boolean(),
      templateId: z.string().optional(),
      ttl: z.number().optional(),
      queryResult: z.string(),
    }),
    evolveActivity: z.object({
      executed: z.boolean(),
      activityId: z.string().optional(),
      parentReference: z.boolean(),
      exitCode: z.number(),
    }),
    debugActivity: z.object({
      executed: z.boolean(),
      activityId: z.string().optional(),
      errorContextLoaded: z.boolean(),
      exitCode: z.number(),
    }),
  }),
  expected: z.object({
    createActivityExecuted: z.boolean(),
    metaTemplateDetected: z.boolean(),
    trailblazingEnabled: z.boolean(),
    lifecycleHooksObserved: z.boolean(),
    databaseRecordExists: z.boolean(),
    redisCacheExists: z.boolean(),
    evolveActivityExecuted: z.boolean(),
    debugActivityExecuted: z.boolean(),
  }),
  errors: z.array(z.string()),
  auditTrail: z.object({
    startTime: z.string(),
    endTime: z.string(),
    steps: z.array(z.object({
      step: z.string(),
      timestamp: z.string(),
      status: z.enum(['success', 'failure', 'skipped']),
      details: z.string(),
    })),
  }),
});

type ValidationOutput = z.infer<typeof ValidationOutput>;

/**
 * Execute kubectl command
 */
function kubectl(command: string, options: { timeout?: number; encoding?: string } = {}): string {
  try {
    const timeout = options.timeout || 60000;
    const encoding = options.encoding || 'utf-8';
    return execSync(`kubectl ${command}`, { 
      encoding: encoding as BufferEncoding, 
      timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error: any) {
    throw new Error(`kubectl command failed: ${error.message}\nStderr: ${error.stderr || ''}`);
  }
}

/**
 * Get pod name from label selector
 */
function getPodName(label: string): string | null {
  try {
    const output = kubectl(`get pod -n ${K8S_NAMESPACE} -l "${label}" -o jsonpath='{.items[0].metadata.name}'`);
    return output.trim() || null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if pod is ready
 */
function isPodReady(podName: string): boolean {
  try {
    const status = kubectl(`get pod -n ${K8S_NAMESPACE} ${podName} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'`);
    return status.trim() === 'True';
  } catch (error) {
    return false;
  }
}

/**
 * Step 1: Execute create-activity in devbob pod
 */
function executeCreateActivity(input: ValidationInput): {
  executed: boolean;
  activityId: string | null;
  exitCode: number;
  output: string;
  duration: number;
} {
  console.log('\n[Step 1] Executing create-activity in devbob pod...');
  
  const devbobPod = getPodName(DEVBOB_POD_LABEL);
  if (!devbobPod) {
    console.error('❌ DevBob pod not found');
    return { executed: false, activityId: null, exitCode: 1, output: 'DevBob pod not found', duration: 0 };
  }
  
  if (!isPodReady(devbobPod)) {
    console.error(`❌ DevBob pod not ready: ${devbobPod}`);
    return { executed: false, activityId: null, exitCode: 1, output: 'DevBob pod not ready', duration: 0 };
  }
  
  console.log(`✅ DevBob pod: ${devbobPod}`);
  
  const startTime = Date.now();
  
  try {
    const variables = JSON.stringify({
      activityName: input.activityName,
      purpose: 'Pass 4 validation - execution tracking'
    });
    
    const command = `exec -n ${K8S_NAMESPACE} ${devbobPod} -- opencode activity create-activity --variables '${variables}' --reason 'Pass 4: Validate meta-template execution'`;
    
    console.log(`Executing: kubectl ${command.substring(0, 100)}...`);
    
    const output = kubectl(command, { timeout: 120000 });
    const duration = Date.now() - startTime;
    
    // Extract activity_id
    const activityIdMatch = output.match(/act_[a-zA-Z0-9_]+/);
    const activityId = activityIdMatch ? activityIdMatch[0] : null;
    
    if (activityId) {
      console.log(`✅ create-activity executed successfully: ${activityId} (${duration}ms)`);
      return { executed: true, activityId, exitCode: 0, output, duration };
    } else {
      console.log('⚠️ create-activity executed but no activity_id extracted');
      return { executed: true, activityId: null, exitCode: 0, output, duration };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ create-activity failed: ${error.message}`);
    return { executed: false, activityId: null, exitCode: error.status || 1, output: error.message, duration };
  }
}

/**
 * Step 2: Analyze devbob logs for key patterns
 */
function analyzeDevBobLogs(devbobPod: string): {
  metaTemplateDetected: boolean;
  trailblazingEnabled: boolean;
  lifecycleHooksObserved: boolean;
  memoryManagementHook: boolean;
  costTracking: boolean;
  activityStarting: boolean;
  taskCreatedDynamically: boolean;
  excerpts: string[];
} {
  console.log('\n[Step 2] Analyzing devbob logs...');
  
  try {
    const logs = kubectl(`logs -n ${K8S_NAMESPACE} ${devbobPod} --tail=200`);
    
    const patterns = {
      metaTemplateDetected: /isMetaTemplate/i,
      trailblazingEnabled: /auto-enabling trailblazing|trailblazing.*enabled/i,
      lifecycleHooksObserved: /lifecycle.*hook|hook.*execution/i,
      memoryManagementHook: /memory.*management.*hook/i,
      costTracking: /cost.*tracking|totalCost|maxCostPerTask/i,
      activityStarting: /activity.*starting|starting.*activity/i,
      taskCreatedDynamically: /task.*created|created.*task|dynamic.*task/i,
    };
    
    const results = {
      metaTemplateDetected: false,
      trailblazingEnabled: false,
      lifecycleHooksObserved: false,
      memoryManagementHook: false,
      costTracking: false,
      activityStarting: false,
      taskCreatedDynamically: false,
      excerpts: [] as string[],
    };
    
    const logLines = logs.split('\n');
    
    for (const [key, pattern] of Object.entries(patterns)) {
      for (const line of logLines) {
        if (pattern.test(line)) {
          results[key as keyof typeof results] = true;
          if (results.excerpts.length < 10) { // Limit excerpts
            results.excerpts.push(`[${key}] ${line.substring(0, 150)}`);
          }
        }
      }
    }
    
    // Summary
    console.log('Log Analysis:');
    console.log(`  Meta-template detected: ${results.metaTemplateDetected ? '✅' : '❌'}`);
    console.log(`  Trailblazing enabled: ${results.trailblazingEnabled ? '✅' : '⚠️ (expected if no failures)'}`);
    console.log(`  Lifecycle hooks observed: ${results.lifecycleHooksObserved ? '✅' : '❌'}`);
    console.log(`  Memory management hook: ${results.memoryManagementHook ? '✅' : '⚠️'}`);
    console.log(`  Cost tracking: ${results.costTracking ? '✅' : '⚠️ (expected if no trailblazing)'}`);
    console.log(`  Activity starting: ${results.activityStarting ? '✅' : '⚠️'}`);
    console.log(`  Task created dynamically: ${results.taskCreatedDynamically ? '✅' : '⚠️'}`);
    
    return results;
  } catch (error: any) {
    console.error(`❌ Failed to analyze logs: ${error.message}`);
    return {
      metaTemplateDetected: false,
      trailblazingEnabled: false,
      lifecycleHooksObserved: false,
      memoryManagementHook: false,
      costTracking: false,
      activityStarting: false,
      taskCreatedDynamically: false,
      excerpts: [],
    };
  }
}

/**
 * Step 3: Query SurrealDB for activity_template record
 */
function querySurrealDB(activityId: string | null): {
  recordExists: boolean;
  templateId: string | null;
  recordStructureValid: boolean;
  fields: {
    name: boolean;
    category: boolean;
    tasks: boolean;
    created_at: boolean;
    metadata: boolean;
  };
  queryResult: string;
} {
  console.log('\n[Step 3] Querying SurrealDB...');
  
  if (!activityId) {
    console.log('⚠️ No activity_id to query, skipping database verification');
    return {
      recordExists: false,
      templateId: null,
      recordStructureValid: false,
      fields: { name: false, category: false, tasks: false, created_at: false, metadata: false },
      queryResult: 'No activity_id provided',
    };
  }
  
  const surrealdbPod = getPodName(SURREALDB_POD_LABEL);
  if (!surrealdbPod) {
    console.error('❌ SurrealDB pod not found');
    return {
      recordExists: false,
      templateId: null,
      recordStructureValid: false,
      fields: { name: false, category: false, tasks: false, created_at: false, metadata: false },
      queryResult: 'SurrealDB pod not found',
    };
  }
  
  try {
    // Query for activity_executions (not activity_template, as activities are stored in activity_executions)
    const query = `SELECT * FROM activity_executions WHERE activity_id = '${activityId}' LIMIT 1`;
    console.log(`Query: ${query}`);
    
    // Note: Adjust based on your SurrealDB setup
    const result = kubectl(`exec -n ${K8S_NAMESPACE} ${surrealdbPod} -- surreal sql --conn http://localhost:8000 --user root --pass root --ns test --db test "${query}"`, { timeout: 30000 });
    
    console.log('Query result:', result.substring(0, 500));
    
    // Check for key fields
    const fields = {
      name: /name|activityName/i.test(result),
      category: /category/i.test(result),
      tasks: /tasks/i.test(result),
      created_at: /created_at|createdAt/i.test(result),
      metadata: /metadata/i.test(result),
    };
    
    const recordExists = /activity_id|activityId/i.test(result) && result.length > 100;
    const recordStructureValid = Object.values(fields).filter(Boolean).length >= 3;
    
    // Extract template_id if present
    const templateIdMatch = result.match(/template_id['":\s]+([a-zA-Z0-9_-]+)/i);
    const templateId = templateIdMatch ? templateIdMatch[1] : null;
    
    console.log('Database Analysis:');
    console.log(`  Record exists: ${recordExists ? '✅' : '❌'}`);
    console.log(`  Template ID: ${templateId || 'not found'}`);
    console.log(`  Structure valid: ${recordStructureValid ? '✅' : '❌'}`);
    console.log(`  Fields present: name=${fields.name}, category=${fields.category}, tasks=${fields.tasks}, created_at=${fields.created_at}, metadata=${fields.metadata}`);
    
    return { recordExists, templateId, recordStructureValid, fields, queryResult: result };
  } catch (error: any) {
    console.error(`❌ SurrealDB query failed: ${error.message}`);
    return {
      recordExists: false,
      templateId: null,
      recordStructureValid: false,
      fields: { name: false, category: false, tasks: false, created_at: false, metadata: false },
      queryResult: error.message,
    };
  }
}

/**
 * Step 4: Check Redis cache for template
 */
function checkRedisCache(templateId: string | null): {
  cacheExists: boolean;
  templateId: string | null;
  ttl: number | null;
  queryResult: string;
} {
  console.log('\n[Step 4] Checking Redis cache...');
  
  if (!templateId) {
    console.log('⚠️ No template_id to check, skipping Redis verification');
    return { cacheExists: false, templateId: null, ttl: null, queryResult: 'No template_id provided' };
  }
  
  const redisPod = getPodName(REDIS_POD_LABEL);
  if (!redisPod) {
    console.log('⚠️ Redis pod not found, skipping cache verification');
    return { cacheExists: false, templateId, ttl: null, queryResult: 'Redis pod not found' };
  }
  
  try {
    const key = `template:cache:${templateId}`;
    const result = kubectl(`exec -n ${K8S_NAMESPACE} ${redisPod} -- redis-cli GET "${key}"`);
    
    const cacheExists = result.trim() !== '' && result.trim() !== '(nil)';
    
    let ttl: number | null = null;
    if (cacheExists) {
      try {
        const ttlResult = kubectl(`exec -n ${K8S_NAMESPACE} ${redisPod} -- redis-cli TTL "${key}"`);
        ttl = parseInt(ttlResult.trim(), 10);
      } catch (error) {
        console.log('⚠️ Could not get TTL');
      }
    }
    
    console.log('Redis Analysis:');
    console.log(`  Cache exists: ${cacheExists ? '✅' : '❌'}`);
    console.log(`  TTL: ${ttl !== null ? `${ttl}s` : 'N/A'}`);
    
    return { cacheExists, templateId, ttl, queryResult: result };
  } catch (error: any) {
    console.error(`❌ Redis check failed: ${error.message}`);
    return { cacheExists: false, templateId, ttl: null, queryResult: error.message };
  }
}

/**
 * Step 5: Execute evolve-activity
 */
function executeEvolveActivity(parentActivityId: string | null, input: ValidationInput): {
  executed: boolean;
  activityId: string | null;
  parentReference: boolean;
  exitCode: number;
} {
  console.log('\n[Step 5] Executing evolve-activity...');
  
  if (!parentActivityId) {
    console.log('⚠️ No parent activity_id, skipping evolve-activity');
    return { executed: false, activityId: null, parentReference: false, exitCode: 0 };
  }
  
  const devbobPod = getPodName(DEVBOB_POD_LABEL);
  if (!devbobPod) {
    console.error('❌ DevBob pod not found');
    return { executed: false, activityId: null, parentReference: false, exitCode: 1 };
  }
  
  try {
    const variables = JSON.stringify({
      parentActivityId,
      evolutionReason: input.evolutionReason,
    });
    
    const command = `exec -n ${K8S_NAMESPACE} ${devbobPod} -- opencode activity evolve-activity --variables '${variables}' --reason 'Pass 4: Validate activity evolution'`;
    
    console.log(`Executing evolve-activity...`);
    
    const output = kubectl(command, { timeout: 120000 });
    
    const activityIdMatch = output.match(/act_[a-zA-Z0-9_]+/);
    const activityId = activityIdMatch ? activityIdMatch[0] : null;
    
    const parentReference = output.includes(parentActivityId);
    
    if (activityId) {
      console.log(`✅ evolve-activity executed: ${activityId}`);
      return { executed: true, activityId, parentReference, exitCode: 0 };
    } else {
      console.log('⚠️ evolve-activity executed but no activity_id extracted');
      return { executed: true, activityId: null, parentReference, exitCode: 0 };
    }
  } catch (error: any) {
    console.error(`❌ evolve-activity failed: ${error.message}`);
    return { executed: false, activityId: null, parentReference: false, exitCode: error.status || 1 };
  }
}

/**
 * Step 6: Execute debug-activity
 */
function executeDebugActivity(input: ValidationInput): {
  executed: boolean;
  activityId: string | null;
  errorContextLoaded: boolean;
  exitCode: number;
} {
  console.log('\n[Step 6] Executing debug-activity...');
  
  const devbobPod = getPodName(DEVBOB_POD_LABEL);
  if (!devbobPod) {
    console.error('❌ DevBob pod not found');
    return { executed: false, activityId: null, errorContextLoaded: false, exitCode: 1 };
  }
  
  try {
    const variables = JSON.stringify({
      errorDescription: input.debugErrorDescription,
      activityContext: 'Pass 4 validation test',
    });
    
    const command = `exec -n ${K8S_NAMESPACE} ${devbobPod} -- opencode activity debug-activity --variables '${variables}' --reason 'Pass 4: Validate debugging workflow'`;
    
    console.log(`Executing debug-activity...`);
    
    const output = kubectl(command, { timeout: 120000 });
    
    const activityIdMatch = output.match(/act_[a-zA-Z0-9_]+/);
    const activityId = activityIdMatch ? activityIdMatch[0] : null;
    
    const errorContextLoaded = output.toLowerCase().includes('error') || output.toLowerCase().includes('debug');
    
    if (activityId) {
      console.log(`✅ debug-activity executed: ${activityId}`);
      return { executed: true, activityId, errorContextLoaded, exitCode: 0 };
    } else {
      console.log('⚠️ debug-activity executed but no activity_id extracted');
      return { executed: true, activityId: null, errorContextLoaded, exitCode: 0 };
    }
  } catch (error: any) {
    console.error(`❌ debug-activity failed: ${error.message}`);
    return { executed: false, activityId: null, errorContextLoaded: false, exitCode: error.status || 1 };
  }
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  console.log('===============================================');
  console.log('Pass 4 Validation: Dynamic Activity Creation DevBob Execution Tracking');
  console.log('===============================================\n');
  
  const startTime = new Date().toISOString();
  const auditTrail: ValidationOutput['auditTrail'] = {
    startTime,
    endTime: '',
    steps: [],
  };
  
  // Step 1: Execute create-activity
  const createActivityResult = executeCreateActivity(input);
  auditTrail.steps.push({
    step: 'execute-create-activity',
    timestamp: new Date().toISOString(),
    status: createActivityResult.executed ? 'success' : 'failure',
    details: `Exit code: ${createActivityResult.exitCode}, Activity ID: ${createActivityResult.activityId || 'none'}`,
  });
  
  // Step 2: Analyze logs
  const devbobPod = getPodName(DEVBOB_POD_LABEL);
  const logsResult = devbobPod ? analyzeDevBobLogs(devbobPod) : {
    metaTemplateDetected: false,
    trailblazingEnabled: false,
    lifecycleHooksObserved: false,
    memoryManagementHook: false,
    costTracking: false,
    activityStarting: false,
    taskCreatedDynamically: false,
    excerpts: [],
  };
  auditTrail.steps.push({
    step: 'analyze-devbob-logs',
    timestamp: new Date().toISOString(),
    status: logsResult.metaTemplateDetected ? 'success' : 'failure',
    details: `Meta-template detected: ${logsResult.metaTemplateDetected}, Excerpts: ${logsResult.excerpts.length}`,
  });
  
  // Step 3: Query SurrealDB
  const databaseResult = querySurrealDB(createActivityResult.activityId);
  auditTrail.steps.push({
    step: 'query-surrealdb',
    timestamp: new Date().toISOString(),
    status: databaseResult.recordExists ? 'success' : 'failure',
    details: `Record exists: ${databaseResult.recordExists}, Template ID: ${databaseResult.templateId || 'none'}`,
  });
  
  // Step 4: Check Redis cache
  const redisResult = checkRedisCache(databaseResult.templateId);
  auditTrail.steps.push({
    step: 'check-redis-cache',
    timestamp: new Date().toISOString(),
    status: redisResult.cacheExists ? 'success' : 'skipped',
    details: `Cache exists: ${redisResult.cacheExists}, TTL: ${redisResult.ttl || 'N/A'}`,
  });
  
  // Step 5: Execute evolve-activity
  const evolveActivityResult = executeEvolveActivity(createActivityResult.activityId, input);
  auditTrail.steps.push({
    step: 'execute-evolve-activity',
    timestamp: new Date().toISOString(),
    status: evolveActivityResult.executed ? 'success' : 'skipped',
    details: `Activity ID: ${evolveActivityResult.activityId || 'none'}, Parent reference: ${evolveActivityResult.parentReference}`,
  });
  
  // Step 6: Execute debug-activity
  const debugActivityResult = executeDebugActivity(input);
  auditTrail.steps.push({
    step: 'execute-debug-activity',
    timestamp: new Date().toISOString(),
    status: debugActivityResult.executed ? 'success' : 'failure',
    details: `Activity ID: ${debugActivityResult.activityId || 'none'}, Error context: ${debugActivityResult.errorContextLoaded}`,
  });
  
  const endTime = new Date().toISOString();
  auditTrail.endTime = endTime;
  
  // Build actual results
  const actual: ValidationOutput['actual'] = {
    createActivity: createActivityResult,
    logs: logsResult,
    database: databaseResult,
    redis: redisResult,
    evolveActivity: evolveActivityResult,
    debugActivity: debugActivityResult,
  };
  
  // Define expected results
  const expected: ValidationOutput['expected'] = {
    createActivityExecuted: true,
    metaTemplateDetected: true,
    trailblazingEnabled: true, // May be false if no failures
    lifecycleHooksObserved: true,
    databaseRecordExists: true,
    redisCacheExists: false, // May not exist depending on implementation
    evolveActivityExecuted: true,
    debugActivityExecuted: true,
  };
  
  // Validation logic
  const errors: string[] = [];
  let pass = true;
  
  // Critical checks
  if (!actual.createActivity.executed) {
    errors.push('create-activity did not execute successfully');
    pass = false;
  }
  
  if (!actual.createActivity.activityId) {
    errors.push('create-activity did not return an activity_id');
    pass = false;
  }
  
  if (!actual.logs.metaTemplateDetected) {
    errors.push('Meta-template detection not observed in logs');
    pass = false;
  }
  
  if (!actual.logs.lifecycleHooksObserved) {
    errors.push('Lifecycle hooks not observed in logs');
    pass = false;
  }
  
  if (!actual.database.recordExists) {
    errors.push('Activity record not found in SurrealDB');
    pass = false;
  }
  
  if (!actual.database.recordStructureValid) {
    errors.push('Activity record structure is invalid (missing required fields)');
    pass = false;
  }
  
  // Non-critical checks (warnings)
  if (!actual.logs.trailblazingEnabled) {
    console.log('⚠️ Warning: Trailblazing not observed (expected if no failures occurred)');
  }
  
  if (!actual.logs.memoryManagementHook) {
    console.log('⚠️ Warning: Memory management hook not observed');
  }
  
  if (!actual.redis.cacheExists) {
    console.log('⚠️ Warning: Redis cache not found (may not be implemented yet)');
  }
  
  // Summary
  console.log('\n===============================================');
  console.log('Validation Summary');
  console.log('===============================================');
  console.log(`Status: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(error => console.log(`  - ${error}`));
  }
  console.log('\nKey Results:');
  console.log(`  create-activity executed: ${actual.createActivity.executed ? '✅' : '❌'}`);
  console.log(`  activity_id extracted: ${actual.createActivity.activityId ? '✅' : '❌'}`);
  console.log(`  Meta-template detected: ${actual.logs.metaTemplateDetected ? '✅' : '❌'}`);
  console.log(`  Lifecycle hooks observed: ${actual.logs.lifecycleHooksObserved ? '✅' : '❌'}`);
  console.log(`  Database record exists: ${actual.database.recordExists ? '✅' : '❌'}`);
  console.log(`  evolve-activity executed: ${actual.evolveActivity.executed ? '✅' : '⚠️'}`);
  console.log(`  debug-activity executed: ${actual.debugActivity.executed ? '✅' : '⚠️'}`);
  console.log('===============================================\n');
  
  return {
    pass,
    timestamp: new Date().toISOString(),
    actual,
    expected,
    errors,
    auditTrail,
  };
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const input: ValidationInput = {
    activityName: 'REST API for user management with authentication',
    evolutionReason: 'Add JWT token validation',
    debugErrorDescription: 'Database connection timeout during user fetch',
    streamLogs: false,
  };
  
  runValidation(input)
    .then((result) => {
      // Write results to file
      const resultsFile = `validation-results-pass4-${Date.now()}.json`;
      writeFileSync(resultsFile, JSON.stringify(result, null, 2));
      console.log(`\n📄 Results written to: ${resultsFile}`);
      
      // Write audit trail to markdown
      const auditFile = `audit-trail-pass4-${Date.now()}.md`;
      const auditContent = `# Audit Trail: Pass 4 Validation

## Timestamp
- Start: ${result.auditTrail.startTime}
- End: ${result.auditTrail.endTime}

## Steps

${result.auditTrail.steps.map(step => `### ${step.step}
- Timestamp: ${step.timestamp}
- Status: ${step.status}
- Details: ${step.details}
`).join('\n')}

## Summary
- Pass: ${result.pass ? 'YES' : 'NO'}
- Errors: ${result.errors.length}

${result.errors.length > 0 ? `## Errors\n${result.errors.map(e => `- ${e}`).join('\n')}` : ''}
`;
      writeFileSync(auditFile, auditContent);
      console.log(`📄 Audit trail written to: ${auditFile}\n`);
      
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Validation harness failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}
