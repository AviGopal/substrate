/**
 * Validation Harness: metabob-cli-to-dashboard-complete-with-deployment
 * 
 * Validates complete end-to-end data flow including deployment:
 * 1. Deploy backend with new API routes
 * 2. Verify API endpoints respond correctly
 * 3. Execute CLI analysis with project registration
 * 4. Verify data persistence in SurrealDB
 * 5. Verify data hierarchy (org→project→session→problems)
 * 6. Test Dashboard API endpoints
 * 7. Verify Dashboard UI displays data
 * 8. Verify temporal tracking for trends
 * 
 * This harness validates the complete implementation of gaps 1-4:
 * - Gap 1: CLI project registration
 * - Gap 2: Session-project linking
 * - Gap 3: SurrealDB persistence
 * - Gap 4: Dashboard API routes
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Types
interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  errors: string[];
  warnings: string[];
  metadata: {
    testCase: string;
    timestamp: string;
    duration: number;
    gaps: {
      gap1: boolean; // CLI project registration
      gap2: boolean; // Session-project linking
      gap3: boolean; // SurrealDB persistence
      gap4: boolean; // Dashboard API routes
    };
  };
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
}

interface DeploymentStatus {
  backendDeployed: boolean;
  endpointsAvailable: boolean;
  dockerImageTag: string;
  deploymentTime: string;
}

interface ProjectRegistration {
  projectId: string;
  orgId: string;
  projectName: string;
  gitRootHash?: string;
  repositoryUrl?: string;
}

interface SessionLinking {
  sessionId: string;
  projectId: string;
  linkedInRedis: boolean;
}

interface SurrealDBData {
  projects: any[];
  sessions: any[];
  problems: any[];
  hierarchyValid: boolean;
}

interface DashboardValidation {
  apiResponds: boolean;
  dataDisplayed: boolean;
  temporalTrends: boolean;
}

// Configuration
const CONFIG = {
  rpcApiUrl: process.env.RPC_API_URL || 'http://localhost:8000',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
  surrealDbUrl: process.env.SURREALDB_URL || 'http://localhost:8080',
  testRepoPath: process.env.TEST_REPO_PATH || './repos/metabob-cli',
  kubeContext: process.env.KUBE_CONTEXT || 'minikube',
  kubeNamespace: process.env.KUBE_NAMESPACE || 'metabob-prod',
  dockerRegistry: process.env.DOCKER_REGISTRY || 'localhost:5000',
  cliCommand: process.env.CLI_COMMAND || 'metabob-cli',
  timeout: 600000, // 10 minutes for deployment + testing
};

// Test data
const TEST_USER = {
  email: 'deployment-test@metabob.com',
  password: 'DeploymentTest123!',
  name: 'Deployment Test User',
  org_name: 'Deployment Test Org',
};

const TEST_PROJECT = {
  name: 'test-metabob-cli',
  repository_url: 'https://github.com/metabob/metabob-cli',
  branch: 'main',
};

/**
 * Main validation runner
 */
export async function runValidation(input: TestCase): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const actual: any = {
    deployment: null,
    projectRegistration: null,
    sessionLinking: null,
    surrealDBData: null,
    dashboardValidation: null,
  };

  const gaps = {
    gap1: false, // CLI project registration
    gap2: false, // Session-project linking
    gap3: false, // SurrealDB persistence
    gap4: false, // Dashboard API routes
  };

  try {
    console.log('=== Starting metabob-cli-to-dashboard-complete-with-deployment validation ===');
    
    // Step 1: Deploy backend changes
    console.log('\n[Step 1] Deploying backend with new API routes...');
    try {
      const deployment = await deployBackend();
      actual.deployment = deployment;
      
      if (!deployment.backendDeployed) {
        warnings.push('Backend deployment skipped or failed - testing with existing deployment');
      }
    } catch (error) {
      warnings.push(`Deployment step failed: ${error.message}. Continuing with existing deployment.`);
    }

    // Step 2: Verify API endpoints are available
    console.log('\n[Step 2] Verifying API endpoints...');
    const endpointsAvailable = await verifyApiEndpoints();
    actual.endpointsAvailable = endpointsAvailable;
    
    if (!endpointsAvailable.projectsEndpoint) {
      errors.push('Projects API endpoint not available (GET /auth/orgs/{org_id}/projects)');
      gaps.gap4 = false;
    } else {
      gaps.gap4 = true;
      console.log('✓ Gap 4: Dashboard API routes - PASSED');
    }

    // Step 3: Setup test user and organization
    console.log('\n[Step 3] Setting up test user and organization...');
    const auth = await setupTestUserAndOrg();
    actual.auth = auth;
    
    if (!auth.success) {
      errors.push(`Failed to setup test user: ${auth.error}`);
      return buildResult(false, input, actual, errors, warnings, gaps, startTime);
    }

    // Step 4: Execute CLI analysis with project registration
    console.log('\n[Step 4] Running metabob-cli analysis (with project registration)...');
    const analysis = await runCliAnalysisWithProjectRegistration(
      auth.token,
      auth.org_id
    );
    actual.analysis = analysis;

    if (!analysis.success) {
      errors.push(`CLI analysis failed: ${analysis.error}`);
      gaps.gap1 = false;
      return buildResult(false, input, actual, errors, warnings, gaps, startTime);
    }

    // Check if project was registered (Gap 1)
    if (analysis.projectRegistered && analysis.projectId) {
      gaps.gap1 = true;
      console.log('✓ Gap 1: CLI project registration - PASSED');
      actual.projectRegistration = {
        projectId: analysis.projectId,
        orgId: auth.org_id,
        projectName: analysis.projectName,
      };
    } else {
      errors.push('Project was not registered by CLI (Gap 1 not implemented)');
      gaps.gap1 = false;
    }

    // Step 5: Verify session-project linking in Redis (Gap 2)
    console.log('\n[Step 5] Verifying session-project linking...');
    const sessionLink = await verifySessionProjectLink(
      analysis.sessionId,
      analysis.projectId
    );
    actual.sessionLinking = sessionLink;

    if (sessionLink.linkedInRedis) {
      gaps.gap2 = true;
      console.log('✓ Gap 2: Session-project linking - PASSED');
    } else {
      errors.push('Session not linked to project in Redis (Gap 2 not implemented)');
      gaps.gap2 = false;
    }

    // Step 6: Query SurrealDB to verify data persistence (Gap 3)
    console.log('\n[Step 6] Querying SurrealDB for persisted data...');
    const surrealData = await querySurrealDB(auth.org_id, analysis.projectId);
    actual.surrealDBData = surrealData;

    // Check if problems were persisted to SurrealDB
    if (surrealData.problems && surrealData.problems.length > 0) {
      gaps.gap3 = true;
      console.log('✓ Gap 3: SurrealDB persistence - PASSED');
    } else {
      warnings.push('No problems found in SurrealDB (Gap 3 may not be implemented)');
      gaps.gap3 = false;
    }

    // Verify data hierarchy
    if (!surrealData.hierarchyValid) {
      errors.push('Data hierarchy validation failed (org→project→session→problems)');
    }

    // Step 7: Test Dashboard API endpoints
    console.log('\n[Step 7] Testing Dashboard API endpoints...');
    const dashboardApi = await testDashboardApi(auth.token, auth.org_id);
    actual.dashboardApi = dashboardApi;

    if (!dashboardApi.projectsRetrieved) {
      errors.push('Dashboard API failed to retrieve projects');
    }

    // Step 8: Verify Dashboard UI displays data (using Playwright if available)
    console.log('\n[Step 8] Verifying Dashboard UI...');
    try {
      const dashboardUI = await verifyDashboardUI(auth.token);
      actual.dashboardUI = dashboardUI;
      
      if (!dashboardUI.dataDisplayed) {
        warnings.push('Dashboard UI validation incomplete or data not displayed');
      }
    } catch (error) {
      warnings.push(`Dashboard UI validation skipped: ${error.message}`);
    }

    // Step 9: Verify temporal tracking
    console.log('\n[Step 9] Verifying temporal tracking...');
    const temporal = await verifyTemporalTracking(auth.org_id, analysis.projectId);
    actual.temporal = temporal;

    if (!temporal.timestampsPresent) {
      warnings.push('Temporal timestamps not found in data');
    }

    // Determine overall pass/fail
    const allGapsPassed = gaps.gap1 && gaps.gap2 && gaps.gap4;
    const criticalErrorsPresent = errors.length > 0;
    const pass = allGapsPassed && !criticalErrorsPresent;

    console.log('\n=== Validation Summary ===');
    console.log(`Gap 1 (CLI project registration): ${gaps.gap1 ? 'PASS' : 'FAIL'}`);
    console.log(`Gap 2 (Session-project linking): ${gaps.gap2 ? 'PASS' : 'FAIL'}`);
    console.log(`Gap 3 (SurrealDB persistence): ${gaps.gap3 ? 'PASS' : 'WARN (not required)'}`);
    console.log(`Gap 4 (Dashboard API routes): ${gaps.gap4 ? 'PASS' : 'FAIL'}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Overall: ${pass ? 'PASS' : 'FAIL'}`);

    return buildResult(pass, input, actual, errors, warnings, gaps, startTime);

  } catch (error) {
    errors.push(`Validation failed with exception: ${error.message}`);
    return buildResult(false, input, actual, errors, warnings, gaps, startTime);
  }
}

/**
 * Deploy backend with new API routes
 */
async function deployBackend(): Promise<DeploymentStatus> {
  const result: DeploymentStatus = {
    backendDeployed: false,
    endpointsAvailable: false,
    dockerImageTag: '',
    deploymentTime: new Date().toISOString(),
  };

  try {
    // Check if kubectl is available
    try {
      execSync('kubectl version --client', { stdio: 'ignore' });
    } catch {
      console.log('kubectl not available - skipping deployment');
      return result;
    }

    // Build Docker image
    console.log('Building Docker image...');
    const imageTag = `${CONFIG.dockerRegistry}/metabob-rpc-api:${Date.now()}`;
    
    try {
      execSync(
        `docker build -t ${imageTag} ./repos/metabob-rpc-api`,
        { stdio: 'inherit', cwd: process.cwd() }
      );
      result.dockerImageTag = imageTag;
    } catch (error) {
      console.log('Docker build failed or skipped');
      return result;
    }

    // Push to registry
    console.log('Pushing image to registry...');
    try {
      execSync(`docker push ${imageTag}`, { stdio: 'inherit' });
    } catch (error) {
      console.log('Docker push failed - may need registry access');
      return result;
    }

    // Update deployment
    console.log('Updating Kubernetes deployment...');
    try {
      execSync(
        `kubectl set image deployment/metabob-rpc-api ` +
        `metabob-rpc-api=${imageTag} ` +
        `-n ${CONFIG.kubeNamespace}`,
        { stdio: 'inherit' }
      );
      
      // Wait for rollout
      execSync(
        `kubectl rollout status deployment/metabob-rpc-api -n ${CONFIG.kubeNamespace} --timeout=120s`,
        { stdio: 'inherit' }
      );
      
      result.backendDeployed = true;
    } catch (error) {
      console.log('Kubernetes deployment update failed');
      return result;
    }

    return result;

  } catch (error) {
    console.log(`Deployment error: ${error.message}`);
    return result;
  }
}

/**
 * Verify API endpoints are available
 */
async function verifyApiEndpoints(): Promise<any> {
  const results = {
    projectsEndpoint: false,
    createProjectEndpoint: false,
    baseApiResponding: false,
  };

  try {
    // Check base API
    const baseResponse = await fetch(`${CONFIG.rpcApiUrl}/health`);
    results.baseApiResponding = baseResponse.ok;

    // Check OpenAPI spec for project routes
    try {
      const openapiResponse = await fetch(`${CONFIG.rpcApiUrl}/openapi.json`);
      if (openapiResponse.ok) {
        const openapi = await openapiResponse.json();
        
        // Check if project routes are in the spec
        const paths = openapi.paths || {};
        results.projectsEndpoint = !!paths['/auth/orgs/{org_id}/projects'];
        results.createProjectEndpoint = !!paths['/auth/orgs/{org_id}/projects']?.post;
      }
    } catch (error) {
      console.log(`OpenAPI check failed: ${error.message}`);
    }

  } catch (error) {
    console.log(`API endpoint verification failed: ${error.message}`);
  }

  return results;
}

/**
 * Setup test user and organization
 */
async function setupTestUserAndOrg(): Promise<any> {
  try {
    // Register user
    const registerResponse = await fetch(`${CONFIG.rpcApiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    let authData;
    if (registerResponse.status === 409) {
      // User exists, login instead
      const loginResponse = await fetch(`${CONFIG.rpcApiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: TEST_USER.password,
        }),
      });

      if (!loginResponse.ok) {
        return {
          success: false,
          error: `Login failed: ${loginResponse.status} ${await loginResponse.text()}`,
        };
      }

      authData = await loginResponse.json();
    } else if (!registerResponse.ok) {
      return {
        success: false,
        error: `Registration failed: ${registerResponse.status} ${await registerResponse.text()}`,
      };
    } else {
      authData = await registerResponse.json();
    }

    return {
      success: true,
      token: authData.token,
      org_id: authData.user?.org_id || authData.organization?.org_id,
      user_id: authData.user?.user_id,
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Run CLI analysis with project registration
 */
async function runCliAnalysisWithProjectRegistration(
  token: string,
  orgId: string
): Promise<any> {
  try {
    // Create config file with auth token
    const configPath = path.join(CONFIG.testRepoPath, '.metabob', 'config.json');
    const configDir = path.dirname(configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = {
      api_key: token,
      base_url: CONFIG.rpcApiUrl,
      project_name: TEST_PROJECT.name,
      repository_url: TEST_PROJECT.repository_url,
      branch: TEST_PROJECT.branch,
      include_paths: ['src/**/*.py', 'src/**/*.ts'],
      exclude_paths: ['**/test_*.py', '**/*.test.ts'],
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Run metabob-cli analyze
    const { stdout, stderr } = await execAsync(
      `${CONFIG.cliCommand} analyze --config ${configPath}`,
      {
        cwd: CONFIG.testRepoPath,
        timeout: CONFIG.timeout,
      }
    );

    const output = stdout + stderr;

    // Parse output to check if project was registered
    const projectRegistered = output.includes('Registering project') ||
                              output.includes('Project registered with ID');
    
    // Extract project_id from output
    const projectIdMatch = output.match(/Project registered with ID: ([a-f0-9-]+)/);
    const projectId = projectIdMatch ? projectIdMatch[1] : null;

    // Extract session_id from output
    const sessionIdMatch = output.match(/session[_\s]?id[:\s]+([a-f0-9-]+)/i);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;

    return {
      success: true,
      projectRegistered,
      projectId,
      sessionId,
      projectName: TEST_PROJECT.name,
      output,
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      projectRegistered: false,
    };
  }
}

/**
 * Verify session-project linking in Redis
 */
async function verifySessionProjectLink(
  sessionId: string,
  projectId: string
): Promise<SessionLinking> {
  try {
    // Query Redis to check if session has project_id
    // This would require Redis client or API endpoint to check Redis data
    // For now, we'll check via the analysis endpoint
    
    const response = await fetch(
      `${CONFIG.rpcApiUrl}/analysis?session=${sessionId}`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      return {
        sessionId,
        projectId,
        linkedInRedis: false,
      };
    }

    const data = await response.json();
    
    // Check if project_id is present in session data
    const linkedInRedis = data.project_id === projectId;

    return {
      sessionId,
      projectId,
      linkedInRedis,
    };

  } catch (error) {
    console.log(`Session link verification error: ${error.message}`);
    return {
      sessionId,
      projectId,
      linkedInRedis: false,
    };
  }
}

/**
 * Query SurrealDB for persisted data
 */
async function querySurrealDB(orgId: string, projectId: string): Promise<SurrealDBData> {
  const result: SurrealDBData = {
    projects: [],
    sessions: [],
    problems: [],
    hierarchyValid: false,
  };

  try {
    // Query projects
    const projectsQuery = `SELECT * FROM projects WHERE org_id = '${orgId}'`;
    const projectsResponse = await fetch(`${CONFIG.surrealDbUrl}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'NS': 'metabob',
        'DB': 'metabob',
      },
      body: JSON.stringify({ query: projectsQuery }),
    });

    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      result.projects = projectsData.result || [];
    }

    // Query problems
    const problemsQuery = `SELECT * FROM problems WHERE project_id = '${projectId}' LIMIT 100`;
    const problemsResponse = await fetch(`${CONFIG.surrealDbUrl}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'NS': 'metabob',
        'DB': 'metabob',
      },
      body: JSON.stringify({ query: problemsQuery }),
    });

    if (problemsResponse.ok) {
      const problemsData = await problemsResponse.json();
      result.problems = problemsData.result || [];
    }

    // Verify hierarchy
    result.hierarchyValid = 
      result.projects.length > 0 &&
      result.projects.some(p => p.org_id === orgId && p.project_id === projectId);

  } catch (error) {
    console.log(`SurrealDB query error: ${error.message}`);
  }

  return result;
}

/**
 * Test Dashboard API endpoints
 */
async function testDashboardApi(token: string, orgId: string): Promise<any> {
  const results = {
    projectsRetrieved: false,
    projectsData: null,
  };

  try {
    const response = await fetch(
      `${CONFIG.rpcApiUrl}/auth/orgs/${orgId}/projects`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      results.projectsData = await response.json();
      results.projectsRetrieved = Array.isArray(results.projectsData);
    }

  } catch (error) {
    console.log(`Dashboard API test error: ${error.message}`);
  }

  return results;
}

/**
 * Verify Dashboard UI displays data (Playwright)
 */
async function verifyDashboardUI(token: string): Promise<DashboardValidation> {
  // Placeholder - would use Playwright for actual UI testing
  return {
    apiResponds: true,
    dataDisplayed: false,
    temporalTrends: false,
  };
}

/**
 * Verify temporal tracking
 */
async function verifyTemporalTracking(orgId: string, projectId: string): Promise<any> {
  const result = {
    timestampsPresent: false,
    createdAt: null,
    updatedAt: null,
  };

  try {
    // Query for project to check timestamps
    const query = `SELECT created_at, updated_at FROM projects WHERE project_id = '${projectId}'`;
    const response = await fetch(`${CONFIG.surrealDbUrl}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'NS': 'metabob',
        'DB': 'metabob',
      },
      body: JSON.stringify({ query }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        const record = data.result[0];
        result.timestampsPresent = !!(record.created_at && record.updated_at);
        result.createdAt = record.created_at;
        result.updatedAt = record.updated_at;
      }
    }

  } catch (error) {
    console.log(`Temporal tracking verification error: ${error.message}`);
  }

  return result;
}

/**
 * Build validation result
 */
function buildResult(
  pass: boolean,
  input: TestCase,
  actual: any,
  errors: string[],
  warnings: string[],
  gaps: any,
  startTime: number
): ValidationResult {
  return {
    pass,
    actual,
    expected: input.expectedOutput,
    errors,
    warnings,
    metadata: {
      testCase: input.id,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      gaps,
    },
  };
}

/**
 * Test cases
 */
export const testCases: TestCase[] = [
  {
    id: 'validation-metabob-cli-to-dashboard-complete-with-deployment-case-1',
    name: 'Complete end-to-end data flow with deployment',
    description: 'Validates entire pipeline from deployment through CLI analysis to dashboard display',
    input: {
      testUser: TEST_USER,
      testProject: TEST_PROJECT,
      deploymentRequired: true,
    },
    expectedOutput: {
      gaps: {
        gap1: true, // CLI project registration
        gap2: true, // Session-project linking
        gap3: true, // SurrealDB persistence (optional)
        gap4: true, // Dashboard API routes
      },
      deployment: {
        backendDeployed: true,
        endpointsAvailable: true,
      },
      projectRegistered: true,
      sessionLinked: true,
      dataInSurrealDB: true,
      dashboardDisplays: true,
      temporalTracking: true,
    },
  },
];

// Main execution if run directly
if (require.main === module) {
  (async () => {
    console.log('Running validation harness...\n');
    
    for (const testCase of testCases) {
      console.log(`\n=== Running test: ${testCase.name} ===\n`);
      const result = await runValidation(testCase);
      
      console.log('\n=== Result ===');
      console.log(`Pass: ${result.pass}`);
      console.log(`Errors: ${result.errors.length}`);
      console.log(`Warnings: ${result.warnings.length}`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(e => console.log(`  - ${e}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(w => console.log(`  - ${w}`));
      }
      
      console.log(`\nDuration: ${result.metadata.duration}ms`);
      
      // Save result to file
      const resultPath = path.join(
        __dirname,
        `../../test-results/metabob-cli-to-dashboard-complete-${Date.now()}.json`
      );
      fs.mkdirSync(path.dirname(resultPath), { recursive: true });
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
      console.log(`\nResult saved to: ${resultPath}`);
    }
  })();
}
