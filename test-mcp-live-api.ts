#!/usr/bin/env bun
/**
 * Direct API Integration Test
 * Tests metabob-analysis-api endpoints directly without MCP layer
 */

const ANALYSIS_API_URL = 'http://localhost:8081';
const SESSION_ID = 'live-integration-test-' + Date.now();

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

// Colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bright: '\x1b[1m',
};

function log(level: string, message: string) {
  const color = level === 'PASS' ? colors.green : level === 'FAIL' ? colors.red : colors.blue;
  console.log(`${color}[${level}]${colors.reset} ${message}`);
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    log('PASS', `✓ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration, error: errorMessage });
    log('FAIL', `✗ ${name} (${duration}ms): ${errorMessage}`);
  }
}

// Test 1: Health Check
async function testHealth() {
  const response = await fetch(`${ANALYSIS_API_URL}/health`);
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (data.status !== 'ok') throw new Error(`Status not ok: ${JSON.stringify(data)}`);
}

// Test 2: Priority Issues
async function testPriorityIssues() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/priority?limit=10`, {
    headers: { 'X-Session-ID': SESSION_ID },
  });
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data.issues || !Array.isArray(data.issues)) {
    throw new Error(`Invalid response: ${JSON.stringify(data)}`);
  }
  console.log(`    Found ${data.issues.length} priority issues`);
}

// Test 3: Search
async function testSearch() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
    },
    body: JSON.stringify({
      query: 'security vulnerabilities',
      limit: 5,
    }),
  });
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data.results || !Array.isArray(data.results)) {
    throw new Error(`Invalid response: ${JSON.stringify(data)}`);
  }
  console.log(`    Found ${data.results.length} search results (query time: ${data.query_time_ms}ms)`);
}

// Test 4: Create Annotation
async function testAnnotation() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/annotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
    },
    body: JSON.stringify({
      component_id: 'src/test.ts::function::testFunc::1',
      text: 'Integration test annotation',
      type: 'implementation_note',
      tags: ['test'],
    }),
  });
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data.annotation_id) {
    throw new Error(`No annotation ID returned: ${JSON.stringify(data)}`);
  }
  console.log(`    Created annotation: ${data.annotation_id}`);
}

// Test 5: Co-change Suggestions
async function testCoChangeSuggest() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/cochange/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
    },
    body: JSON.stringify({
      changed_files: ['src/auth/login.ts'],
      limit: 5,
    }),
  });
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data.suggestions || !Array.isArray(data.suggestions)) {
    throw new Error(`Invalid response: ${JSON.stringify(data)}`);
  }
  console.log(`    Found ${data.suggestions.length} co-change suggestions`);
}

// Test 6: Impact Analysis
async function testImpactAnalysis() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/impact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
    },
    body: JSON.stringify({
      changed_files: ['src/auth/login.ts'],
      direction: 'both',
      max_depth: 5,
    }),
  });
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data.analysis) {
    throw new Error(`No analysis returned: ${JSON.stringify(data)}`);
  }
  console.log(`    Impact analysis: ${data.analysis.direct_dependencies?.length || 0} direct deps`);
}

// Test 7: Mark Problem Complete
async function testMarkComplete() {
  // First get a problem to mark complete
  const priorityResponse = await fetch(`${ANALYSIS_API_URL}/v2/analysis/priority?limit=1`, {
    headers: { 'X-Session-ID': SESSION_ID },
  });
  const priorityData = await priorityResponse.json();

  if (priorityData.issues.length === 0) {
    console.log('    No issues to mark complete, skipping');
    return;
  }

  const problemId = priorityData.issues[0].id;

  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/problems/${problemId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
    },
    body: JSON.stringify({
      resolution_summary: 'Fixed during integration test',
      fixed_in_commit: 'test-commit',
    }),
  });
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data.problem_id) {
    throw new Error(`No problem_id returned: ${JSON.stringify(data)}`);
  }
  console.log(`    Marked ${data.problem_id} as complete`);
}

// Test 8: Generate Implementation Spec
async function testGenerateSpec() {
  const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/implementation-spec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': SESSION_ID,
    },
    body: JSON.stringify({
      goal: 'Add user authentication with JWT',
      entry_points: ['src/api/server.ts'],
    }),
  });
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data.specification) {
    throw new Error(`No specification returned: ${JSON.stringify(data)}`);
  }
  console.log(`    Generated spec with ${data.specification.steps?.length || 0} steps`);
}

// Performance Test
async function testPerformance() {
  const iterations = 10;
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const response = await fetch(`${ANALYSIS_API_URL}/v2/analysis/priority?limit=5`, {
      headers: { 'X-Session-ID': SESSION_ID },
    });
    if (!response.ok) throw new Error(`Request ${i + 1} failed: ${response.status}`);
    await response.json();
    durations.push(Date.now() - start);
  }

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const max = Math.max(...durations);
  const min = Math.min(...durations);

  console.log(`    ${iterations} requests: avg=${avg.toFixed(0)}ms, min=${min}ms, max=${max}ms`);

  if (avg > 5000) {
    throw new Error(`Average response time too high: ${avg}ms`);
  }
}

async function main() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════════╗
║  Direct API Integration Test                                  ║
║  metabob-analysis-api (Live API)                              ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`\nAPI URL: ${ANALYSIS_API_URL}`);
  console.log(`Session ID: ${SESSION_ID}\n`);

  console.log(`${colors.bright}=== API Endpoint Tests ===${colors.reset}\n`);

  await runTest('1. Health Check', testHealth);
  await runTest('2. Get Priority Issues', testPriorityIssues);
  await runTest('3. Search Codebase', testSearch);
  await runTest('4. Create Annotation', testAnnotation);
  await runTest('5. Co-change Suggestions', testCoChangeSuggest);
  await runTest('6. Impact Analysis', testImpactAnalysis);
  await runTest('7. Mark Problem Complete', testMarkComplete);
  await runTest('8. Generate Implementation Spec', testGenerateSpec);

  console.log(`\n${colors.bright}=== Performance Test ===${colors.reset}\n`);
  await runTest('9. Performance (10 requests)', testPerformance);

  // Summary
  console.log(`\n${colors.bright}${colors.blue}
╔════════════════════════════════════════════════════════════════╗
║  Test Summary                                                  ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log(`${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${colors.red}✗${colors.reset} ${r.name}: ${r.error}`);
    });
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error.message);
  process.exit(1);
});
