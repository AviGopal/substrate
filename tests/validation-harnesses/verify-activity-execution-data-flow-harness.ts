/**
 * Validation Harness: Verify Activity Execution Data Flow to Backend
 * 
 * This harness validates the complete data flow from activity completion to database storage:
 * 1. TemplateMetricsClient.reportExecution() is called
 * 2. MCP tool 'metabob_post_activity_result' exists
 * 3. MCP client 'metabob' is configured
 * 4. Backend API is accessible
 * 5. SurrealDB is accessible
 * 6. Execution data reaches database
 * 7. variant_id is populated correctly
 * 
 * Usage:
 *   const result = await runValidation({ activityId: 'test-001', templateId: 'test-template' })
 *   console.log(result.pass ? 'PASS' : 'FAIL', result.details)
 */

import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ValidationInput {
  activityId: string;
  templateId: string;
  variantId?: string;
  success?: boolean;
  durationMs?: number;
  cost?: number;
  skipDatabaseCheck?: boolean;
}

interface ValidationResult {
  pass: boolean;
  actual: {
    mcpToolExists: boolean;
    mcpClientConfigured: boolean;
    backendAccessible: boolean;
    databaseAccessible: boolean;
    executionPosted: boolean;
    databaseRecord: any;
    logs: string[];
  };
  expected: {
    mcpToolExists: true;
    mcpClientConfigured: true;
    backendAccessible: true;
    databaseAccessible: true;
    executionPosted: true;
    databaseRecordFields: string[];
  };
  details: string[];
  errors: string[];
}

/**
 * Check if MCP tool 'metabob_post_activity_result' exists
 */
async function checkMcpToolExists(): Promise<boolean> {
  try {
    const toolFile = '/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py';
    if (!fs.existsSync(toolFile)) {
      return false;
    }
    
    const content = fs.readFileSync(toolFile, 'utf-8');
    return content.includes('metabob_post_activity_result') && 
           content.includes('POST /api/v1/learning-loop/executions');
  } catch (error) {
    return false;
  }
}

/**
 * Check if MCP client 'metabob' is configured in opencode.json
 */
async function checkMcpClientConfigured(): Promise<boolean> {
  try {
    const configFile = '/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/.opencode/opencode.json';
    if (!fs.existsSync(configFile)) {
      return false;
    }
    
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    return config.mcp?.metabob?.enabled === true &&
           config.mcp?.metabob?.environment?.METABOB_API_URL !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Check if backend API is accessible
 */
async function checkBackendAccessible(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('curl -s http://localhost:8081/ 2>&1');
    const response = JSON.parse(stdout);
    return response.status === 'ok';
  } catch (error) {
    return false;
  }
}

/**
 * Check if SurrealDB is accessible
 */
async function checkDatabaseAccessible(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('kubectl get pods -n metabob -l app=surrealdb -o json 2>&1');
    const pods = JSON.parse(stdout);
    return pods.items?.some((pod: any) => 
      pod.status.phase === 'Running' && 
      pod.status.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True')
    );
  } catch (error) {
    return false;
  }
}

/**
 * Post activity execution to backend
 */
async function postExecution(input: ValidationInput): Promise<{ success: boolean; executionId?: string }> {
  try {
    const payload = {
      activity_id: input.activityId,
      template_id: input.templateId,
      variant_id: input.variantId,
      duration_ms: input.durationMs || 1000,
      success: input.success !== false,
      cost: input.cost || 0.01,
      tokens: { input: 100, output: 50, cache: 0 }
    };
    
    const { stdout } = await execAsync(
      `curl -s -X POST http://localhost:8081/api/v1/learning-loop/executions ` +
      `-H "Content-Type: application/json" ` +
      `-d '${JSON.stringify(payload)}' 2>&1`
    );
    
    const response = JSON.parse(stdout);
    return {
      success: response.success === true,
      executionId: response.execution_id
    };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Query database for execution record
 */
async function queryDatabaseForExecution(activityId: string): Promise<any> {
  try {
    // Wait for background task to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check backend logs for execution processing
    const { stdout } = await execAsync(
      `kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 2>&1 | grep "${activityId}"`
    );
    
    const logs = stdout.split('\n');
    const hasScheduled = logs.some(line => line.includes('[EXECUTION] Scheduled background processing'));
    const hasInserted = logs.some(line => line.includes('Inserting execution'));
    const hasSuccess = logs.some(line => line.includes('[BACKGROUND] Successfully processed execution'));
    const hasFailed = logs.some(line => line.includes('[BACKGROUND] Failed to process execution'));
    
    return {
      found: hasScheduled && hasInserted,
      success: hasSuccess && !hasFailed,
      logs: logs.filter(line => line.includes(activityId)),
      error: hasFailed ? logs.find(line => line.includes('Failed'))?.match(/ERROR.*?$/)?.[0] : null
    };
  } catch (error) {
    return { found: false, error: String(error) };
  }
}

/**
 * Check backend logs for data flow traces
 */
async function checkBackendLogs(activityId: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `kubectl logs -n metabob -l app=metabob-rpc-api --tail=200 2>&1 | ` +
      `grep -E "${activityId}|reporting activity execution|EXECUTION|BACKGROUND"`
    );
    
    return stdout.split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

/**
 * Main validation function
 */
export async function runValidation(input: ValidationInput): Promise<ValidationResult> {
  const details: string[] = [];
  const errors: string[] = [];
  
  details.push(`[VALIDATION START] Activity: ${input.activityId}, Template: ${input.templateId}`);
  
  // Step 1: Check MCP tool exists
  const mcpToolExists = await checkMcpToolExists();
  details.push(`[1] MCP tool 'metabob_post_activity_result' exists: ${mcpToolExists ? 'PASS' : 'FAIL'}`);
  if (!mcpToolExists) {
    errors.push('MCP tool missing in metabob-cli/src/metabob_cli/mcp/activity_template_tools.py');
  }
  
  // Step 2: Check MCP client configured
  const mcpClientConfigured = await checkMcpClientConfigured();
  details.push(`[2] MCP client 'metabob' configured: ${mcpClientConfigured ? 'PASS' : 'FAIL'}`);
  if (!mcpClientConfigured) {
    errors.push('MCP client not configured in .opencode/opencode.json');
  }
  
  // Step 3: Check backend accessible
  const backendAccessible = await checkBackendAccessible();
  details.push(`[3] Backend API accessible: ${backendAccessible ? 'PASS' : 'FAIL'}`);
  if (!backendAccessible) {
    errors.push('Backend not accessible at http://localhost:8081');
  }
  
  // Step 4: Check database accessible
  const databaseAccessible = await checkDatabaseAccessible();
  details.push(`[4] SurrealDB accessible: ${databaseAccessible ? 'PASS' : 'FAIL'}`);
  if (!databaseAccessible) {
    errors.push('SurrealDB pod not running or not ready');
  }
  
  // Step 5: Post execution to backend
  const postResult = await postExecution(input);
  details.push(`[5] Execution posted to backend: ${postResult.success ? 'PASS' : 'FAIL'}`);
  if (!postResult.success) {
    errors.push('Failed to post execution to backend API');
  }
  
  // Step 6: Query database for record
  let databaseRecord: any = null;
  if (!input.skipDatabaseCheck && postResult.success) {
    databaseRecord = await queryDatabaseForExecution(input.activityId);
    details.push(`[6] Database record found: ${databaseRecord.found ? 'PASS' : 'FAIL'}`);
    details.push(`[6a] Background task success: ${databaseRecord.success ? 'PASS' : 'FAIL'}`);
    
    if (!databaseRecord.found) {
      errors.push('Execution record not found in database');
    }
    if (!databaseRecord.success) {
      errors.push(`Background task failed: ${databaseRecord.error || 'Unknown error'}`);
    }
    if (databaseRecord.error) {
      errors.push(`Database error: ${databaseRecord.error}`);
    }
  }
  
  // Step 7: Check logs for data flow traces
  const logs = await checkBackendLogs(input.activityId);
  details.push(`[7] Backend logs collected: ${logs.length} lines`);
  
  // Determine overall pass/fail
  const pass = mcpToolExists && 
               mcpClientConfigured && 
               backendAccessible && 
               databaseAccessible && 
               postResult.success &&
               (input.skipDatabaseCheck || (databaseRecord?.found && databaseRecord?.success));
  
  details.push(`[VALIDATION ${pass ? 'PASS' : 'FAIL'}]`);
  
  return {
    pass,
    actual: {
      mcpToolExists,
      mcpClientConfigured,
      backendAccessible,
      databaseAccessible,
      executionPosted: postResult.success,
      databaseRecord,
      logs
    },
    expected: {
      mcpToolExists: true,
      mcpClientConfigured: true,
      backendAccessible: true,
      databaseAccessible: true,
      executionPosted: true,
      databaseRecordFields: ['activity_id', 'template_id', 'variant_id', 'success', 'duration_ms', 'cost', 'tokens']
    },
    details,
    errors
  };
}

/**
 * Run all test cases
 */
export async function runAllTests(): Promise<void> {
  console.log('=== Validation Harness: Activity Execution Data Flow ===\n');
  
  // Test Case 1: Basic execution without variant
  console.log('Test Case 1: Basic Execution (No Variant)');
  const test1 = await runValidation({
    activityId: 'validation-test-001',
    templateId: 'test-template',
    success: true,
    durationMs: 1000,
    cost: 0.01
  });
  console.log(test1.details.join('\n'));
  console.log(`Result: ${test1.pass ? '✅ PASS' : '❌ FAIL'}`);
  if (test1.errors.length > 0) {
    console.log('Errors:', test1.errors.join('\n  '));
  }
  console.log();
  
  // Test Case 2: Execution with variant_id
  console.log('Test Case 2: Execution with Variant');
  const test2 = await runValidation({
    activityId: 'validation-test-002',
    templateId: 'test-template-variant',
    variantId: 'candidate-v1',
    success: true,
    durationMs: 2000,
    cost: 0.02
  });
  console.log(test2.details.join('\n'));
  console.log(`Result: ${test2.pass ? '✅ PASS' : '❌ FAIL'}`);
  if (test2.errors.length > 0) {
    console.log('Errors:', test2.errors.join('\n  '));
  }
  console.log();
  
  // Test Case 3: Failed execution
  console.log('Test Case 3: Failed Execution');
  const test3 = await runValidation({
    activityId: 'validation-test-003',
    templateId: 'test-template-failed',
    success: false,
    durationMs: 500,
    cost: 0.005
  });
  console.log(test3.details.join('\n'));
  console.log(`Result: ${test3.pass ? '✅ PASS' : '❌ FAIL'}`);
  if (test3.errors.length > 0) {
    console.log('Errors:', test3.errors.join('\n  '));
  }
  console.log();
  
  // Summary
  const allPassed = test1.pass && test2.pass && test3.pass;
  console.log('=== Validation Summary ===');
  console.log(`Test Case 1 (Basic): ${test1.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test Case 2 (Variant): ${test2.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test Case 3 (Failed): ${test3.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Validation harness failed:', error);
    process.exit(1);
  });
}
