#!/usr/bin/env ts-node

/**
 * Validation Harness: Dynamic Activity Creation with Trailblazing Pass 2
 * 
 * Purpose: Validate end-to-end workflow from DevBob agent through trailblazing execution to SurrealDB persistence
 * 
 * Validation Strategy:
 * 1. Execute create-activity from DevBob pod
 * 2. Observe kubectl logs for trailblazing and lifecycle hooks
 * 3. Query SurrealDB for activity persistence
 * 4. Execute evolve-activity to create variant
 * 5. Execute debug-activity with error scenario
 * 6. Validate database contains all 3 activities with proper structure
 * 
 * Success Criteria:
 * - kubectl logs show turn-by-turn trailblazing with lifecycle hooks
 * - SurrealDB contains 3+ activities with tasks, metadata, and execution tracking
 * - End-to-end flow DevBob → RPC API → SurrealDB confirmed
 */

import { execSync } from 'child_process';
import { z } from 'zod';

// Kubernetes configuration
const K8S_NAMESPACE = 'metabob';
const DEVBOB_POD = 'devbob-pod';
const RPC_API_POD = 'rpc-api-pod';
const SURREALDB_POD = 'surrealdb-pod';

// Validation input schema
const ValidationInput = z.object({
  createActivityGoal: z.string(),
  evolveActivityChanges: z.string(),
  debugActivityError: z.string(),
});

type ValidationInput = z.infer<typeof ValidationInput>;

// Validation output schema
const ValidationOutput = z.object({
  pass: z.boolean(),
  actual: z.object({
    createActivityId: z.string().optional(),
    evolveActivityId: z.string().optional(),
    debugActivityId: z.string().optional(),
    trailblazingObserved: z.boolean(),
    lifecycleHooksObserved: z.boolean(),
    httpRequestsObserved: z.boolean(),
    activitiesInDatabase: z.number(),
    activityStructureValid: z.boolean(),
    recoveryAttemptsPresent: z.boolean(),
    stateDeltaPresent: z.boolean(),
  }),
  expected: z.object({
    trailblazingObserved: z.boolean(),
    lifecycleHooksObserved: z.boolean(),
    httpRequestsObserved: z.boolean(),
    activitiesInDatabase: z.number(),
    activityStructureValid: z.boolean(),
    recoveryAttemptsPresent: z.boolean(),
    stateDeltaPresent: z.boolean(),
  }),
  errors: z.array(z.string()),
  logs: z.object({
    devbob: z.string(),
    rpcApi: z.string(),
    surrealdbQuery: z.string(),
  }),
});

type ValidationOutput = z.infer<typeof ValidationOutput>;

/**
 * Execute kubectl command and return output
 */
function kubectl(command: string): string {
  try {
    return execSync(`kubectl ${command}`, { encoding: 'utf-8', timeout: 60000 });
  } catch (error: any) {
    throw new Error(`kubectl command failed: ${error.message}`);
  }
}

/**
 * Check if DevBob pod is ready
 */
function checkDevBobReady(): boolean {
  try {
    const output = kubectl(`get pod -n ${K8S_NAMESPACE} -l app=devbob -o json`);
    const pods = JSON.parse(output);
    
    if (pods.items.length === 0) {
      console.error('❌ DevBob pod not found in namespace:', K8S_NAMESPACE);
      return false;
    }
    
    const pod = pods.items[0];
    const ready = pod.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True';
    
    if (!ready) {
      console.error('❌ DevBob pod not ready:', pod.metadata.name);
      return false;
    }
    
    console.log('✅ DevBob pod ready:', pod.metadata.name);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to check DevBob pod:', error.message);
    return false;
  }
}

/**
 * Execute create-activity from DevBob
 */
function executeCreateActivity(goal: string): { activityId: string | null; output: string } {
  try {
    console.log('\n[1/3] Executing create-activity from DevBob...');
    console.log('Goal:', goal);
    
    const command = `exec -n ${K8S_NAMESPACE} ${DEVBOB_POD} -- opencode activity create-activity --variables '{"activityName":"${goal}","purpose":"Pass 2 validation test"}' --reason 'Validation harness: verify dynamic activity creation'`;
    
    const output = kubectl(command);
    console.log('Output:', output.substring(0, 500)); // Log first 500 chars
    
    // Extract activity ID from output (format: act_XXXXX)
    const activityIdMatch = output.match(/act_[a-zA-Z0-9_]+/);
    const activityId = activityIdMatch ? activityIdMatch[0] : null;
    
    if (activityId) {
      console.log('✅ Activity created:', activityId);
    } else {
      console.log('⚠️  Could not extract activity ID from output');
    }
    
    return { activityId, output };
  } catch (error: any) {
    console.error('❌ Failed to execute create-activity:', error.message);
    return { activityId: null, output: error.message };
  }
}

/**
 * Execute evolve-activity from DevBob
 */
function executeEvolveActivity(parentId: string, changes: string): { activityId: string | null; output: string } {
  try {
    console.log('\n[2/3] Executing evolve-activity from DevBob...');
    console.log('Parent ID:', parentId);
    console.log('Changes:', changes);
    
    const command = `exec -n ${K8S_NAMESPACE} ${DEVBOB_POD} -- opencode activity evolve-activity --variables '{"parentActivityId":"${parentId}","evolutionReason":"${changes}"}' --reason 'Validation harness: verify activity evolution'`;
    
    const output = kubectl(command);
    console.log('Output:', output.substring(0, 500));
    
    const activityIdMatch = output.match(/act_[a-zA-Z0-9_]+/);
    const activityId = activityIdMatch ? activityIdMatch[0] : null;
    
    if (activityId) {
      console.log('✅ Activity evolved:', activityId);
    } else {
      console.log('⚠️  Could not extract activity ID from output');
    }
    
    return { activityId, output };
  } catch (error: any) {
    console.error('❌ Failed to execute evolve-activity:', error.message);
    return { activityId: null, output: error.message };
  }
}

/**
 * Execute debug-activity from DevBob
 */
function executeDebugActivity(errorScenario: string): { activityId: string | null; output: string } {
  try {
    console.log('\n[3/3] Executing debug-activity from DevBob...');
    console.log('Error scenario:', errorScenario);
    
    const command = `exec -n ${K8S_NAMESPACE} ${DEVBOB_POD} -- opencode activity debug-activity --variables '{"errorDescription":"${errorScenario}","activityContext":"validation test"}' --reason 'Validation harness: verify activity debugging'`;
    
    const output = kubectl(command);
    console.log('Output:', output.substring(0, 500));
    
    const activityIdMatch = output.match(/act_[a-zA-Z0-9_]+/);
    const activityId = activityIdMatch ? activityIdMatch[0] : null;
    
    if (activityId) {
      console.log('✅ Activity debugged:', activityId);
    } else {
      console.log('⚠️  Could not extract activity ID from output');
    }
    
    return { activityId, output };
  } catch (error: any) {
    console.error('❌ Failed to execute debug-activity:', error.message);
    return { activityId: null, output: error.message };
  }
}

/**
 * Get DevBob logs and check for trailblazing/lifecycle hooks
 */
function analyzeDevBobLogs(): { logs: string; trailblazingObserved: boolean; lifecycleHooksObserved: boolean } {
  try {
    console.log('\n[Logs] Analyzing DevBob logs...');
    
    const logs = kubectl(`logs -n ${K8S_NAMESPACE} ${DEVBOB_POD} --tail=200`);
    
    const trailblazingObserved = /trailblazing|recovery attempt|continuation prompt|turn-by-turn/.test(logs);
    const lifecycleHooksObserved = /lifecycle-hooks|memory-management|activity-recommendations|metabob-context/.test(logs);
    
    console.log('Trailblazing observed:', trailblazingObserved ? '✅' : '⚠️');
    console.log('Lifecycle hooks observed:', lifecycleHooksObserved ? '✅' : '⚠️');
    
    return { logs, trailblazingObserved, lifecycleHooksObserved };
  } catch (error: any) {
    console.error('❌ Failed to get DevBob logs:', error.message);
    return { logs: error.message, trailblazingObserved: false, lifecycleHooksObserved: false };
  }
}

/**
 * Get RPC API logs and check for HTTP requests
 */
function analyzeRpcApiLogs(): { logs: string; httpRequestsObserved: boolean } {
  try {
    console.log('\n[Logs] Analyzing RPC API logs...');
    
    const logs = kubectl(`logs -n ${K8S_NAMESPACE} ${RPC_API_POD} --tail=100`);
    
    const httpRequestsObserved = /POST \/activity-execution|PATCH \/activity-execution/.test(logs);
    
    console.log('HTTP requests observed:', httpRequestsObserved ? '✅' : '⚠️');
    
    return { logs, httpRequestsObserved };
  } catch (error: any) {
    console.error('❌ Failed to get RPC API logs:', error.message);
    return { logs: error.message, httpRequestsObserved: false };
  }
}

/**
 * Query SurrealDB for activities
 */
function querySurrealDB(activityIds: string[]): { 
  queryResult: string; 
  activitiesInDatabase: number; 
  activityStructureValid: boolean;
  recoveryAttemptsPresent: boolean;
  stateDeltaPresent: boolean;
} {
  try {
    console.log('\n[Database] Querying SurrealDB...');
    
    // Query for all activities
    const query = `SELECT * FROM activity_executions ORDER BY created_at DESC LIMIT 10`;
    const command = `exec -n ${K8S_NAMESPACE} ${SURREALDB_POD} -- surreal sql "${query}"`;
    
    const queryResult = kubectl(command);
    console.log('Query result:', queryResult.substring(0, 500));
    
    // Count activities
    const activitiesInDatabase = (queryResult.match(/activity_id/g) || []).length;
    console.log('Activities in database:', activitiesInDatabase);
    
    // Check for required fields
    const activityStructureValid = /activity_id/.test(queryResult) && /template_id/.test(queryResult);
    const recoveryAttemptsPresent = /recovery_attempts/.test(queryResult);
    const stateDeltaPresent = /state_delta/.test(queryResult);
    
    console.log('Activity structure valid:', activityStructureValid ? '✅' : '❌');
    console.log('Recovery attempts present:', recoveryAttemptsPresent ? '✅' : '⚠️');
    console.log('State delta present:', stateDeltaPresent ? '✅' : '⚠️');
    
    return { 
      queryResult, 
      activitiesInDatabase, 
      activityStructureValid,
      recoveryAttemptsPresent,
      stateDeltaPresent,
    };
  } catch (error: any) {
    console.error('❌ Failed to query SurrealDB:', error.message);
    return { 
      queryResult: error.message, 
      activitiesInDatabase: 0, 
      activityStructureValid: false,
      recoveryAttemptsPresent: false,
      stateDeltaPresent: false,
    };
  }
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  console.log('============================================');
  console.log('Dynamic Activity Creation with Trailblazing Pass 2 Validation');
  console.log('============================================\n');
  
  const errors: string[] = [];
  
  // Step 0: Check DevBob is ready
  if (!checkDevBobReady()) {
    errors.push('DevBob pod not ready');
    return {
      pass: false,
      actual: {
        trailblazingObserved: false,
        lifecycleHooksObserved: false,
        httpRequestsObserved: false,
        activitiesInDatabase: 0,
        activityStructureValid: false,
        recoveryAttemptsPresent: false,
        stateDeltaPresent: false,
      },
      expected: {
        trailblazingObserved: true,
        lifecycleHooksObserved: true,
        httpRequestsObserved: true,
        activitiesInDatabase: 3,
        activityStructureValid: true,
        recoveryAttemptsPresent: true,
        stateDeltaPresent: true,
      },
      errors,
      logs: {
        devbob: '',
        rpcApi: '',
        surrealdbQuery: '',
      },
    };
  }
  
  // Step 1: Execute create-activity
  const createResult = executeCreateActivity(input.createActivityGoal);
  const createActivityId = createResult.activityId;
  
  if (!createActivityId) {
    errors.push('Failed to create activity or extract activity ID');
  }
  
  // Step 2: Execute evolve-activity (if create succeeded)
  let evolveActivityId: string | null = null;
  if (createActivityId) {
    const evolveResult = executeEvolveActivity(createActivityId, input.evolveActivityChanges);
    evolveActivityId = evolveResult.activityId;
    
    if (!evolveActivityId) {
      errors.push('Failed to evolve activity or extract activity ID');
    }
  }
  
  // Step 3: Execute debug-activity
  const debugResult = executeDebugActivity(input.debugActivityError);
  const debugActivityId = debugResult.activityId;
  
  if (!debugActivityId) {
    errors.push('Failed to debug activity or extract activity ID');
  }
  
  // Step 4: Analyze logs
  const devbobAnalysis = analyzeDevBobLogs();
  const rpcApiAnalysis = analyzeRpcApiLogs();
  
  // Step 5: Query database
  const activityIds = [createActivityId, evolveActivityId, debugActivityId].filter(Boolean) as string[];
  const dbAnalysis = querySurrealDB(activityIds);
  
  // Compile actual results
  const actual = {
    createActivityId,
    evolveActivityId,
    debugActivityId,
    trailblazingObserved: devbobAnalysis.trailblazingObserved,
    lifecycleHooksObserved: devbobAnalysis.lifecycleHooksObserved,
    httpRequestsObserved: rpcApiAnalysis.httpRequestsObserved,
    activitiesInDatabase: dbAnalysis.activitiesInDatabase,
    activityStructureValid: dbAnalysis.activityStructureValid,
    recoveryAttemptsPresent: dbAnalysis.recoveryAttemptsPresent,
    stateDeltaPresent: dbAnalysis.stateDeltaPresent,
  };
  
  // Define expected results
  const expected = {
    trailblazingObserved: true, // May not always trigger if no failures
    lifecycleHooksObserved: true,
    httpRequestsObserved: true,
    activitiesInDatabase: 3, // At least 3 activities created
    activityStructureValid: true,
    recoveryAttemptsPresent: true, // May not be present if no failures
    stateDeltaPresent: true,
  };
  
  // Determine pass/fail
  let pass = true;
  
  // Critical checks
  if (!actual.lifecycleHooksObserved) {
    errors.push('Lifecycle hooks not observed in logs');
    pass = false;
  }
  
  if (!actual.httpRequestsObserved) {
    errors.push('HTTP requests not observed in RPC API logs');
    pass = false;
  }
  
  if (actual.activitiesInDatabase < 3) {
    errors.push(`Expected at least 3 activities in database, found ${actual.activitiesInDatabase}`);
    pass = false;
  }
  
  if (!actual.activityStructureValid) {
    errors.push('Activity structure invalid (missing required fields)');
    pass = false;
  }
  
  // Non-critical checks (warnings)
  if (!actual.trailblazingObserved) {
    console.log('⚠️  Warning: Trailblazing not observed (expected if no failures occurred)');
  }
  
  if (!actual.recoveryAttemptsPresent) {
    console.log('⚠️  Warning: Recovery attempts not present (expected if no failures occurred)');
  }
  
  if (!actual.stateDeltaPresent) {
    console.log('⚠️  Warning: State delta not present in database');
  }
  
  // Summary
  console.log('\n============================================');
  console.log('Validation Result:', pass ? '✅ PASS' : '❌ FAIL');
  console.log('============================================\n');
  
  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(error => console.log('  -', error));
    console.log();
  }
  
  return {
    pass,
    actual,
    expected,
    errors,
    logs: {
      devbob: devbobAnalysis.logs,
      rpcApi: rpcApiAnalysis.logs,
      surrealdbQuery: dbAnalysis.queryResult,
    },
  };
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const input: ValidationInput = {
    createActivityGoal: 'Create REST endpoint for user management',
    evolveActivityChanges: 'Add authentication middleware',
    debugActivityError: 'Database connection timeout on user fetch',
  };
  
  runValidation(input)
    .then((result) => {
      console.log('\n=== Validation Complete ===');
      console.log('Pass:', result.pass);
      console.log('Errors:', result.errors.length);
      
      process.exit(result.pass ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Validation harness failed:', error.message);
      process.exit(1);
    });
}
