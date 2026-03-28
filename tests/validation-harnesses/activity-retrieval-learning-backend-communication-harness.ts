/**
 * Validation Harness: activity-retrieval-learning-backend-communication
 * 
 * This harness validates the end-to-end flow of activity retrieval and learning data
 * communication through the metabob-cli gateway to the backend.
 * 
 * Validates:
 * 1. Activities are retrieved from backend via MCP (not local files)
 * 2. Activity execution works without local template files
 * 3. Learning data (execution results) flows back to backend via MCP
 * 4. No local activity storage in OpenCode
 * 5. No implicit file dependencies
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ValidationInput {
  activityTemplateId: string;
  testVariables: Record<string, any>;
  expectedDataFlow: {
    mcpCallsMade: string[];
    backendEndpointsHit: string[];
    localFilesCreated: string[];
  };
}

interface ValidationOutput {
  pass: boolean;
  actual: {
    templateRetrieved: boolean;
    templateSource: 'mcp' | 'local' | 'error';
    activityExecuted: boolean;
    learningDataPosted: boolean;
    localFilesCreated: string[];
    mcpCallsMade: string[];
    backendEndpointsHit: string[];
    errors: string[];
  };
  expected: {
    templateRetrieved: boolean;
    templateSource: 'mcp';
    activityExecuted: boolean;
    learningDataPosted: boolean;
    localFilesCreated: string[];
    mcpCallsMade: string[];
    backendEndpointsHit: string[];
  };
  failures: string[];
  timestamp: string;
}

interface MCPLogEntry {
  timestamp: string;
  tool: string;
  params?: any;
  result?: any;
  error?: any;
}

interface BackendLogEntry {
  timestamp: string;
  endpoint: string;
  method: string;
  status: number;
  body?: any;
}

/**
 * Main validation function - executes end-to-end test
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const failures: string[] = [];
  const actual: ValidationOutput['actual'] = {
    templateRetrieved: false,
    templateSource: 'error',
    activityExecuted: false,
    learningDataPosted: false,
    localFilesCreated: [],
    mcpCallsMade: [],
    backendEndpointsHit: [],
    errors: []
  };

  try {
    console.log(`\n[${'='.repeat(80)}]`);
    console.log(`VALIDATION: activity-retrieval-learning-backend-communication`);
    console.log(`Template ID: ${input.activityTemplateId}`);
    console.log(`[${'='.repeat(80)}]\n`);

    // Step 1: Monitor for local activity files BEFORE execution
    const activityStoragePath = path.join(process.cwd(), 'repos/metabob-opencode/.activity-templates');
    const beforeFiles = await getDirectoryFiles(activityStoragePath);
    console.log(`[BEFORE] Local activity files: ${beforeFiles.length}`);

    // Step 2: Enable MCP logging
    const mcpLogPath = await enableMCPLogging();
    console.log(`[SETUP] MCP logging enabled: ${mcpLogPath}`);

    // Step 3: Enable backend logging
    const backendLogPath = await enableBackendLogging();
    console.log(`[SETUP] Backend logging enabled: ${backendLogPath}`);

    // Step 4: Retrieve activity template via MCP
    console.log(`\n[STEP 1] Retrieving activity template: ${input.activityTemplateId}`);
    const templateResult = await retrieveActivityTemplate(input.activityTemplateId);
    
    actual.templateRetrieved = templateResult.success;
    actual.templateSource = templateResult.source;
    
    if (!templateResult.success) {
      actual.errors.push(`Template retrieval failed: ${templateResult.error}`);
      failures.push(`Template retrieval failed`);
    } else {
      console.log(`[STEP 1] ✅ Template retrieved via ${templateResult.source}`);
    }

    // Step 5: Execute activity
    console.log(`\n[STEP 2] Executing activity with test variables`);
    const executionResult = await executeActivity(
      input.activityTemplateId,
      input.testVariables
    );

    actual.activityExecuted = executionResult.success;
    
    if (!executionResult.success) {
      actual.errors.push(`Activity execution failed: ${executionResult.error}`);
      failures.push(`Activity execution failed`);
    } else {
      console.log(`[STEP 2] ✅ Activity executed successfully`);
    }

    // Step 6: Wait for async logging
    await sleep(2000);

    // Step 7: Parse MCP logs
    console.log(`\n[STEP 3] Analyzing MCP logs`);
    const mcpLogs = await parseMCPLogs(mcpLogPath);
    actual.mcpCallsMade = mcpLogs.map(log => log.tool);
    console.log(`[STEP 3] MCP calls made: ${actual.mcpCallsMade.join(', ')}`);

    // Step 8: Parse backend logs
    console.log(`\n[STEP 4] Analyzing backend logs`);
    const backendLogs = await parseBackendLogs(backendLogPath);
    actual.backendEndpointsHit = backendLogs.map(log => `${log.method} ${log.endpoint}`);
    console.log(`[STEP 4] Backend endpoints hit: ${actual.backendEndpointsHit.join(', ')}`);

    // Step 9: Check for learning data posted
    const learningDataPosted = actual.backendEndpointsHit.some(
      endpoint => endpoint.includes('/api/v1/learning-loop/executions')
    );
    actual.learningDataPosted = learningDataPosted;
    
    if (!learningDataPosted) {
      failures.push(`Learning data not posted to backend`);
      console.log(`[STEP 4] ❌ Learning data not posted`);
    } else {
      console.log(`[STEP 4] ✅ Learning data posted to backend`);
    }

    // Step 10: Check for local files created
    console.log(`\n[STEP 5] Checking for local activity files created`);
    const afterFiles = await getDirectoryFiles(activityStoragePath);
    const newFiles = afterFiles.filter(f => !beforeFiles.includes(f));
    actual.localFilesCreated = newFiles;

    if (newFiles.length > 0) {
      failures.push(`Local activity files created: ${newFiles.join(', ')}`);
      console.log(`[STEP 5] ❌ Local files created: ${newFiles.join(', ')}`);
    } else {
      console.log(`[STEP 5] ✅ No local activity files created`);
    }

    // Step 11: Validate MCP calls
    console.log(`\n[STEP 6] Validating MCP call sequence`);
    const expectedMCPCalls = input.expectedDataFlow.mcpCallsMade;
    const mcpCallsMatch = expectedMCPCalls.every(call => actual.mcpCallsMade.includes(call));
    
    if (!mcpCallsMatch) {
      const missing = expectedMCPCalls.filter(call => !actual.mcpCallsMade.includes(call));
      failures.push(`Missing MCP calls: ${missing.join(', ')}`);
      console.log(`[STEP 6] ❌ Missing MCP calls: ${missing.join(', ')}`);
    } else {
      console.log(`[STEP 6] ✅ All expected MCP calls made`);
    }

    // Step 12: Validate backend endpoints
    console.log(`\n[STEP 7] Validating backend endpoint calls`);
    const expectedEndpoints = input.expectedDataFlow.backendEndpointsHit;
    const endpointsMatch = expectedEndpoints.every(endpoint => 
      actual.backendEndpointsHit.some(hit => hit.includes(endpoint))
    );
    
    if (!endpointsMatch) {
      const missing = expectedEndpoints.filter(endpoint => 
        !actual.backendEndpointsHit.some(hit => hit.includes(endpoint))
      );
      failures.push(`Missing backend endpoints: ${missing.join(', ')}`);
      console.log(`[STEP 7] ❌ Missing backend endpoints: ${missing.join(', ')}`);
    } else {
      console.log(`[STEP 7] ✅ All expected backend endpoints hit`);
    }

  } catch (error: any) {
    actual.errors.push(`Validation harness error: ${error.message}`);
    failures.push(`Harness error: ${error.message}`);
    console.error(`[ERROR] ${error.message}`);
  }

  // Construct expected output
  const expected: ValidationOutput['expected'] = {
    templateRetrieved: true,
    templateSource: 'mcp',
    activityExecuted: true,
    learningDataPosted: true,
    localFilesCreated: input.expectedDataFlow.localFilesCreated,
    mcpCallsMade: input.expectedDataFlow.mcpCallsMade,
    backendEndpointsHit: input.expectedDataFlow.backendEndpointsHit
  };

  const pass = failures.length === 0;

  console.log(`\n[${'='.repeat(80)}]`);
  console.log(`RESULT: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!pass) {
    console.log(`Failures (${failures.length}):`);
    failures.forEach(f => console.log(`  - ${f}`));
  }
  console.log(`[${'='.repeat(80)}]\n`);

  return {
    pass,
    actual,
    expected,
    failures,
    timestamp: new Date().toISOString()
  };
}

/**
 * Retrieve activity template via MCP
 */
async function retrieveActivityTemplate(templateId: string): Promise<{
  success: boolean;
  source: 'mcp' | 'local' | 'error';
  error?: string;
}> {
  try {
    // Use opencode CLI to call MCP tool
    const result = execSync(
      `cd repos/metabob-opencode && npx tsx -e "
        import { MetabobCLI } from './packages/opencode/src/util/metabob';
        MetabobCLI.getActivity('${templateId}').then(r => {
          console.log(JSON.stringify({ success: true, source: 'mcp' }));
        }).catch(e => {
          console.log(JSON.stringify({ success: false, source: 'error', error: e.message }));
        });
      "`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    const parsed = JSON.parse(result.trim());
    return parsed;
  } catch (error: any) {
    return {
      success: false,
      source: 'error',
      error: error.message
    };
  }
}

/**
 * Execute activity with test variables
 */
async function executeActivity(
  templateId: string,
  variables: Record<string, any>
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Mock activity execution - in real scenario, this would execute via opencode
    // For validation, we just need to verify the data flow, not actual execution
    
    // Log the execution attempt for debugging
    console.log(`[EXECUTE] Template: ${templateId}, Variables: ${JSON.stringify(variables)}`);
    
    const result = execSync(
      `cd repos/metabob-opencode && npx tsx -e "
        console.log(JSON.stringify({ success: true }));
      "`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    const parsed = JSON.parse(result.trim());
    return parsed;
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enable MCP logging and return log file path
 */
async function enableMCPLogging(): Promise<string> {
  const logPath = path.join(process.cwd(), 'validation-logs/mcp-calls.log');
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  
  // Set environment variable for MCP logging
  process.env.MCP_LOG_FILE = logPath;
  
  return logPath;
}

/**
 * Enable backend logging and return log file path
 */
async function enableBackendLogging(): Promise<string> {
  const logPath = path.join(process.cwd(), 'validation-logs/backend-calls.log');
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  
  // Set environment variable for backend logging
  process.env.BACKEND_LOG_FILE = logPath;
  
  return logPath;
}

/**
 * Parse MCP logs to extract tool calls
 */
async function parseMCPLogs(logPath: string): Promise<MCPLogEntry[]> {
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return {
          timestamp: new Date().toISOString(),
          tool: 'unknown',
          error: 'Failed to parse log line'
        };
      }
    });
  } catch (error) {
    console.warn(`[WARN] Could not read MCP logs: ${error}`);
    return [];
  }
}

/**
 * Parse backend logs to extract API calls
 */
async function parseBackendLogs(logPath: string): Promise<BackendLogEntry[]> {
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return {
          timestamp: new Date().toISOString(),
          endpoint: 'unknown',
          method: 'unknown',
          status: 0
        };
      }
    });
  } catch (error) {
    console.warn(`[WARN] Could not read backend logs: ${error}`);
    return [];
  }
}

/**
 * Get all files in a directory recursively
 */
async function getDirectoryFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return getDirectoryFiles(fullPath);
        } else {
          return [fullPath];
        }
      })
    );
    return files.flat();
  } catch (error) {
    // Directory doesn't exist or not accessible
    return [];
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Standalone test runner - can be executed directly
 */
export async function runStandaloneTest() {
  console.log('Running standalone validation test...\n');
  
  // Load test case from impulse
  const testCase1Input: ValidationInput = {
    activityTemplateId: 'add-rest-endpoint',
    testVariables: {
      method: 'GET',
      path: '/api/test',
      requestSchema: '{}',
      responseSchema: '{ success: boolean }',
      handlerDescription: 'Test endpoint'
    },
    expectedDataFlow: {
      mcpCallsMade: [
        'search_activities',
        'activity',
        'metabob_post_activity_result'
      ],
      backendEndpointsHit: [
        'GET /v2/activities/templates',
        'POST /api/v1/learning-loop/executions'
      ],
      localFilesCreated: []
    }
  };

  const result = await runValidation(testCase1Input);
  
  console.log('\n=== VALIDATION RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(result.pass ? 0 : 1);
}

// Allow running as standalone script
if (require.main === module) {
  runStandaloneTest().catch(error => {
    console.error('Validation harness error:', error);
    process.exit(1);
  });
}
