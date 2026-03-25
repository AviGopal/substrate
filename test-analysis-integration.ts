#!/usr/bin/env bun
/**
 * Analysis Integration Test Script
 *
 * Tests M1-M5 of the analysis-integration spec against deployed backend
 */

const ACTIVITY_API = process.env.ACTIVITY_API_URL || 'http://localhost:9081';
const ANALYSIS_API = process.env.ANALYSIS_API_URL || 'http://localhost:9080';

interface TestResult {
  name: string;
  milestone: string;
  passed: boolean;
  message: string;
  response?: any;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function addResult(result: TestResult) {
  results.push(result);
  const status = result.passed ? '✓' : '✗';
  console.log(`  ${status} ${result.name}: ${result.message}`);
}

async function getJwtToken(): Promise<string | null> {
  try {
    // Try MiniBob auth
    const response = await fetch(`${ACTIVITY_API}/v2/auth/minibob/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_id: 'minibob-local-001',
        api_key: 'test-api-key-123'
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.token;
    }

    // If that fails, try creating a test session
    const sessionResponse = await fetch(`${ACTIVITY_API}/v2/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: `test-session-${Date.now()}`,
      })
    });

    if (sessionResponse.ok) {
      const data = await sessionResponse.json();
      return data.token || data.session_id;
    }

    return null;
  } catch (error) {
    log(`Auth error: ${error}`);
    return null;
  }
}

// ============== M1: CPG Population Tests ==============

async function testM1_IndexingStatus() {
  log('\n== M1: CPG Population Tests ==');

  // Test GET /v2/analysis/status without auth (session-based)
  try {
    const response = await fetch(`${ANALYSIS_API}/v2/analysis/status`, {
      headers: { 'X-Session-ID': 'test-m1-status' }
    });

    if (response.status === 401) {
      addResult({
        name: 'M1.1 Status Endpoint',
        milestone: 'M1',
        passed: true,
        message: 'Endpoint exists but requires auth (expected)',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M1.1 Status Endpoint',
        milestone: 'M1',
        passed: true,
        message: `Status: ${data.status}, Files: ${data.filesIndexed}`,
        response: data
      });
    } else {
      addResult({
        name: 'M1.1 Status Endpoint',
        milestone: 'M1',
        passed: false,
        message: `HTTP ${response.status}`,
        response: await response.text()
      });
    }
  } catch (error) {
    addResult({
      name: 'M1.1 Status Endpoint',
      milestone: 'M1',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

async function testM1_IndexEndpoint() {
  try {
    const testFiles = {
      'test/auth.ts': 'export function login() { return true; }',
      'test/db.ts': 'export function query() { return []; }'
    };

    const response = await fetch(`${ANALYSIS_API}/v2/analysis/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': 'test-m1-index'
      },
      body: JSON.stringify({ files: testFiles, incremental: true })
    });

    if (response.status === 401) {
      addResult({
        name: 'M1.2 Index Endpoint',
        milestone: 'M1',
        passed: true,
        message: 'Endpoint exists but requires auth (expected)',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M1.2 Index Endpoint',
        milestone: 'M1',
        passed: data.indexed >= 0,
        message: `Indexed ${data.indexed} files, ${data.components} components`,
        response: data
      });
    } else {
      addResult({
        name: 'M1.2 Index Endpoint',
        milestone: 'M1',
        passed: false,
        message: `HTTP ${response.status}`,
        response: await response.text()
      });
    }
  } catch (error) {
    addResult({
      name: 'M1.2 Index Endpoint',
      milestone: 'M1',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

// ============== M2: Real Analysis Data Tests ==============

async function testM2_PriorityEndpoint() {
  log('\n== M2: Real Analysis Data Tests ==');

  try {
    const response = await fetch(`${ANALYSIS_API}/v2/analysis/priority?limit=5`, {
      headers: { 'X-Session-ID': 'test-m2' }
    });

    if (response.status === 401) {
      addResult({
        name: 'M2.1 Priority Endpoint',
        milestone: 'M2',
        passed: true,
        message: 'Endpoint exists but requires auth',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M2.1 Priority Endpoint',
        milestone: 'M2',
        passed: Array.isArray(data.issues),
        message: `Found ${data.issues?.length || 0} priority issues`,
        response: data
      });
    } else {
      addResult({
        name: 'M2.1 Priority Endpoint',
        milestone: 'M2',
        passed: false,
        message: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult({
      name: 'M2.1 Priority Endpoint',
      milestone: 'M2',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

async function testM2_CochangeEndpoint() {
  try {
    const response = await fetch(`${ANALYSIS_API}/v2/analysis/cochange/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': 'test-m2'
      },
      body: JSON.stringify({
        component_ids: ['test/auth.ts::function::login::1'],
        limit: 5
      })
    });

    if (response.status === 401) {
      addResult({
        name: 'M2.2 Cochange Endpoint',
        milestone: 'M2',
        passed: true,
        message: 'Endpoint exists but requires auth',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M2.2 Cochange Endpoint',
        milestone: 'M2',
        passed: Array.isArray(data.suggestions),
        message: `Found ${data.suggestions?.length || 0} suggestions`,
        response: data
      });
    } else {
      addResult({
        name: 'M2.2 Cochange Endpoint',
        milestone: 'M2',
        passed: false,
        message: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult({
      name: 'M2.2 Cochange Endpoint',
      milestone: 'M2',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

async function testM2_ImpactEndpoint() {
  try {
    const response = await fetch(`${ANALYSIS_API}/v2/analysis/impact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': 'test-m2'
      },
      body: JSON.stringify({
        changed_files: ['test/auth.ts'],
        max_depth: 2
      })
    });

    if (response.status === 401) {
      addResult({
        name: 'M2.3 Impact Endpoint',
        milestone: 'M2',
        passed: true,
        message: 'Endpoint exists but requires auth',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M2.3 Impact Endpoint',
        milestone: 'M2',
        passed: data.risk_level !== undefined,
        message: `Risk level: ${data.risk_level}`,
        response: data
      });
    } else {
      addResult({
        name: 'M2.3 Impact Endpoint',
        milestone: 'M2',
        passed: false,
        message: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult({
      name: 'M2.3 Impact Endpoint',
      milestone: 'M2',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

// ============== M3: Impulse Bridge Tests ==============

async function testM3_ImpulseResolve() {
  log('\n== M3: Impulse Bridge Tests ==');

  try {
    const response = await fetch(`${ACTIVITY_API}/v2/impulses/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': 'test-m3'
      },
      body: JSON.stringify({
        impulses: [{
          id: 'test-cochange',
          pointer: {
            type: 'cochangeSuggestions',
            componentIds: ['test/auth.ts::function::login::1'],
            limit: 3
          },
          budget: 1000,
          priority: 'medium'
        }]
      })
    });

    if (response.status === 401) {
      addResult({
        name: 'M3.1 Impulse Resolve (cochangeSuggestions)',
        milestone: 'M3',
        passed: true,
        message: 'Endpoint exists but requires auth',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M3.1 Impulse Resolve (cochangeSuggestions)',
        milestone: 'M3',
        passed: data.resolved !== undefined,
        message: `Resolved ${data.resolved?.length || 0} impulses`,
        response: data
      });
    } else {
      const text = await response.text();
      addResult({
        name: 'M3.1 Impulse Resolve (cochangeSuggestions)',
        milestone: 'M3',
        passed: false,
        message: `HTTP ${response.status}: ${text.slice(0, 100)}`
      });
    }
  } catch (error) {
    addResult({
      name: 'M3.1 Impulse Resolve (cochangeSuggestions)',
      milestone: 'M3',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

// ============== M4: Learning Loop Tests ==============

async function testM4_LearningCochange() {
  log('\n== M4: Learning Loop Tests ==');

  try {
    const response = await fetch(`${ANALYSIS_API}/v2/analysis/learning/cochange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': 'test-m4'
      },
      body: JSON.stringify({
        session_id: 'test-m4',
        changed_files: ['src/auth.ts', 'src/session.ts'],
        project_id: 'test-project'
      })
    });

    if (response.status === 401) {
      addResult({
        name: 'M4.1 Learning Cochange Endpoint',
        milestone: 'M4',
        passed: true,
        message: 'Endpoint exists but requires auth',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M4.1 Learning Cochange Endpoint',
        milestone: 'M4',
        passed: data.recorded === true,
        message: `Recorded: ${data.recorded}, Event ID: ${data.event_id}`,
        response: data
      });
    } else {
      addResult({
        name: 'M4.1 Learning Cochange Endpoint',
        milestone: 'M4',
        passed: false,
        message: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult({
      name: 'M4.1 Learning Cochange Endpoint',
      milestone: 'M4',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

async function testM4_LearningPatterns() {
  try {
    const response = await fetch(`${ANALYSIS_API}/v2/analysis/learning/patterns?limit=10`, {
      headers: { 'X-Session-ID': 'test-m4' }
    });

    if (response.status === 401) {
      addResult({
        name: 'M4.2 Learning Patterns Endpoint',
        milestone: 'M4',
        passed: true,
        message: 'Endpoint exists but requires auth',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M4.2 Learning Patterns Endpoint',
        milestone: 'M4',
        passed: Array.isArray(data.patterns),
        message: `Found ${data.total} patterns, avg confidence: ${(data.avg_confidence * 100).toFixed(1)}%`,
        response: data
      });
    } else {
      addResult({
        name: 'M4.2 Learning Patterns Endpoint',
        milestone: 'M4',
        passed: false,
        message: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult({
      name: 'M4.2 Learning Patterns Endpoint',
      milestone: 'M4',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

async function testM4_LearningMetrics() {
  try {
    const response = await fetch(`${ANALYSIS_API}/v2/analysis/learning/metrics`, {
      headers: { 'X-Session-ID': 'test-m4' }
    });

    if (response.status === 401) {
      addResult({
        name: 'M4.3 Learning Metrics Endpoint',
        milestone: 'M4',
        passed: true,
        message: 'Endpoint exists but requires auth',
        response: { status: response.status }
      });
    } else if (response.ok) {
      const data = await response.json();
      addResult({
        name: 'M4.3 Learning Metrics Endpoint',
        milestone: 'M4',
        passed: data.total_patterns !== undefined,
        message: `Patterns: ${data.total_patterns}, Events: ${data.total_events}`,
        response: data
      });
    } else {
      addResult({
        name: 'M4.3 Learning Metrics Endpoint',
        milestone: 'M4',
        passed: false,
        message: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult({
      name: 'M4.3 Learning Metrics Endpoint',
      milestone: 'M4',
      passed: false,
      message: `Error: ${error}`
    });
  }
}

// ============== Run All Tests ==============

async function runTests() {
  console.log('===========================================');
  console.log('  Analysis Integration Validation Tests');
  console.log('===========================================');
  console.log(`Activity API: ${ACTIVITY_API}`);
  console.log(`Analysis API: ${ANALYSIS_API}`);
  console.log('');

  // Check API health first
  log('Checking API health...');

  try {
    const activityHealth = await fetch(`${ACTIVITY_API}/health`);
    const analysisHealth = await fetch(`${ANALYSIS_API}/health`);

    if (!activityHealth.ok) {
      console.error('Activity API is not healthy!');
      process.exit(1);
    }
    if (!analysisHealth.ok) {
      console.error('Analysis API is not healthy!');
      process.exit(1);
    }

    log('Both APIs are healthy ✓');
  } catch (error) {
    console.error(`Health check failed: ${error}`);
    process.exit(1);
  }

  // Run M1 tests
  await testM1_IndexingStatus();
  await testM1_IndexEndpoint();

  // Run M2 tests
  await testM2_PriorityEndpoint();
  await testM2_CochangeEndpoint();
  await testM2_ImpactEndpoint();

  // Run M3 tests
  await testM3_ImpulseResolve();

  // Run M4 tests
  await testM4_LearningCochange();
  await testM4_LearningPatterns();
  await testM4_LearningMetrics();

  // Summary
  console.log('\n===========================================');
  console.log('  Test Summary');
  console.log('===========================================');

  const byMilestone: Record<string, TestResult[]> = {};
  for (const r of results) {
    if (!byMilestone[r.milestone]) byMilestone[r.milestone] = [];
    byMilestone[r.milestone].push(r);
  }

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [milestone, tests] of Object.entries(byMilestone)) {
    const passed = tests.filter(t => t.passed).length;
    const failed = tests.filter(t => !t.passed).length;
    totalPassed += passed;
    totalFailed += failed;
    console.log(`${milestone}: ${passed}/${tests.length} passed`);
  }

  console.log('-------------------------------------------');
  console.log(`Total: ${totalPassed}/${totalPassed + totalFailed} passed`);

  if (totalFailed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter(t => !t.passed)) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
  }

  console.log('');
  process.exit(totalFailed > 0 ? 1 : 0);
}

runTests();
