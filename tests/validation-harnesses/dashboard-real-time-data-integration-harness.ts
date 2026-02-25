#!/usr/bin/env ts-node

/**
 * Validation Harness: dashboard-real-time-data-integration
 * 
 * This harness validates that the dashboard API server at localhost:8083
 * is running, accessible, and serving real-time data from all backend sources.
 * 
 * Tests:
 * 1. Server process running on port 8083
 * 2. GET /metrics returns valid project metrics
 * 3. GET /problems returns issues with severity breakdown
 * 4. GET /activities returns activity execution list
 * 5. GET /sessions returns active sessions
 * 6. Data freshness (updated within 60 seconds)
 * 7. Backend connectivity status
 */

import * as http from 'http';
import { execSync } from 'child_process';

interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  message?: string;
  error?: string;
}

interface TestCase {
  name: string;
  test: () => Promise<ValidationResult>;
}

// HTTP GET helper
function httpGet(url: string, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Check if port is listening
function isPortListening(port: number): boolean {
  try {
    const output = execSync(`lsof -i :${port}`, { encoding: 'utf8', stdio: 'pipe' });
    return output.includes('LISTEN');
  } catch (err) {
    return false;
  }
}

// Test Cases

async function testServerRunning(): Promise<ValidationResult> {
  const expected = { port: 8083, status: 'listening' };
  try {
    const isListening = isPortListening(8083);
    return {
      pass: isListening,
      actual: { port: 8083, status: isListening ? 'listening' : 'not listening' },
      expected,
      message: isListening
        ? 'Dashboard server is running on port 8083'
        : 'Dashboard server is NOT running on port 8083',
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Failed to check port: ${(err as Error).message}`,
    };
  }
}

async function testHealthEndpoint(): Promise<ValidationResult> {
  const expected = { status: 'ok', service: 'opencode-data-bridge' };
  try {
    const actual = await httpGet('http://localhost:8083/');
    const pass = actual.status === 'ok' && actual.service === 'opencode-data-bridge';
    return {
      pass,
      actual: { status: actual.status, service: actual.service },
      expected,
      message: pass ? 'Health endpoint returns expected response' : 'Health endpoint response invalid',
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Health endpoint unreachable: ${(err as Error).message}`,
    };
  }
}

async function testMetricsEndpoint(): Promise<ValidationResult> {
  const expected = {
    project_metrics: {
      total_issues: 'number',
      critical_issues: 'number',
      files_analyzed: 'number',
      components_found: 'number',
      total_activities: 'number',
    },
    dashboard_health: {
      api_status: 'healthy',
      bridge_status: 'active',
    },
    data_sources: {
      rpc_api: 'connected or unavailable',
      surrealdb: 'connected or unavailable',
      local_files: 'available',
    },
  };

  try {
    const actual = await httpGet('http://localhost:8083/metrics');

    // Validate structure
    const hasProjectMetrics =
      actual.project_metrics &&
      typeof actual.project_metrics.total_issues === 'number' &&
      typeof actual.project_metrics.files_analyzed === 'number' &&
      typeof actual.project_metrics.components_found === 'number' &&
      typeof actual.project_metrics.total_activities === 'number';

    const hasDashboardHealth =
      actual.dashboard_health &&
      actual.dashboard_health.api_status === 'healthy' &&
      actual.dashboard_health.bridge_status === 'active';

    const hasDataSources =
      actual.data_sources &&
      actual.data_sources.local_files === 'available';

    const pass = hasProjectMetrics && hasDashboardHealth && hasDataSources;

    return {
      pass,
      actual: {
        project_metrics: actual.project_metrics,
        dashboard_health: actual.dashboard_health,
        data_sources: actual.data_sources,
      },
      expected,
      message: pass
        ? 'Metrics endpoint returns valid structure with real-time data'
        : 'Metrics endpoint response structure invalid',
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Metrics endpoint failed: ${(err as Error).message}`,
    };
  }
}

async function testProblemsEndpoint(): Promise<ValidationResult> {
  const expected = {
    problems: 'array',
    total_count: 'number',
    summary: {
      critical: 'number',
      high: 'number',
      medium: 'number',
      low: 'number',
    },
    metadata: {
      source: 'backend or cache',
      last_updated: 'ISO timestamp',
    },
  };

  try {
    const actual = await httpGet('http://localhost:8083/problems');

    const hasProblems = Array.isArray(actual.problems);
    const hasTotalCount = typeof actual.total_count === 'number';
    const hasSummary =
      actual.summary &&
      typeof actual.summary.critical === 'number' &&
      typeof actual.summary.high === 'number' &&
      typeof actual.summary.medium === 'number' &&
      typeof actual.summary.low === 'number';
    const hasMetadata =
      actual.metadata &&
      ['backend', 'cache'].includes(actual.metadata.source) &&
      typeof actual.metadata.last_updated === 'string';

    const pass = hasProblems && hasTotalCount && hasSummary && hasMetadata;

    return {
      pass,
      actual: {
        problems_count: actual.problems.length,
        total_count: actual.total_count,
        summary: actual.summary,
        metadata: actual.metadata,
      },
      expected,
      message: pass
        ? 'Problems endpoint returns valid structure with severity breakdown'
        : 'Problems endpoint response structure invalid',
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Problems endpoint failed: ${(err as Error).message}`,
    };
  }
}

async function testActivitiesEndpoint(): Promise<ValidationResult> {
  const expected = {
    activities: 'array',
    total_count: 'number',
    offset: 0,
    limit: 50,
    metadata: {
      last_updated: 'ISO timestamp',
      source: 'surrealdb or local',
    },
  };

  try {
    const actual = await httpGet('http://localhost:8083/activities');

    const hasActivities = Array.isArray(actual.activities);
    const hasTotalCount = typeof actual.total_count === 'number';
    const hasOffset = typeof actual.offset === 'number';
    const hasLimit = typeof actual.limit === 'number';
    const hasMetadata =
      actual.metadata &&
      typeof actual.metadata.last_updated === 'string' &&
      ['surrealdb', 'local'].includes(actual.metadata.source);

    const pass = hasActivities && hasTotalCount && hasOffset && hasLimit && hasMetadata;

    return {
      pass,
      actual: {
        activities_count: actual.activities.length,
        total_count: actual.total_count,
        offset: actual.offset,
        limit: actual.limit,
        metadata: actual.metadata,
      },
      expected,
      message: pass
        ? 'Activities endpoint returns valid paginated list'
        : 'Activities endpoint response structure invalid',
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Activities endpoint failed: ${(err as Error).message}`,
    };
  }
}

async function testSessionsEndpoint(): Promise<ValidationResult> {
  const expected = {
    session: 'string (session token)',
    user: { id: 'string', name: 'string' },
    project: { name: 'string', path: 'string' },
  };

  try {
    const actual = await httpGet('http://localhost:8083/session');

    const hasSession = typeof actual.session === 'string';
    const hasUser = actual.user && typeof actual.user.id === 'string';
    const hasProject = actual.project && typeof actual.project.name === 'string';

    const pass = hasSession && hasUser && hasProject;

    return {
      pass,
      actual: {
        has_session: hasSession,
        user: actual.user,
        project: actual.project,
      },
      expected,
      message: pass
        ? 'Sessions endpoint returns valid session data'
        : 'Sessions endpoint response structure invalid',
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Sessions endpoint failed: ${(err as Error).message}`,
    };
  }
}

async function testDataFreshness(): Promise<ValidationResult> {
  const expected = {
    last_updated: 'within 60 seconds of current time',
  };

  try {
    const metrics = await httpGet('http://localhost:8083/metrics');
    const lastUpdated = new Date(metrics.dashboard_health.last_data_update);
    const now = new Date();
    const ageSeconds = (now.getTime() - lastUpdated.getTime()) / 1000;

    const pass = ageSeconds <= 60;

    return {
      pass,
      actual: {
        last_updated: metrics.dashboard_health.last_data_update,
        age_seconds: Math.round(ageSeconds),
      },
      expected,
      message: pass
        ? `Data is fresh (${Math.round(ageSeconds)}s old)`
        : `Data is stale (${Math.round(ageSeconds)}s old, expected < 60s)`,
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Data freshness check failed: ${(err as Error).message}`,
    };
  }
}

async function testBackendConnectivity(): Promise<ValidationResult> {
  const expected = {
    backend_api_connected: 'true or false',
    surrealdb_connected: 'true or false',
    at_least_one_backend: 'connected',
  };

  try {
    const metrics = await httpGet('http://localhost:8083/metrics');

    const backendConnected = metrics.dashboard_health.backend_api_connected;
    const surrealdbConnected = metrics.dashboard_health.surrealdb_connected;
    const atLeastOne = backendConnected || surrealdbConnected;

    const pass = atLeastOne;

    return {
      pass,
      actual: {
        backend_api_connected: backendConnected,
        surrealdb_connected: surrealdbConnected,
        data_sources: metrics.data_sources,
      },
      expected,
      message: pass
        ? `Backend connectivity verified: rpc-api=${backendConnected}, surrealdb=${surrealdbConnected}`
        : 'No backends connected - dashboard operating in isolated mode',
    };
  } catch (err) {
    return {
      pass: false,
      actual: { error: (err as Error).message },
      expected,
      error: `Backend connectivity check failed: ${(err as Error).message}`,
    };
  }
}

// Main validation runner
export async function runValidation(): Promise<{
  pass: boolean;
  results: Array<{ test: string; result: ValidationResult }>;
  summary: { total: number; passed: number; failed: number };
}> {
  const testCases: TestCase[] = [
    { name: 'Server Running on Port 8083', test: testServerRunning },
    { name: 'Health Endpoint', test: testHealthEndpoint },
    { name: 'Metrics Endpoint', test: testMetricsEndpoint },
    { name: 'Problems Endpoint', test: testProblemsEndpoint },
    { name: 'Activities Endpoint', test: testActivitiesEndpoint },
    { name: 'Sessions Endpoint', test: testSessionsEndpoint },
    { name: 'Data Freshness (< 60s)', test: testDataFreshness },
    { name: 'Backend Connectivity', test: testBackendConnectivity },
  ];

  const results: Array<{ test: string; result: ValidationResult }> = [];

  for (const testCase of testCases) {
    try {
      const result = await testCase.test();
      results.push({ test: testCase.name, result });
    } catch (err) {
      results.push({
        test: testCase.name,
        result: {
          pass: false,
          actual: { error: (err as Error).message },
          expected: {},
          error: `Test execution failed: ${(err as Error).message}`,
        },
      });
    }
  }

  const passed = results.filter((r) => r.result.pass).length;
  const failed = results.length - passed;

  return {
    pass: failed === 0,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
    },
  };
}

// CLI execution
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  console.log('🧪 Running Dashboard Real-Time Data Integration Validation Harness\n');

  runValidation()
    .then((validation) => {
      console.log('📊 Validation Results:\n');
      validation.results.forEach((r) => {
        const icon = r.result.pass ? '✅' : '❌';
        console.log(`${icon} ${r.test}`);
        console.log(`   ${r.result.message || r.result.error || 'No message'}`);
        if (!r.result.pass && r.result.error) {
          console.log(`   Error: ${r.result.error}`);
        }
        console.log('');
      });

      console.log(`\n📈 Summary: ${validation.summary.passed}/${validation.summary.total} tests passed`);

      if (validation.pass) {
        console.log('\n✅ VALIDATION PASSED: Dashboard real-time data integration is working correctly');
        process.exit(0);
      } else {
        console.log('\n❌ VALIDATION FAILED: Some tests did not pass');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('❌ Validation harness failed:', err);
      process.exit(1);
    });
}
