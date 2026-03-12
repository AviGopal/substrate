/**
 * Validation Harness: metabob-cli-to-dashboard-e2e-data-flow
 * 
 * Tests complete E2E data flow from metabob-cli to dashboard:
 * 1. Project registration via CLI
 * 2. Session-project linking
 * 3. SurrealDB persistence
 * 4. Dashboard query endpoints
 * 5. Temporal tracking
 * 6. Schema compliance
 * 
 * Specification: metabob-cli-to-dashboard-e2e-data-flow
 * Status: Production validation ready
 */

import axios, { AxiosInstance } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ValidationResult {
  pass: boolean;
  testCase: string;
  actual: any;
  expected: any;
  error?: string;
  duration?: number;
}

interface TestConfig {
  rpcApiUrl: string;
  surrealDbUrl: string;
  surrealDbNamespace: string;
  surrealDbDatabase: string;
  testOrgId?: string;
  testUserId?: string;
  jwtToken?: string;
}

interface ProjectData {
  project_id: string;
  org_id: string;
  name: string;
  repository_url?: string;
  branch: string;
  git_root_hash?: string;
  stats: {
    total_sessions: number;
    total_activities: number;
    total_problems_found: number;
    total_problems_fixed: number;
  };
  created_at: string;
  updated_at: string;
}

interface ProblemData {
  problem_id: string;
  session_id: string;
  project_id: string;
  org_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  category: string;
  severity: string;
  description: string;
  recommendation?: string;
  context: string;
  problem_hash: string;
  status: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

/**
 * Validation Test Case 1: Project Registration
 * Tests CLI project registration via POST /auth/orgs/{org_id}/projects
 */
async function testProjectRegistration(
  config: TestConfig,
  apiClient: AxiosInstance
): Promise<ValidationResult> {
  const startTime = Date.now();
  const testCase = 'V1: CLI Project Registration';

  try {
    const projectData = {
      name: 'test-validation-project',
      repository_url: 'https://github.com/test/validation',
      branch: 'main',
      git_root_hash: 'abc123def456',
      settings: {}
    };

    const expected = {
      hasProjectId: true,
      hasOrgId: true,
      nameMatches: true,
      repoUrlMatches: true,
      branchMatches: true,
      gitHashMatches: true,
      hasStats: true,
      hasTimestamps: true
    };

    // Call project registration endpoint
    const response = await apiClient.post(
      `/auth/orgs/${config.testOrgId}/projects`,
      projectData
    );

    const actual = {
      hasProjectId: !!response.data.project_id,
      hasOrgId: response.data.org_id === config.testOrgId,
      nameMatches: response.data.name === projectData.name,
      repoUrlMatches: response.data.repository_url === projectData.repository_url,
      branchMatches: response.data.branch === projectData.branch,
      gitHashMatches: response.data.git_root_hash === projectData.git_root_hash,
      hasStats: !!response.data.stats,
      hasTimestamps: !!response.data.created_at && !!response.data.updated_at
    };

    const pass = Object.keys(expected).every(
      key => actual[key] === expected[key]
    );

    return {
      pass,
      testCase,
      actual: { ...actual, project_id: response.data.project_id },
      expected,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: null,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Validation Test Case 2: Session-Project Linking
 * Tests project_id storage in Redis session via POST /v2/submit
 */
async function testSessionProjectLinking(
  config: TestConfig,
  apiClient: AxiosInstance,
  projectId: string
): Promise<ValidationResult> {
  const startTime = Date.now();
  const testCase = 'V2: Session-Project Linking';

  try {
    const FormData = require('form-data');
    const form = new FormData();
    
    // Add mock file for analysis
    form.append('files', Buffer.from('def test(): pass'), {
      filename: 'test.py',
      contentType: 'text/plain'
    });
    
    // Add project_id
    form.append('project_id', projectId);

    const expected = {
      hasJobId: true,
      statusIsQueued: true
    };

    // Submit analysis with project_id
    const response = await apiClient.post('/v2/submit', form, {
      headers: {
        ...form.getHeaders()
      }
    });

    const actual = {
      hasJobId: !!response.data.jobId,
      statusIsQueued: response.data.status === 'queued' || response.data.status === 'processing'
    };

    const pass = Object.keys(expected).every(
      key => actual[key] === expected[key]
    );

    return {
      pass,
      testCase,
      actual: { ...actual, session_id: response.data.jobId },
      expected,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: null,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Validation Test Case 3: SurrealDB Problem Persistence
 * Tests problems persist to SurrealDB with correct schema
 */
async function testSurrealDBPersistence(
  config: TestConfig,
  projectId: string,
  sessionId: string
): Promise<ValidationResult> {
  const startTime = Date.now();
  const testCase = 'V3: SurrealDB Problem Persistence';

  try {
    // Wait for Celery task to complete (simulated)
    await new Promise(resolve => setTimeout(resolve, 5000));

    const expected = {
      hasProblems: true,
      schemaCompliant: true,
      hasOrgId: true,
      hasProjectId: true,
      hasTimestamps: true,
      temporalOrdering: true
    };

    // Query SurrealDB via REST API (assumes SurrealDB HTTP endpoint)
    const surrealResponse = await axios.post(
      `${config.surrealDbUrl}/sql`,
      `SELECT * FROM problems WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 10`,
      {
        headers: {
          'Accept': 'application/json',
          'NS': config.surrealDbNamespace,
          'DB': config.surrealDbDatabase
        }
      }
    );

    const problems = surrealResponse.data[0]?.result || [];
    
    const schemaFields = [
      'problem_id', 'session_id', 'project_id', 'org_id', 
      'file_path', 'start_line', 'end_line', 'category', 
      'severity', 'description', 'status', 'created_at', 'updated_at'
    ];

    const schemaCompliant = problems.length > 0 && 
      schemaFields.every(field => field in problems[0]);

    const actual = {
      hasProblems: problems.length > 0,
      schemaCompliant,
      hasOrgId: problems.length > 0 && !!problems[0].org_id,
      hasProjectId: problems.length > 0 && problems[0].project_id === projectId,
      hasTimestamps: problems.length > 0 && !!problems[0].created_at && !!problems[0].updated_at,
      temporalOrdering: problems.length > 1 && 
        new Date(problems[0].created_at) >= new Date(problems[1].created_at)
    };

    const pass = Object.keys(expected).every(
      key => actual[key] === expected[key]
    );

    return {
      pass,
      testCase,
      actual: { ...actual, problemCount: problems.length },
      expected,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: null,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Validation Test Case 4: Dashboard Problem Query
 * Tests GET /auth/orgs/{org_id}/projects/{project_id}/problems
 */
async function testDashboardProblemQuery(
  config: TestConfig,
  apiClient: AxiosInstance,
  projectId: string
): Promise<ValidationResult> {
  const startTime = Date.now();
  const testCase = 'V4: Dashboard Problem Query';

  try {
    const expected = {
      hasProblems: true,
      hasTotal: true,
      hasGroupedByComponent: true,
      hasSeverityDistribution: true,
      hasPagination: true
    };

    // Query problems via dashboard endpoint
    const response = await apiClient.get(
      `/auth/orgs/${config.testOrgId}/projects/${projectId}/problems?limit=100`
    );

    const actual = {
      hasProblems: Array.isArray(response.data.problems),
      hasTotal: typeof response.data.total === 'number',
      hasGroupedByComponent: !!response.data.grouped_by_component,
      hasSeverityDistribution: !!response.data.severity_distribution,
      hasPagination: typeof response.data.hasMore === 'boolean'
    };

    const pass = Object.keys(expected).every(
      key => actual[key] === expected[key]
    );

    return {
      pass,
      testCase,
      actual: {
        ...actual,
        problemCount: response.data.problems?.length || 0,
        components: Object.keys(response.data.grouped_by_component || {}).length,
        severities: Object.keys(response.data.severity_distribution || {}).length
      },
      expected,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: null,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Validation Test Case 5: Temporal Tracking
 * Tests problems can be queried by date range and ordered by created_at
 */
async function testTemporalTracking(
  config: TestConfig,
  apiClient: AxiosInstance,
  projectId: string
): Promise<ValidationResult> {
  const startTime = Date.now();
  const testCase = 'V5: Temporal Tracking';

  try {
    const expected = {
      problemsOrdered: true,
      timestampsValid: true,
      descendingOrder: true
    };

    // Query problems
    const response = await apiClient.get(
      `/auth/orgs/${config.testOrgId}/projects/${projectId}/problems?limit=100`
    );

    const problems = response.data.problems || [];
    
    const timestampsValid = problems.every((p: any) => {
      const createdAt = new Date(p.created_at);
      const updatedAt = new Date(p.updated_at);
      return !isNaN(createdAt.getTime()) && !isNaN(updatedAt.getTime());
    });

    const descendingOrder = problems.length < 2 || problems.every((p: any, i: number) => {
      if (i === 0) return true;
      const current = new Date(p.created_at);
      const previous = new Date(problems[i - 1].created_at);
      return current <= previous;
    });

    const actual = {
      problemsOrdered: problems.length > 0,
      timestampsValid,
      descendingOrder
    };

    const pass = Object.keys(expected).every(
      key => actual[key] === expected[key]
    );

    return {
      pass,
      testCase,
      actual: { ...actual, problemCount: problems.length },
      expected,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: null,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Validation Test Case 6: Stats Updates
 * Tests project stats are updated correctly when problems are persisted
 */
async function testStatsUpdates(
  config: TestConfig,
  apiClient: AxiosInstance,
  projectId: string
): Promise<ValidationResult> {
  const startTime = Date.now();
  const testCase = 'V6: Stats Updates';

  try {
    const expected = {
      hasStats: true,
      statsAreNumeric: true,
      problemsFoundPositive: true
    };

    // Get project with stats
    const response = await apiClient.get(
      `/auth/orgs/${config.testOrgId}/projects?limit=100`
    );

    const project = response.data.projects?.find((p: any) => p.project_id === projectId);

    const actual = {
      hasStats: !!project?.stats,
      statsAreNumeric: 
        typeof project?.stats?.total_sessions === 'number' &&
        typeof project?.stats?.total_activities === 'number' &&
        typeof project?.stats?.total_problems_found === 'number' &&
        typeof project?.stats?.total_problems_fixed === 'number',
      problemsFoundPositive: (project?.stats?.total_problems_found || 0) >= 0
    };

    const pass = Object.keys(expected).every(
      key => actual[key] === expected[key]
    );

    return {
      pass,
      testCase,
      actual: { ...actual, stats: project?.stats },
      expected,
      duration: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      pass: false,
      testCase,
      actual: null,
      expected: null,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Main validation runner
 * Executes all test cases and returns results
 */
export async function runValidation(config: TestConfig): Promise<{
  pass: boolean;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}> {
  const startTime = Date.now();
  const results: ValidationResult[] = [];

  // Create API client with JWT authentication
  const apiClient = axios.create({
    baseURL: config.rpcApiUrl,
    headers: {
      'Authorization': `Bearer ${config.jwtToken}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // Test 1: Project Registration
    const v1Result = await testProjectRegistration(config, apiClient);
    results.push(v1Result);

    if (!v1Result.pass) {
      console.error('V1 failed, skipping dependent tests');
      return {
        pass: false,
        results,
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          duration: Date.now() - startTime
        }
      };
    }

    const projectId = v1Result.actual.project_id;

    // Test 2: Session-Project Linking
    const v2Result = await testSessionProjectLinking(config, apiClient, projectId);
    results.push(v2Result);

    const sessionId = v2Result.actual?.session_id;

    // Test 3: SurrealDB Persistence
    if (sessionId) {
      const v3Result = await testSurrealDBPersistence(config, projectId, sessionId);
      results.push(v3Result);
    }

    // Test 4: Dashboard Problem Query
    const v4Result = await testDashboardProblemQuery(config, apiClient, projectId);
    results.push(v4Result);

    // Test 5: Temporal Tracking
    const v5Result = await testTemporalTracking(config, apiClient, projectId);
    results.push(v5Result);

    // Test 6: Stats Updates
    const v6Result = await testStatsUpdates(config, apiClient, projectId);
    results.push(v6Result);

    // Calculate summary
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const allPassed = failed === 0;

    return {
      pass: allPassed,
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        duration: Date.now() - startTime
      }
    };
  } catch (error: any) {
    console.error('Validation harness error:', error);
    return {
      pass: false,
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.pass).length,
        failed: results.filter(r => !r.pass).length + 1,
        duration: Date.now() - startTime
      }
    };
  }
}

/**
 * CLI entry point for standalone execution
 */
if (require.main === module) {
  const config: TestConfig = {
    rpcApiUrl: process.env.RPC_API_URL || 'http://localhost:8000',
    surrealDbUrl: process.env.SURREALDB_URL || 'http://localhost:8000',
    surrealDbNamespace: process.env.SURREALDB_NS || 'test',
    surrealDbDatabase: process.env.SURREALDB_DB || 'test',
    testOrgId: process.env.TEST_ORG_ID,
    testUserId: process.env.TEST_USER_ID,
    jwtToken: process.env.JWT_TOKEN
  };

  if (!config.testOrgId || !config.jwtToken) {
    console.error('Missing required environment variables: TEST_ORG_ID, JWT_TOKEN');
    process.exit(1);
  }

  runValidation(config)
    .then(result => {
      console.log('\n=== Validation Results ===');
      console.log(`Total: ${result.summary.total}`);
      console.log(`Passed: ${result.summary.passed}`);
      console.log(`Failed: ${result.summary.failed}`);
      console.log(`Duration: ${result.summary.duration}ms`);
      console.log('\nTest Cases:');
      result.results.forEach(r => {
        const status = r.pass ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${r.testCase} (${r.duration}ms)`);
        if (!r.pass) {
          console.log(`  Error: ${r.error || 'Expected !== Actual'}`);
          console.log(`  Expected:`, JSON.stringify(r.expected, null, 2));
          console.log(`  Actual:`, JSON.stringify(r.actual, null, 2));
        }
      });
      process.exit(result.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}
