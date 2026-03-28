/**
 * Validation Harness: surrealdb-user-persistence-and-query-flow
 * 
 * Tests the complete user registration, persistence, and login flow with SurrealDB.
 * Validates that users registered via API are properly persisted with schema enforcement,
 * queryable by email field, and can successfully authenticate.
 * 
 * Test Flow:
 * 1. Verify SurrealDB schema is applied (SCHEMAFULL with email index)
 * 2. Register test user via API
 * 3. Query SurrealDB directly to verify record exists
 * 4. Query by email to test index functionality
 * 5. Login with credentials (expect 200 OK)
 * 6. Create project for org to test relationships
 * 7. Restart RPC API pod to test persistence
 * 8. Re-query to confirm data persists across restarts
 * 
 * Related: TRACE_surrealdb-user-persistence-and-query-flow.md
 *          ENFORCEMENT_surrealdb-user-persistence-and-query-flow.md
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';

interface TestInput {
  apiBaseUrl: string;
  namespace: string;
  database: string;
  surrealdbPod: string;
  rpcApiDeployment: string;
}

interface ExpectedOutput {
  schemaApplied: boolean;
  registrationSuccess: boolean;
  recordExists: boolean;
  emailIndexWorks: boolean;
  loginSuccess: boolean;
  projectCreated: boolean;
  persistsAcrossRestart: boolean;
}

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: ExpectedOutput;
  details: {
    step: string;
    success: boolean;
    message: string;
    data?: any;
  }[];
  timestamp: string;
  duration: number;
}

/**
 * Execute shell command and return output
 */
function exec(command: string, silent: boolean = false): string {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return result.trim();
  } catch (error: any) {
    if (!silent) {
      console.error(`Command failed: ${command}`);
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * Execute SQL query against SurrealDB via kubectl exec
 */
function executeSurrealQL(
  pod: string,
  namespace: string,
  db: string,
  ns: string,
  query: string
): any {
  const escapedQuery = query.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cmd = `echo "${escapedQuery}" | kubectl exec -i -n ${namespace} ${pod} -- /surreal sql --endpoint http://localhost:8000 --username root --password changeme --namespace ${ns} --database ${db} 2>&1 | tail -20`;
  
  const output = exec(cmd, true);
  
  // Parse JSON-like output from SurrealDB
  const jsonMatch = output.match(/\[\[.*\]\]/s);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0].replace(/(\w+):/g, '"$1":'));
    } catch (e) {
      // If parsing fails, return raw output
      return output;
    }
  }
  
  return output;
}

/**
 * Make HTTP request using curl
 */
function httpRequest(
  method: string,
  url: string,
  data?: any,
  headers?: Record<string, string>
): { statusCode: number; body: any } {
  const headersStr = headers 
    ? Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ')
    : '';
  
  const dataStr = data ? `-d '${JSON.stringify(data)}'` : '';
  
  const cmd = `curl -s -w "\\nHTTP_STATUS:%{http_code}" -X ${method} ${headersStr} ${dataStr} "${url}"`;
  
  const output = exec(cmd, true);
  const lines = output.split('\n');
  const statusLine = lines.find(l => l.startsWith('HTTP_STATUS:'));
  const statusCode = statusLine ? parseInt(statusLine.split(':')[1]) : 0;
  const body = lines.filter(l => !l.startsWith('HTTP_STATUS:')).join('\n');
  
  try {
    return { statusCode, body: JSON.parse(body) };
  } catch {
    return { statusCode, body };
  }
}

/**
 * Find SurrealDB pod name
 */
function findSurrealDBPod(namespace: string): string {
  const cmd = `kubectl get pods -n ${namespace} -o name | grep surrealdb | head -1`;
  const result = exec(cmd, true);
  return result.replace('pod/', '');
}

/**
 * Find RPC API deployment name
 */
function findRpcApiDeployment(namespace: string): string {
  const cmd = `kubectl get deployment -n ${namespace} -o name | grep rpc-api | head -1`;
  const result = exec(cmd, true);
  return result.replace('deployment.apps/', '');
}

/**
 * Wait for pod to be ready
 */
function waitForPodReady(namespace: string, deployment: string, timeout: number = 60): boolean {
  const endTime = Date.now() + timeout * 1000;
  
  while (Date.now() < endTime) {
    try {
      const cmd = `kubectl get deployment -n ${namespace} ${deployment} -o jsonpath='{.status.readyReplicas}'`;
      const ready = parseInt(exec(cmd, true) || '0');
      
      if (ready > 0) {
        // Wait an additional 5 seconds for app initialization
        exec('sleep 5', true);
        return true;
      }
    } catch (e) {
      // Continue waiting
    }
    
    exec('sleep 2', true);
  }
  
  return false;
}

/**
 * Run validation harness
 */
export async function runValidation(input: TestInput): Promise<ValidationResult> {
  const startTime = Date.now();
  const details: ValidationResult['details'] = [];
  
  // Generate unique test data
  const timestamp = Date.now();
  const testEmail = `validation-${timestamp}@example.com`;
  const testPassword = 'ValidationTest123!';
  const testName = 'Validation Test User';
  const testOrgName = 'Validation Test Org';
  
  let loginToken: string | null = null;
  let actualOrgId: string | null = null;
  let actualUserId: string | null = null;
  let projectId: string | null = null;
  
  const expected: ExpectedOutput = {
    schemaApplied: true,
    registrationSuccess: true,
    recordExists: true,
    emailIndexWorks: true,
    loginSuccess: true,
    projectCreated: true,
    persistsAcrossRestart: true,
  };
  
  // Step 1: Verify Schema Applied
  try {
    console.log('Step 1: Verifying SurrealDB schema...');
    
    const schemaInfo = executeSurrealQL(
      input.surrealdbPod,
      input.namespace,
      input.database,
      input.namespace,
      'INFO FOR TABLE users;'
    );
    
    const schemaStr = JSON.stringify(schemaInfo);
    const hasEmailIndex = schemaStr.includes('email') && schemaStr.includes('UNIQUE');
    const hasUserIdIndex = schemaStr.includes('user_id');
    
    details.push({
      step: 'verify_schema',
      success: hasEmailIndex && hasUserIdIndex,
      message: `Schema validation: email_idx=${hasEmailIndex}, user_id_idx=${hasUserIdIndex}`,
      data: { schemaInfo: schemaStr.substring(0, 200) }
    });
    
    if (!hasEmailIndex || !hasUserIdIndex) {
      throw new Error('Schema missing required indexes');
    }
  } catch (error: any) {
    details.push({
      step: 'verify_schema',
      success: false,
      message: `Schema verification failed: ${error.message}`
    });
  }
  
  // Step 2: Register Test User
  try {
    console.log('Step 2: Registering test user...');
    
    const response = httpRequest(
      'POST',
      `${input.apiBaseUrl}/auth/register`,
      {
        email: testEmail,
        password: testPassword,
        name: testName,
        org_name: testOrgName
      },
      { 'Content-Type': 'application/json' }
    );
    
    const registrationSuccess = response.statusCode === 200 && response.body.token;
    
    if (registrationSuccess) {
      actualUserId = response.body.user?.user_id;
      actualOrgId = response.body.organization?.org_id;
    }
    
    details.push({
      step: 'register_user',
      success: registrationSuccess,
      message: `Registration ${registrationSuccess ? 'succeeded' : 'failed'}: HTTP ${response.statusCode}`,
      data: { user_id: actualUserId, org_id: actualOrgId }
    });
    
    if (!registrationSuccess) {
      throw new Error(`Registration failed with status ${response.statusCode}`);
    }
  } catch (error: any) {
    details.push({
      step: 'register_user',
      success: false,
      message: `Registration error: ${error.message}`
    });
  }
  
  // Step 3: Verify Record Exists in Database
  try {
    console.log('Step 3: Verifying user record in database...');
    
    // Wait a moment for async operations
    exec('sleep 2', true);
    
    const users = executeSurrealQL(
      input.surrealdbPod,
      input.namespace,
      input.database,
      input.namespace,
      `SELECT * FROM users WHERE user_id = "${actualUserId}";`
    );
    
    const recordExists = Array.isArray(users) && users.length > 0 && users[0].length > 0;
    
    details.push({
      step: 'verify_record_exists',
      success: recordExists,
      message: `User record ${recordExists ? 'found' : 'not found'} in database`,
      data: { query_result: recordExists ? users[0][0]?.email : null }
    });
    
    if (!recordExists) {
      throw new Error('User record not found in database after registration');
    }
  } catch (error: any) {
    details.push({
      step: 'verify_record_exists',
      success: false,
      message: `Record verification error: ${error.message}`
    });
  }
  
  // Step 4: Verify Email Index Works
  try {
    console.log('Step 4: Testing email index...');
    
    const usersByEmail = executeSurrealQL(
      input.surrealdbPod,
      input.namespace,
      input.database,
      input.namespace,
      `SELECT * FROM users WHERE email = "${testEmail}";`
    );
    
    const emailIndexWorks = Array.isArray(usersByEmail) && usersByEmail.length > 0 && usersByEmail[0].length > 0;
    
    details.push({
      step: 'test_email_index',
      success: emailIndexWorks,
      message: `Email index ${emailIndexWorks ? 'works' : 'failed'}: query by email returned ${emailIndexWorks ? 'results' : 'empty'}`,
      data: { found_email: emailIndexWorks ? usersByEmail[0][0]?.email : null }
    });
    
    if (!emailIndexWorks) {
      throw new Error('Email index query returned no results');
    }
  } catch (error: any) {
    details.push({
      step: 'test_email_index',
      success: false,
      message: `Email index test error: ${error.message}`
    });
  }
  
  // Step 5: Login with Credentials
  try {
    console.log('Step 5: Testing login...');
    
    const response = httpRequest(
      'POST',
      `${input.apiBaseUrl}/auth/login`,
      {
        email: testEmail,
        password: testPassword
      },
      { 'Content-Type': 'application/json' }
    );
    
    const loginSuccess = response.statusCode === 200 && response.body.token;
    
    if (loginSuccess) {
      loginToken = response.body.token;
    }
    
    details.push({
      step: 'login',
      success: loginSuccess,
      message: `Login ${loginSuccess ? 'succeeded' : 'failed'}: HTTP ${response.statusCode}`,
      data: { 
        has_token: !!loginToken,
        error: !loginSuccess ? response.body.error : null
      }
    });
    
    if (!loginSuccess) {
      throw new Error(`Login failed: ${response.body.error || 'Unknown error'}`);
    }
  } catch (error: any) {
    details.push({
      step: 'login',
      success: false,
      message: `Login error: ${error.message}`
    });
  }
  
  // Step 6: Create Project for Org (Test Relationships)
  try {
    console.log('Step 6: Creating project to test relationships...');
    
    if (!loginToken || !actualOrgId) {
      throw new Error('Missing token or org_id for project creation');
    }
    
    const response = httpRequest(
      'POST',
      `${input.apiBaseUrl}/auth/orgs/${actualOrgId}/projects`,
      {
        name: 'validation-test-project',
        description: 'Test project for validation harness'
      },
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginToken}`
      }
    );
    
    const projectCreated = response.statusCode === 200 || response.statusCode === 201;
    
    if (projectCreated && response.body.project_id) {
      projectId = response.body.project_id;
    }
    
    details.push({
      step: 'create_project',
      success: projectCreated,
      message: `Project ${projectCreated ? 'created' : 'failed'}: HTTP ${response.statusCode}`,
      data: { project_id: projectId }
    });
  } catch (error: any) {
    details.push({
      step: 'create_project',
      success: false,
      message: `Project creation error: ${error.message}`
    });
  }
  
  // Step 7: Restart RPC API Pod
  try {
    console.log('Step 7: Restarting RPC API pod to test persistence...');
    
    const cmd = `kubectl rollout restart deployment -n ${input.namespace} ${input.rpcApiDeployment}`;
    exec(cmd, true);
    
    console.log('Waiting for pod to be ready...');
    const ready = waitForPodReady(input.namespace, input.rpcApiDeployment, 60);
    
    details.push({
      step: 'restart_pod',
      success: ready,
      message: `Pod restart ${ready ? 'completed' : 'timed out'}`
    });
    
    if (!ready) {
      throw new Error('Pod did not become ready after restart');
    }
  } catch (error: any) {
    details.push({
      step: 'restart_pod',
      success: false,
      message: `Pod restart error: ${error.message}`
    });
  }
  
  // Step 8: Re-query to Confirm Persistence
  try {
    console.log('Step 8: Verifying data persists after restart...');
    
    // Wait for services to stabilize
    exec('sleep 5', true);
    
    const users = executeSurrealQL(
      input.surrealdbPod,
      input.namespace,
      input.database,
      input.namespace,
      `SELECT * FROM users WHERE email = "${testEmail}";`
    );
    
    const persistsAcrossRestart = Array.isArray(users) && users.length > 0 && users[0].length > 0;
    
    details.push({
      step: 'verify_persistence',
      success: persistsAcrossRestart,
      message: `Data ${persistsAcrossRestart ? 'persisted' : 'lost'} across restart`,
      data: { user_still_exists: persistsAcrossRestart }
    });
    
    if (!persistsAcrossRestart) {
      throw new Error('User data did not persist across pod restart');
    }
  } catch (error: any) {
    details.push({
      step: 'verify_persistence',
      success: false,
      message: `Persistence verification error: ${error.message}`
    });
  }
  
  // Determine overall pass/fail
  const allPassed = details.every(d => d.success);
  
  const duration = Date.now() - startTime;
  
  return {
    pass: allPassed,
    actual: {
      schemaApplied: details.find(d => d.step === 'verify_schema')?.success || false,
      registrationSuccess: details.find(d => d.step === 'register_user')?.success || false,
      recordExists: details.find(d => d.step === 'verify_record_exists')?.success || false,
      emailIndexWorks: details.find(d => d.step === 'test_email_index')?.success || false,
      loginSuccess: details.find(d => d.step === 'login')?.success || false,
      projectCreated: details.find(d => d.step === 'create_project')?.success || false,
      persistsAcrossRestart: details.find(d => d.step === 'verify_persistence')?.success || false,
    },
    expected,
    details,
    timestamp: new Date().toISOString(),
    duration
  };
}

/**
 * Main entry point for CLI execution
 */
async function main() {
  const input: TestInput = {
    apiBaseUrl: process.env.API_BASE_URL || 'http://api.metabob.local',
    namespace: process.env.K8S_NAMESPACE || 'metabob',
    database: process.env.SURREALDB_DATABASE || 'metabob',
    surrealdbPod: process.env.SURREALDB_POD || findSurrealDBPod('metabob'),
    rpcApiDeployment: process.env.RPC_API_DEPLOYMENT || findRpcApiDeployment('metabob'),
  };
  
  console.log('Starting validation harness for surrealdb-user-persistence-and-query-flow');
  console.log('Configuration:', input);
  console.log('');
  
  try {
    const result = await runValidation(input);
    
    console.log('\n=== Validation Results ===');
    console.log(`Overall: ${result.pass ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log('\nStep Details:');
    
    result.details.forEach(detail => {
      const icon = detail.success ? '✅' : '❌';
      console.log(`  ${icon} ${detail.step}: ${detail.message}`);
      if (detail.data) {
        console.log(`     Data:`, JSON.stringify(detail.data, null, 2));
      }
    });
    
    console.log('\nExpected vs Actual:');
    console.log('Expected:', result.expected);
    console.log('Actual:', result.actual);
    
    process.exit(result.pass ? 0 : 1);
  } catch (error) {
    console.error('Validation harness error:', error);
    process.exit(1);
  }
}

// Run main if executed directly
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].includes('surrealdb-user-persistence-and-query-flow-harness')) {
  main();
}
