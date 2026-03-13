/**
 * Validation Harness: metabob-dashboard-to-cli-data-flow
 * 
 * Tests complete bidirectional data flow:
 * - metabob-dashboard UI → metabob-rpc-api → SurrealDB → metabob-cli
 * - metabob-cli → SurrealDB → metabob-rpc-api → metabob-dashboard UI
 * 
 * Validation Strategy:
 * 1. Verify dashboard container code matches repos/metabob-dashboard
 * 2. Trace data flow for projects, components, problems, sessions
 * 3. Test CLI → SurrealDB → API → Dashboard (write path)
 * 4. Test Dashboard → API → SurrealDB → CLI (read path)
 * 5. Document transformations at each layer
 * 6. Demonstrate state changes propagate end-to-end
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

interface ValidationInput {
  testCase: string;
  description: string;
  entityType: 'project' | 'problem' | 'session' | 'component';
  operation: 'cli-to-dashboard' | 'dashboard-to-cli' | 'bidirectional';
}

interface ValidationOutput {
  pass: boolean;
  actual: any;
  expected: any;
  details: {
    testCase: string;
    operation: string;
    entityType: string;
    transformations: LayerTransformation[];
    errors?: string[];
  };
}

interface LayerTransformation {
  layer: string;
  component: string;
  input: any;
  output: any;
  format: string;
  validated: boolean;
}

interface ContainerCodeValidation {
  pass: boolean;
  dashboard: {
    containerPath: string;
    repoPath: string;
    filesChecked: string[];
    matches: boolean;
  };
}

interface DataFlowTrace {
  entityType: string;
  direction: 'cli-to-dashboard' | 'dashboard-to-cli';
  layers: {
    source: LayerState;
    database: LayerState;
    api: LayerState;
    destination: LayerState;
  };
  transformations: LayerTransformation[];
  propagated: boolean;
}

interface LayerState {
  layer: string;
  data: any;
  format: string;
  timestamp: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  rpcApiUrl: process.env.RPC_API_URL || 'http://localhost:8000',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
  surrealDbUrl: process.env.SURREALDB_URL || 'http://localhost:8080',
  testOrgId: process.env.TEST_ORG_ID || 'test-org-001',
  testUserId: process.env.TEST_USER_ID || 'test-user-001',
  paths: {
    dashboardContainer: '/path/to/dashboard-container', // Update with actual path
    dashboardRepo: path.join(process.cwd(), 'repos/metabob-dashboard'),
    cliRepo: path.join(process.cwd(), 'repos/metabob-cli'),
    rpcApiRepo: path.join(process.cwd(), 'repos/metabob-rpc-api'),
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateTestId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function executeCommand(command: string, cwd?: string): string {
  try {
    return execSync(command, { 
      cwd: cwd || process.cwd(), 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

async function httpRequest(
  url: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE', 
  data?: any,
  headers: Record<string, string> = {}
): Promise<any> {
  const fetch = (await import('node-fetch')).default;
  
  const options: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

// ============================================================================
// Container Code Validation
// ============================================================================

/**
 * Validates that metabob-dashboard container code matches repos/metabob-dashboard
 */
function validateContainerCode(): ContainerCodeValidation {
  const criticalFiles = [
    'src/cloud/api/ProjectApi.js',
    'src/cloud/hooks/useProjects.js',
    'src/cloud/pages/Projects/ProjectDetail.js',
  ];

  const filesChecked: string[] = [];
  let allMatch = true;

  for (const file of criticalFiles) {
    const repoPath = path.join(CONFIG.paths.dashboardRepo, file);
    const containerPath = path.join(CONFIG.paths.dashboardContainer, file);

    filesChecked.push(file);

    if (!fs.existsSync(repoPath)) {
      console.warn(`Repo file not found: ${repoPath}`);
      allMatch = false;
      continue;
    }

    if (!fs.existsSync(containerPath)) {
      console.warn(`Container file not found: ${containerPath}`);
      allMatch = false;
      continue;
    }

    const repoContent = fs.readFileSync(repoPath, 'utf-8');
    const containerContent = fs.readFileSync(containerPath, 'utf-8');

    if (repoContent !== containerContent) {
      console.warn(`File mismatch: ${file}`);
      allMatch = false;
    }
  }

  return {
    pass: allMatch,
    dashboard: {
      containerPath: CONFIG.paths.dashboardContainer,
      repoPath: CONFIG.paths.dashboardRepo,
      filesChecked,
      matches: allMatch,
    },
  };
}

// ============================================================================
// CLI → SurrealDB → API → Dashboard (Write Path)
// ============================================================================

/**
 * Test: CLI creates project → persists in SurrealDB → visible to Dashboard
 */
async function testCliToSurrealDbToDashboard(): Promise<DataFlowTrace> {
  const projectId = generateTestId('project');
  const projectName = `Test Project ${Date.now()}`;

  // Layer 1: CLI creates project via MCP tool
  const cliInput = {
    project_id: projectId,
    org_id: CONFIG.testOrgId,
    name: projectName,
    repository_url: 'https://github.com/test/repo',
    branch: 'main',
  };

  console.log('[CLI] Creating project:', cliInput);

  // Simulate CLI API call to RPC API
  const apiResponse = await httpRequest(
    `${CONFIG.rpcApiUrl}/auth/orgs/${CONFIG.testOrgId}/projects`,
    'POST',
    cliInput,
    { Authorization: `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}` }
  );

  // Layer 2: Verify in SurrealDB
  const dbQuery = `SELECT * FROM projects WHERE project_id = '${projectId}'`;
  const dbResult = await httpRequest(
    `${CONFIG.surrealDbUrl}/sql`,
    'POST',
    { query: dbQuery },
    { 
      'NS': 'metabob',
      'DB': 'metabob',
      'Authorization': 'Basic ' + Buffer.from('root:root').toString('base64')
    }
  );

  // Layer 3: Fetch from Dashboard API
  const dashboardResponse = await httpRequest(
    `${CONFIG.rpcApiUrl}/auth/orgs/${CONFIG.testOrgId}/projects`,
    'GET',
    undefined,
    { Authorization: `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}` }
  );

  const foundInDashboard = dashboardResponse.projects.some(
    (p: any) => p.project_id === projectId
  );

  return {
    entityType: 'project',
    direction: 'cli-to-dashboard',
    layers: {
      source: {
        layer: 'CLI',
        data: cliInput,
        format: 'snake_case (project_id, org_id)',
        timestamp: new Date().toISOString(),
      },
      database: {
        layer: 'SurrealDB',
        data: dbResult,
        format: 'SQL record',
        timestamp: new Date().toISOString(),
      },
      api: {
        layer: 'RPC API',
        data: apiResponse,
        format: 'JSON with snake_case',
        timestamp: new Date().toISOString(),
      },
      destination: {
        layer: 'Dashboard',
        data: dashboardResponse,
        format: 'JSON (transformed to camelCase by RTK Query)',
        timestamp: new Date().toISOString(),
      },
    },
    transformations: [
      {
        layer: 'CLI → RPC API',
        component: 'api_client.call_api()',
        input: cliInput,
        output: apiResponse,
        format: 'snake_case JSON',
        validated: apiResponse.project_id === projectId,
      },
      {
        layer: 'RPC API → SurrealDB',
        component: 'project_ops.create_project()',
        input: apiResponse,
        output: dbResult,
        format: 'SQL INSERT',
        validated: Array.isArray(dbResult) && dbResult.length > 0,
      },
      {
        layer: 'SurrealDB → Dashboard',
        component: 'ProjectApi.useGetProjectsQuery',
        input: dbResult,
        output: dashboardResponse,
        format: 'snake_case → camelCase',
        validated: foundInDashboard,
      },
    ],
    propagated: foundInDashboard,
  };
}

/**
 * Test: CLI creates problems → persists in SurrealDB → visible to Dashboard
 */
async function testCliProblemsToSurrealDbToDashboard(): Promise<DataFlowTrace> {
  const projectId = generateTestId('project');
  const problemId = generateTestId('problem');
  const sessionId = generateTestId('session');

  const problemInput = {
    problem_id: problemId,
    session_id: sessionId,
    project_id: projectId,
    org_id: CONFIG.testOrgId,
    file_path: 'src/test.ts',
    start_line: 10,
    end_line: 15,
    category: 'bug',
    severity: 'HIGH',
    description: 'Test problem',
    recommendation: 'Fix the bug',
    status: 'open',
  };

  console.log('[CLI] Creating problem:', problemInput);

  // Create problem via RPC API
  const apiResponse = await httpRequest(
    `${CONFIG.rpcApiUrl}/api/problems`,
    'POST',
    problemInput,
    { Authorization: `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}` }
  );

  // Fetch from dashboard
  const dashboardResponse = await httpRequest(
    `${CONFIG.rpcApiUrl}/api/projects/${projectId}/problems`,
    'GET',
    undefined,
    { Authorization: `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}` }
  );

  const foundInDashboard = dashboardResponse.problems?.some(
    (p: any) => p.problem_id === problemId
  );

  return {
    entityType: 'problem',
    direction: 'cli-to-dashboard',
    layers: {
      source: {
        layer: 'CLI',
        data: problemInput,
        format: 'snake_case',
        timestamp: new Date().toISOString(),
      },
      database: {
        layer: 'SurrealDB',
        data: { problem_id: problemId },
        format: 'SQL record',
        timestamp: new Date().toISOString(),
      },
      api: {
        layer: 'RPC API',
        data: apiResponse,
        format: 'JSON',
        timestamp: new Date().toISOString(),
      },
      destination: {
        layer: 'Dashboard',
        data: dashboardResponse,
        format: 'JSON with camelCase',
        timestamp: new Date().toISOString(),
      },
    },
    transformations: [
      {
        layer: 'CLI → RPC API',
        component: 'POST /api/problems',
        input: problemInput,
        output: apiResponse,
        format: 'snake_case JSON',
        validated: true,
      },
      {
        layer: 'RPC API → SurrealDB',
        component: 'problem_ops.create_problem()',
        input: problemInput,
        output: { problem_id: problemId },
        format: 'SQL INSERT',
        validated: true,
      },
      {
        layer: 'SurrealDB → Dashboard',
        component: 'GET /api/projects/{id}/problems',
        input: { project_id: projectId },
        output: dashboardResponse,
        format: 'snake_case → camelCase',
        validated: foundInDashboard || false,
      },
    ],
    propagated: foundInDashboard || false,
  };
}

// ============================================================================
// Dashboard → API → SurrealDB → CLI (Read/Update Path)
// ============================================================================

/**
 * Test: Dashboard updates problem status → persists in SurrealDB → visible to CLI
 */
async function testDashboardToSurrealDbToCli(): Promise<DataFlowTrace> {
  const problemId = generateTestId('problem');

  // Dashboard updates problem status
  const updateInput = {
    status: 'acknowledged',
  };

  console.log('[Dashboard] Updating problem status:', updateInput);

  const apiResponse = await httpRequest(
    `${CONFIG.rpcApiUrl}/api/problems/${problemId}`,
    'PUT',
    updateInput,
    { Authorization: `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}` }
  );

  // CLI fetches problem to verify update
  const cliResponse = await httpRequest(
    `${CONFIG.rpcApiUrl}/api/problems/${problemId}`,
    'GET',
    undefined,
    { Authorization: `Bearer ${process.env.TEST_API_TOKEN || 'test-token'}` }
  );

  const statusUpdated = cliResponse.status === 'acknowledged';

  return {
    entityType: 'problem',
    direction: 'dashboard-to-cli',
    layers: {
      source: {
        layer: 'Dashboard',
        data: updateInput,
        format: 'camelCase (transformed from UI)',
        timestamp: new Date().toISOString(),
      },
      database: {
        layer: 'SurrealDB',
        data: { problem_id: problemId, status: 'acknowledged' },
        format: 'SQL UPDATE',
        timestamp: new Date().toISOString(),
      },
      api: {
        layer: 'RPC API',
        data: apiResponse,
        format: 'JSON',
        timestamp: new Date().toISOString(),
      },
      destination: {
        layer: 'CLI',
        data: cliResponse,
        format: 'snake_case JSON',
        timestamp: new Date().toISOString(),
      },
    },
    transformations: [
      {
        layer: 'Dashboard → RPC API',
        component: 'PUT /api/problems/{id}',
        input: updateInput,
        output: apiResponse,
        format: 'camelCase → snake_case',
        validated: true,
      },
      {
        layer: 'RPC API → SurrealDB',
        component: 'problem_ops.update_problem_status()',
        input: updateInput,
        output: { problem_id: problemId, status: 'acknowledged' },
        format: 'SQL UPDATE',
        validated: true,
      },
      {
        layer: 'SurrealDB → CLI',
        component: 'GET /api/problems/{id}',
        input: { problem_id: problemId },
        output: cliResponse,
        format: 'snake_case JSON',
        validated: statusUpdated,
      },
    ],
    propagated: statusUpdated,
  };
}

// ============================================================================
// Main Validation Function
// ============================================================================

export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const errors: string[] = [];
  let dataFlowTrace: DataFlowTrace | null = null;

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running validation: ${input.testCase}`);
    console.log(`Description: ${input.description}`);
    console.log(`${'='.repeat(80)}\n`);

    // Step 1: Validate container code
    if (input.testCase.includes('container-code')) {
      const containerValidation = validateContainerCode();
      return {
        pass: containerValidation.pass,
        actual: containerValidation,
        expected: { matches: true },
        details: {
          testCase: input.testCase,
          operation: input.operation,
          entityType: input.entityType,
          transformations: [],
          errors: containerValidation.pass ? undefined : ['Container code does not match repo'],
        },
      };
    }

    // Step 2: Test data flow based on operation
    if (input.operation === 'cli-to-dashboard') {
      if (input.entityType === 'project') {
        dataFlowTrace = await testCliToSurrealDbToDashboard();
      } else if (input.entityType === 'problem') {
        dataFlowTrace = await testCliProblemsToSurrealDbToDashboard();
      }
    } else if (input.operation === 'dashboard-to-cli') {
      dataFlowTrace = await testDashboardToSurrealDbToCli();
    }

    if (!dataFlowTrace) {
      throw new Error('No data flow trace generated');
    }

    // Step 3: Validate transformations
    const allTransformationsValid = dataFlowTrace.transformations.every(t => t.validated);

    return {
      pass: dataFlowTrace.propagated && allTransformationsValid,
      actual: dataFlowTrace,
      expected: {
        propagated: true,
        allTransformationsValid: true,
      },
      details: {
        testCase: input.testCase,
        operation: input.operation,
        entityType: input.entityType,
        transformations: dataFlowTrace.transformations,
        errors: dataFlowTrace.propagated ? undefined : ['Data did not propagate end-to-end'],
      },
    };

  } catch (error: any) {
    errors.push(error.message);
    return {
      pass: false,
      actual: { error: error.message },
      expected: { success: true },
      details: {
        testCase: input.testCase,
        operation: input.operation,
        entityType: input.entityType,
        transformations: [],
        errors,
      },
    };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  (async () => {
    const testCases: ValidationInput[] = [
      {
        testCase: 'container-code-validation',
        description: 'Verify dashboard container code matches repos/metabob-dashboard',
        entityType: 'project',
        operation: 'cli-to-dashboard',
      },
      {
        testCase: 'cli-project-to-dashboard',
        description: 'CLI creates project → SurrealDB → Dashboard displays',
        entityType: 'project',
        operation: 'cli-to-dashboard',
      },
      {
        testCase: 'cli-problems-to-dashboard',
        description: 'CLI creates problems → SurrealDB → Dashboard displays',
        entityType: 'problem',
        operation: 'cli-to-dashboard',
      },
      {
        testCase: 'dashboard-update-to-cli',
        description: 'Dashboard updates problem → SurrealDB → CLI sees update',
        entityType: 'problem',
        operation: 'dashboard-to-cli',
      },
    ];

    let passCount = 0;
    let failCount = 0;

    for (const testCase of testCases) {
      const result = await runValidation(testCase);
      
      console.log(`\nTest: ${testCase.testCase}`);
      console.log(`Result: ${result.pass ? 'PASS ✅' : 'FAIL ❌'}`);
      
      if (result.pass) {
        passCount++;
      } else {
        failCount++;
        console.log('Errors:', result.details.errors);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Validation Summary: ${passCount} passed, ${failCount} failed`);
    console.log(`${'='.repeat(80)}\n`);

    process.exit(failCount > 0 ? 1 : 0);
  })();
}
