#!/usr/bin/env bun
/**
 * Comprehensive Integration Test: metabob-mcp <-> metabob-analysis-api
 *
 * Tests the complete integration between the MCP server and analysis API:
 * 1. API accessibility (Istio gateway + direct service)
 * 2. MCP server connectivity
 * 3. All 7 MCP tools against live API
 * 4. End-to-end workflows
 * 5. Performance and reliability
 */

import { spawn } from 'child_process';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

// Configuration
const ANALYSIS_API_URL = process.env.ANALYSIS_API_URL || 'http://metabob-analysis-api.activity-system.svc.cluster.local:8080';
const SESSION_ID = 'integration-test-' + Date.now();
const MCP_SERVER_PATH = '/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-mcp/src/index.ts';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const color = level === 'ERROR' ? colors.red : level === 'WARN' ? colors.yellow : level === 'PASS' ? colors.green : colors.cyan;
  console.log(`${color}[${timestamp}] [${level}]${colors.reset} ${message}${data ? ' ' + JSON.stringify(data, null, 2) : ''}`);
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
  const startTime = Date.now();
  log('INFO', `Running test: ${name}`);

  try {
    await testFn();
    const duration = Date.now() - startTime;
    log('PASS', `✓ ${name} (${duration}ms)`);
    return { name, status: 'PASS', duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('ERROR', `✗ ${name} (${duration}ms): ${errorMessage}`);
    return { name, status: 'FAIL', duration, error: errorMessage };
  }
}

// API Accessibility Tests
async function testAPIHealth() {
  const response = await fetch(`${ANALYSIS_API_URL}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }
  const data = await response.json();
  if (data.status !== 'ok') {
    throw new Error(`API status not ok: ${JSON.stringify(data)}`);
  }
}

async function testAPIPriorityEndpoint() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/priority?limit=5`, {
    headers: { 'X-Session-ID': SESSION_ID },
  });
  if (!response.ok) {
    throw new Error(`Priority endpoint failed: ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  if (!data.issues || !Array.isArray(data.issues)) {
    throw new Error(`Invalid response format: ${JSON.stringify(data)}`);
  }
}

async function testAPISearchEndpoint() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
    },
    body: JSON.stringify({ query: 'test', limit: 5 }),
  });
  if (!response.ok) {
    throw new Error(`Search endpoint failed: ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  if (!data.results || !Array.isArray(data.results)) {
    throw new Error(`Invalid response format: ${JSON.stringify(data)}`);
  }
}

// MCP Server Tests
async function callMCPTool(toolName: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const mcpServer = spawn('bun', ['run', MCP_SERVER_PATH], {
      env: {
        ...process.env,
        ANALYSIS_API_URL,
        SESSION_ID,
        LOG_LEVEL: 'error', // Suppress logs for cleaner test output
        HEALTH_PORT: '8081', // Use different port to avoid conflicts
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    mcpServer.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    mcpServer.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    mcpServer.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with code ${code}. stderr: ${stderr}`));
        return;
      }

      try {
        // Parse JSON-RPC responses
        const lines = stdout.split('\n').filter(line => line.trim());
        const responses = lines.map(line => JSON.parse(line));

        // Find the tool call response
        const toolResponse = responses.find(r => r.id === 2);
        if (!toolResponse) {
          reject(new Error(`No response found for tool call. stdout: ${stdout}`));
          return;
        }

        if (toolResponse.error) {
          reject(new Error(`MCP error: ${JSON.stringify(toolResponse.error)}`));
          return;
        }

        resolve(toolResponse.result);
      } catch (error) {
        reject(new Error(`Failed to parse MCP response: ${error}. stdout: ${stdout}`));
      }
    });

    // Send JSON-RPC requests
    // 1. List tools (to ensure server is ready)
    mcpServer.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }) + '\n');

    // 2. Call the tool
    setTimeout(() => {
      mcpServer.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }) + '\n');

      // Close stdin to signal end of input
      mcpServer.stdin.end();
    }, 100);

    // Timeout after 30 seconds
    setTimeout(() => {
      mcpServer.kill();
      reject(new Error(`Tool call timeout after 30s`));
    }, 30000);
  });
}

async function testMCPGetPriorityIssues() {
  const result = await callMCPTool('get_priority_issues', { limit: 5 });
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error(`Invalid MCP response: ${JSON.stringify(result)}`);
  }
  const data = JSON.parse(result.content[0].text);
  if (!data.issues || !Array.isArray(data.issues)) {
    throw new Error(`Invalid tool response: ${JSON.stringify(data)}`);
  }
}

async function testMCPSearchCodebase() {
  const result = await callMCPTool('search_codebase', {
    query: 'authentication',
    limit: 5,
  });
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error(`Invalid MCP response: ${JSON.stringify(result)}`);
  }
  const data = JSON.parse(result.content[0].text);
  if (!data.results || !Array.isArray(data.results)) {
    throw new Error(`Invalid tool response: ${JSON.stringify(data)}`);
  }
}

async function testMCPAnnotateComponent() {
  const result = await callMCPTool('annotate_component', {
    component_id: 'src/test.ts::function::test::1',
    content: 'Integration test annotation',
    type: 'implementation_note',
    tags: ['test'],
  });
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error(`Invalid MCP response: ${JSON.stringify(result)}`);
  }
  const data = JSON.parse(result.content[0].text);
  if (!data.id) {
    throw new Error(`Invalid annotation response: ${JSON.stringify(data)}`);
  }
}

async function testMCPSuggestRelatedChanges() {
  const result = await callMCPTool('suggest_related_changes', {
    changed_files: ['src/auth.ts'],
    limit: 5,
  });
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error(`Invalid MCP response: ${JSON.stringify(result)}`);
  }
  const data = JSON.parse(result.content[0].text);
  if (!data.suggestions || !Array.isArray(data.suggestions)) {
    throw new Error(`Invalid suggestions response: ${JSON.stringify(data)}`);
  }
}

async function testMCPAnalyzeChangeImpact() {
  const result = await callMCPTool('analyze_change_impact', {
    changed_files: ['src/auth.ts'],
    direction: 'both',
    max_depth: 3,
  });
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error(`Invalid MCP response: ${JSON.stringify(result)}`);
  }
  const data = JSON.parse(result.content[0].text);
  if (!data.impact) {
    throw new Error(`Invalid impact response: ${JSON.stringify(data)}`);
  }
}

async function testMCPMarkProblemComplete() {
  const result = await callMCPTool('mark_problem_complete', {
    problem_id: 'problem:test123',
    resolution_summary: 'Fixed during integration test',
    fixed_in_commit: 'test-commit',
  });
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error(`Invalid MCP response: ${JSON.stringify(result)}`);
  }
  const data = JSON.parse(result.content[0].text);
  if (!data.problem_id) {
    throw new Error(`Invalid completion response: ${JSON.stringify(data)}`);
  }
}

async function testMCPGenerateImplementationSpec() {
  const result = await callMCPTool('generate_implementation_spec', {
    goal: 'Add user authentication',
    entry_points: ['src/api/server.ts'],
  });
  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error(`Invalid MCP response: ${JSON.stringify(result)}`);
  }
  const data = JSON.parse(result.content[0].text);
  if (!data.specification) {
    throw new Error(`Invalid spec response: ${JSON.stringify(data)}`);
  }
}

// End-to-End Workflow Tests
async function testE2EWorkflow() {
  log('INFO', 'Testing end-to-end workflow: priority issues → annotate → mark complete');

  // 1. Get priority issues
  const priorityResult = await callMCPTool('get_priority_issues', { limit: 1 });
  const priorityData = JSON.parse(priorityResult.content[0].text);
  if (priorityData.issues.length === 0) {
    log('WARN', 'No priority issues found, skipping workflow test');
    return;
  }

  const issue = priorityData.issues[0];
  log('INFO', `Found issue: ${issue.id}`);

  // 2. Annotate the component
  const annotateResult = await callMCPTool('annotate_component', {
    component_id: issue.component_id,
    content: 'Working on this issue',
    type: 'implementation_note',
    link_to_problem_id: issue.id,
  });
  const annotateData = JSON.parse(annotateResult.content[0].text);
  log('INFO', `Created annotation: ${annotateData.id}`);

  // 3. Mark problem complete
  const completeResult = await callMCPTool('mark_problem_complete', {
    problem_id: issue.id,
    resolution_summary: 'Fixed during E2E test',
  });
  const completeData = JSON.parse(completeResult.content[0].text);
  log('INFO', `Marked complete: ${completeData.problem_id}`);
}

// Performance Tests
async function testPerformance() {
  const iterations = 5;
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await callMCPTool('get_priority_issues', { limit: 5 });
    durations.push(Date.now() - start);
  }

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);

  log('INFO', `Performance test: avg=${avgDuration.toFixed(0)}ms, max=${maxDuration}ms`);

  if (avgDuration > 5000) {
    throw new Error(`Average response time too high: ${avgDuration}ms`);
  }
}

// Main test runner
async function main() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════════╗
║  MCP Integration Test Suite                                   ║
║  metabob-mcp <-> metabob-analysis-api                        ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  log('INFO', 'Configuration', {
    ANALYSIS_API_URL,
    SESSION_ID,
    MCP_SERVER_PATH,
  });

  console.log(`\n${colors.bright}=== Phase 1: API Accessibility ===${colors.reset}\n`);
  results.push(await runTest('API Health Check', testAPIHealth));
  results.push(await runTest('API Priority Endpoint', testAPIPriorityEndpoint));
  results.push(await runTest('API Search Endpoint', testAPISearchEndpoint));

  console.log(`\n${colors.bright}=== Phase 2: MCP Tool Tests ===${colors.reset}\n`);
  results.push(await runTest('MCP Tool: get_priority_issues', testMCPGetPriorityIssues));
  results.push(await runTest('MCP Tool: search_codebase', testMCPSearchCodebase));
  results.push(await runTest('MCP Tool: annotate_component', testMCPAnnotateComponent));
  results.push(await runTest('MCP Tool: suggest_related_changes', testMCPSuggestRelatedChanges));
  results.push(await runTest('MCP Tool: analyze_change_impact', testMCPAnalyzeChangeImpact));
  results.push(await runTest('MCP Tool: mark_problem_complete', testMCPMarkProblemComplete));
  results.push(await runTest('MCP Tool: generate_implementation_spec', testMCPGenerateImplementationSpec));

  console.log(`\n${colors.bright}=== Phase 3: End-to-End Workflows ===${colors.reset}\n`);
  results.push(await runTest('E2E Workflow: Priority → Annotate → Complete', testE2EWorkflow));

  console.log(`\n${colors.bright}=== Phase 4: Performance & Reliability ===${colors.reset}\n`);
  results.push(await runTest('Performance Test', testPerformance));

  // Summary
  console.log(`\n${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════════╗
║  Test Summary                                                  ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log(`${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ${colors.red}✗${colors.reset} ${r.name}: ${r.error}`);
    });
    console.log('');
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  log('ERROR', 'Test suite failed', { error: error.message });
  process.exit(1);
});
