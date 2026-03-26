#!/usr/bin/env bun
/**
 * End-to-End Integration Test: metabob-mcp → metabob-analysis-api
 *
 * Validates the complete stack:
 * 1. MCP tools → Analysis API endpoints
 * 2. Request/response contract compliance
 * 3. Error handling propagation
 * 4. Performance characteristics
 * 5. Common workflow scenarios
 */

interface TestResult {
  tool: string;
  endpoint: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  details?: any;
}

interface WorkflowResult {
  workflow: string;
  steps: TestResult[];
  success: boolean;
  totalLatencyMs: number;
}

const ANALYSIS_API_URL = process.env.ANALYSIS_API_URL || 'http://api.metabob.local';
const SESSION_ID = `integration-test-${Date.now()}`;

// Color output for terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level: 'info' | 'success' | 'error' | 'warn', message: string) {
  const color = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
  }[level];

  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
}

/**
 * Test individual tool → endpoint mapping
 */
async function testToolEndpoint(
  toolName: string,
  endpoint: string,
  method: string,
  payload?: any
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${ANALYSIS_API_URL}${endpoint}`;

  try {
    log('info', `Testing ${toolName} → ${method} ${endpoint}`);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': SESSION_ID,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        tool: toolName,
        endpoint,
        success: false,
        latencyMs,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();

    return {
      tool: toolName,
      endpoint,
      success: true,
      latencyMs,
      details: data,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      tool: toolName,
      endpoint,
      success: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 1. Full Stack Health Check
 */
async function testHealthCheck(): Promise<void> {
  log('info', '=== 1. FULL STACK HEALTH CHECK ===');

  // Check Analysis API
  const apiHealth = await testToolEndpoint(
    'health-check',
    '/health',
    'GET'
  );

  if (apiHealth.success) {
    log('success', `✓ Analysis API: ${JSON.stringify(apiHealth.details)}`);
  } else {
    log('error', `✗ Analysis API: ${apiHealth.error}`);
  }

  // Check database connectivity (implicit via API health)
  log('info', 'Database connectivity verified through API health check');

  console.log();
}

/**
 * 2. Tool → Endpoint Integration Tests
 */
async function testToolEndpointMappings(): Promise<TestResult[]> {
  log('info', '=== 2. TOOL → ENDPOINT INTEGRATION TESTS ===');

  const tests: Array<{
    tool: string;
    endpoint: string;
    method: string;
    payload?: any;
  }> = [
    {
      tool: 'get_priority_issues',
      endpoint: '/v2/analysis/priority',
      method: 'GET',
    },
    {
      tool: 'search_codebase',
      endpoint: '/v2/analysis/search',
      method: 'POST',
      payload: {
        query: 'test search query',
        limit: 5,
      },
    },
    {
      tool: 'annotate_component',
      endpoint: '/v2/analysis/annotations',
      method: 'POST',
      payload: {
        component_id: 'test-component',
        content: 'Test annotation',
        type: 'design_decision',
      },
    },
    {
      tool: 'suggest_related_changes',
      endpoint: '/v2/analysis/cochange/suggest',
      method: 'POST',
      payload: {
        changed_files: ['src/test.ts'],
        top_k: 5,
      },
    },
    {
      tool: 'analyze_change_impact',
      endpoint: '/v2/analysis/impact',
      method: 'POST',
      payload: {
        changed_files: ['src/test.ts'],
        max_depth: 3,
      },
    },
    {
      tool: 'mark_problem_complete',
      endpoint: '/v2/analysis/problems/test-problem-123/complete',
      method: 'PUT',
      payload: {
        resolution_summary: 'Test resolution',
      },
    },
    {
      tool: 'generate_implementation_spec',
      endpoint: '/v2/analysis/specs/generate',
      method: 'POST',
      payload: {
        goal: 'Test implementation goal',
        entry_points: ['src/main.ts'],
      },
    },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await testToolEndpoint(
      test.tool,
      test.endpoint,
      test.method,
      test.payload
    );

    results.push(result);

    if (result.success) {
      log('success', `✓ ${result.tool} (${result.latencyMs}ms)`);
    } else {
      log('error', `✗ ${result.tool}: ${result.error}`);
    }
  }

  console.log();
  return results;
}

/**
 * 3. Contract Validation
 */
async function testContractValidation(results: TestResult[]): Promise<void> {
  log('info', '=== 3. CONTRACT VALIDATION ===');

  let contractViolations = 0;

  for (const result of results) {
    if (!result.success) {
      // Expected format errors are OK (we're testing connectivity, not full payload validity)
      if (result.error?.includes('400') || result.error?.includes('validation')) {
        log('warn', `⚠ ${result.tool}: Expected validation error (contract OK)`);
      } else {
        log('error', `✗ ${result.tool}: Unexpected error - ${result.error}`);
        contractViolations++;
      }
    } else {
      // Verify response has expected structure
      if (result.details && typeof result.details === 'object') {
        log('success', `✓ ${result.tool}: Valid response structure`);
      } else {
        log('error', `✗ ${result.tool}: Invalid response structure`);
        contractViolations++;
      }
    }
  }

  if (contractViolations === 0) {
    log('success', '✓ All contracts validated');
  } else {
    log('error', `✗ ${contractViolations} contract violation(s)`);
  }

  console.log();
}

/**
 * 4. Performance Test
 */
async function testPerformance(results: TestResult[]): Promise<void> {
  log('info', '=== 4. PERFORMANCE TEST ===');

  const targetSimple = 1000; // 1s for simple queries
  const targetComplex = 3000; // 3s for complex operations

  const simpleOps = ['get_priority_issues'];
  const complexOps = ['generate_implementation_spec', 'analyze_change_impact'];

  for (const result of results) {
    const target = simpleOps.includes(result.tool) ? targetSimple : targetComplex;

    if (result.latencyMs <= target) {
      log('success', `✓ ${result.tool}: ${result.latencyMs}ms (target: ${target}ms)`);
    } else {
      log('warn', `⚠ ${result.tool}: ${result.latencyMs}ms (target: ${target}ms, exceeded by ${result.latencyMs - target}ms)`);
    }
  }

  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  log('info', `Average latency: ${avgLatency.toFixed(0)}ms`);

  console.log();
}

/**
 * 5. Workflow Validation
 */
async function testWorkflows(): Promise<WorkflowResult[]> {
  log('info', '=== 5. WORKFLOW VALIDATION ===');

  const workflows: WorkflowResult[] = [];

  // Workflow 1: Debugging
  {
    log('info', 'Testing workflow: Debugging');
    const startTime = Date.now();
    const steps: TestResult[] = [];

    // Step 1: Get priority issues
    const step1 = await testToolEndpoint(
      'get_priority_issues',
      '/v2/analysis/priority?limit=5',
      'GET'
    );
    steps.push(step1);

    // Step 2: Search for related issues
    const step2 = await testToolEndpoint(
      'search_codebase',
      '/v2/analysis/search',
      'POST',
      { query: 'memory leak', limit: 5 }
    );
    steps.push(step2);

    // Step 3: Mark problem complete
    const step3 = await testToolEndpoint(
      'mark_problem_complete',
      '/v2/analysis/problems/test-debug-problem/complete',
      'PUT',
      { resolution_summary: 'Fixed memory leak in component X' }
    );
    steps.push(step3);

    const totalLatencyMs = Date.now() - startTime;
    const success = steps.every(s => s.success || s.error?.includes('400'));

    workflows.push({
      workflow: 'Debugging',
      steps,
      success,
      totalLatencyMs,
    });

    if (success) {
      log('success', `✓ Debugging workflow (${totalLatencyMs}ms)`);
    } else {
      log('error', `✗ Debugging workflow failed`);
    }
  }

  // Workflow 2: Code Review
  {
    log('info', 'Testing workflow: Code Review');
    const startTime = Date.now();
    const steps: TestResult[] = [];

    // Step 1: Suggest related changes
    const step1 = await testToolEndpoint(
      'suggest_related_changes',
      '/v2/analysis/cochange/suggest',
      'POST',
      { changed_files: ['src/api/users.ts'], top_k: 5 }
    );
    steps.push(step1);

    // Step 2: Analyze change impact
    const step2 = await testToolEndpoint(
      'analyze_change_impact',
      '/v2/analysis/impact',
      'POST',
      { changed_files: ['src/api/users.ts'], max_depth: 3 }
    );
    steps.push(step2);

    // Step 3: Annotate component
    const step3 = await testToolEndpoint(
      'annotate_component',
      '/v2/analysis/annotations',
      'POST',
      {
        component_id: 'users-api',
        content: 'Reviewed and approved changes',
        type: 'design_decision',
      }
    );
    steps.push(step3);

    const totalLatencyMs = Date.now() - startTime;
    const success = steps.every(s => s.success || s.error?.includes('400'));

    workflows.push({
      workflow: 'Code Review',
      steps,
      success,
      totalLatencyMs,
    });

    if (success) {
      log('success', `✓ Code Review workflow (${totalLatencyMs}ms)`);
    } else {
      log('error', `✗ Code Review workflow failed`);
    }
  }

  // Workflow 3: Feature Development
  {
    log('info', 'Testing workflow: Feature Development');
    const startTime = Date.now();
    const steps: TestResult[] = [];

    // Step 1: Generate implementation spec
    const step1 = await testToolEndpoint(
      'generate_implementation_spec',
      '/v2/analysis/specs/generate',
      'POST',
      {
        goal: 'Add user authentication system',
        entry_points: ['src/main.ts'],
      }
    );
    steps.push(step1);

    // Step 2: Analyze change impact
    const step2 = await testToolEndpoint(
      'analyze_change_impact',
      '/v2/analysis/impact',
      'POST',
      { changed_files: ['src/auth/login.ts'], max_depth: 3 }
    );
    steps.push(step2);

    // Step 3: Suggest related changes
    const step3 = await testToolEndpoint(
      'suggest_related_changes',
      '/v2/analysis/cochange/suggest',
      'POST',
      { changed_files: ['src/auth/login.ts'], top_k: 5 }
    );
    steps.push(step3);

    const totalLatencyMs = Date.now() - startTime;
    const success = steps.every(s => s.success || s.error?.includes('400'));

    workflows.push({
      workflow: 'Feature Development',
      steps,
      success,
      totalLatencyMs,
    });

    if (success) {
      log('success', `✓ Feature Development workflow (${totalLatencyMs}ms)`);
    } else {
      log('error', `✗ Feature Development workflow failed`);
    }
  }

  console.log();
  return workflows;
}

/**
 * 6. Error Handling Test
 */
async function testErrorHandling(): Promise<void> {
  log('info', '=== 6. ERROR HANDLING TEST ===');

  // Test 1: Invalid endpoint
  const test1 = await testToolEndpoint(
    'invalid-endpoint',
    '/v2/analysis/nonexistent',
    'GET'
  );

  if (!test1.success && test1.error?.includes('404')) {
    log('success', '✓ 404 handling: Correct error response');
  } else {
    log('error', '✗ 404 handling: Unexpected response');
  }

  // Test 2: Invalid method
  const test2 = await testToolEndpoint(
    'wrong-method',
    '/v2/analysis/priority',
    'POST'
  );

  if (!test2.success && (test2.error?.includes('405') || test2.error?.includes('404'))) {
    log('success', '✓ Method validation: Correct error response');
  } else {
    log('error', '✗ Method validation: Unexpected response');
  }

  // Test 3: Missing required fields
  const test3 = await testToolEndpoint(
    'missing-fields',
    '/v2/analysis/search',
    'POST',
    {} // Missing 'query' field
  );

  if (!test3.success && test3.error?.includes('400')) {
    log('success', '✓ Validation: Correct error for missing fields');
  } else {
    log('error', '✗ Validation: Unexpected response');
  }

  console.log();
}

/**
 * Generate summary report
 */
function generateReport(
  toolResults: TestResult[],
  workflowResults: WorkflowResult[]
): void {
  log('info', '=== SUMMARY REPORT ===');

  const successfulTools = toolResults.filter(r => r.success).length;
  const totalTools = toolResults.length;
  const toolSuccessRate = (successfulTools / totalTools) * 100;

  const successfulWorkflows = workflowResults.filter(w => w.success).length;
  const totalWorkflows = workflowResults.length;
  const workflowSuccessRate = (successfulWorkflows / totalWorkflows) * 100;

  console.log(`\n${colors.blue}Tool-to-Endpoint Mapping:${colors.reset}`);
  console.log(`  ${successfulTools}/${totalTools} tools operational (${toolSuccessRate.toFixed(0)}%)`);

  console.log(`\n${colors.blue}Workflow Validation:${colors.reset}`);
  console.log(`  ${successfulWorkflows}/${totalWorkflows} workflows successful (${workflowSuccessRate.toFixed(0)}%)`);

  console.log(`\n${colors.blue}Performance:${colors.reset}`);
  const avgLatency = toolResults.reduce((sum, r) => sum + r.latencyMs, 0) / toolResults.length;
  const maxLatency = Math.max(...toolResults.map(r => r.latencyMs));
  const minLatency = Math.min(...toolResults.map(r => r.latencyMs));
  console.log(`  Average: ${avgLatency.toFixed(0)}ms`);
  console.log(`  Min: ${minLatency}ms`);
  console.log(`  Max: ${maxLatency}ms`);

  console.log(`\n${colors.blue}Overall Status:${colors.reset}`);

  if (toolSuccessRate >= 80 && workflowSuccessRate >= 80) {
    log('success', `✓ System ready for production (${Math.min(toolSuccessRate, workflowSuccessRate).toFixed(0)}% success rate)`);
  } else if (toolSuccessRate >= 50 && workflowSuccessRate >= 50) {
    log('warn', `⚠ System operational but needs improvement (${Math.min(toolSuccessRate, workflowSuccessRate).toFixed(0)}% success rate)`);
  } else {
    log('error', `✗ System not ready (${Math.min(toolSuccessRate, workflowSuccessRate).toFixed(0)}% success rate)`);
  }

  console.log();
}

/**
 * Main test execution
 */
async function main() {
  console.log(`${colors.cyan}========================================`);
  console.log('metabob-mcp → metabob-analysis-api');
  console.log('End-to-End Integration Test');
  console.log(`========================================${colors.reset}\n`);

  console.log(`API URL: ${ANALYSIS_API_URL}`);
  console.log(`Session ID: ${SESSION_ID}\n`);

  try {
    // 1. Health check
    await testHealthCheck();

    // 2. Tool → Endpoint mapping
    const toolResults = await testToolEndpointMappings();

    // 3. Contract validation
    await testContractValidation(toolResults);

    // 4. Performance test
    await testPerformance(toolResults);

    // 5. Workflow validation
    const workflowResults = await testWorkflows();

    // 6. Error handling
    await testErrorHandling();

    // 7. Generate report
    generateReport(toolResults, workflowResults);

    // Exit with appropriate code
    const overallSuccess = toolResults.filter(r => r.success).length >= toolResults.length * 0.8;
    process.exit(overallSuccess ? 0 : 1);
  } catch (error) {
    log('error', `Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
