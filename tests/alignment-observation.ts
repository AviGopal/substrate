/**
 * Alignment Observation Tests
 *
 * Reusable tests to verify data flow alignment without hardcoded values.
 * Tests check STRUCTURAL properties, not specific values.
 *
 * Usage: bun run tests/alignment-observation.ts
 *
 * Environment:
 *   ACTIVITY_API_URL - Activity API endpoint (default: http://localhost:8080)
 *   DISCOVERY_URL - Discovery vessel endpoint (default: http://localhost:8081)
 *   SURREALDB_URL - SurrealDB endpoint (default: http://localhost:8000)
 *   SURREALDB_USER - SurrealDB user (default: root)
 *   SURREALDB_PASS - SurrealDB password
 *   SURREALDB_NS - SurrealDB namespace (default: activity-system)
 *   SURREALDB_DB - SurrealDB database (default: learning_loop)
 */

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  message: string;
  details?: Record<string, unknown>;
}

interface AlignmentCheck {
  field: string;
  present: boolean;
  validRange?: boolean;
  count?: number;
}

const results: TestResult[] = [];

// Configuration
const config = {
  activityApi: process.env.ACTIVITY_API_URL || 'http://localhost:8080',
  discovery: process.env.DISCOVERY_URL || 'http://localhost:8081',
  surrealdb: {
    url: process.env.SURREALDB_URL || 'http://localhost:8000',
    user: process.env.SURREALDB_USER || 'root',
    pass: process.env.SURREALDB_PASS || '',
    ns: process.env.SURREALDB_NS || 'activity-system',
    db: process.env.SURREALDB_DB || 'learning_loop',
  },
};

// Helper: Execute SurrealDB query
async function queryDB(sql: string): Promise<unknown[]> {
  try {
    const response = await fetch(`${config.surrealdb.url}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'surreal-ns': config.surrealdb.ns,
        'surreal-db': config.surrealdb.db,
        'Authorization': `Basic ${Buffer.from(`${config.surrealdb.user}:${config.surrealdb.pass}`).toString('base64')}`,
      },
      body: sql,
    });

    if (!response.ok) {
      throw new Error(`DB query failed: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('DB query error:', error);
    return [];
  }
}

// Helper: HTTP request
async function httpRequest(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

// =============================================================================
// DATABASE TESTS
// =============================================================================

async function testValidationResultsInTrace(): Promise<TestResult> {
  const sql = `
    SELECT
      COUNT() AS total,
      COUNT(IF execution_trace.tasks[*].validationResults IS NOT NONE THEN 1 END) AS with_validation
    FROM activity_execution_traces
  `;

  const result = await queryDB(sql);
  const row = (result[0] as any)?.result?.[0] || { total: 0, with_validation: 0 };

  const hasData = row.total > 0;
  const hasValidation = row.with_validation > 0;
  const coverage = hasData ? row.with_validation / row.total : 0;

  return {
    name: 'Validation Results in Trace',
    status: hasValidation ? 'PASS' : hasData ? 'PENDING' : 'PENDING',
    message: hasValidation
      ? `${row.with_validation}/${row.total} traces have validationResults (${(coverage * 100).toFixed(1)}%)`
      : hasData
        ? `0/${row.total} traces have validationResults yet`
        : 'No execution traces to check',
    details: { total: row.total, with_validation: row.with_validation, coverage },
  };
}

async function testValidationConfidenceField(): Promise<TestResult> {
  const sql = `
    SELECT
      COUNT() AS total,
      COUNT(IF metadata.validation_confidence IS NOT NONE THEN 1 END) AS with_confidence,
      COUNT(IF metadata.validation_confidence >= 0 AND metadata.validation_confidence <= 1 THEN 1 END) AS valid_range
    FROM activity_execution_traces
  `;

  const result = await queryDB(sql);
  const row = (result[0] as any)?.result?.[0] || { total: 0, with_confidence: 0, valid_range: 0 };

  const hasData = row.total > 0;
  const hasConfidence = row.with_confidence > 0;
  const allValid = row.with_confidence === row.valid_range;

  return {
    name: 'Validation Confidence Field',
    status: hasConfidence && allValid ? 'PASS' : hasConfidence ? 'FAIL' : 'PENDING',
    message: hasConfidence
      ? allValid
        ? `${row.with_confidence} traces have valid confidence values`
        : `${row.valid_range}/${row.with_confidence} confidence values in valid range`
      : 'No validation_confidence field populated yet',
    details: row,
  };
}

async function testThompsonWeightedUpdates(): Promise<TestResult> {
  const sql = `
    SELECT
      activity_id,
      thompson_alpha,
      successful_executions,
      (thompson_alpha - 1.0) / successful_executions AS ratio
    FROM variant_performance_metrics
    WHERE successful_executions > 0
    LIMIT 100
  `;

  const result = await queryDB(sql);
  const rows = (result[0] as any)?.result || [];

  if (rows.length === 0) {
    return {
      name: 'Thompson Weighted Updates',
      status: 'PENDING',
      message: 'No execution data with successful_executions > 0',
      details: { activities_checked: 0 },
    };
  }

  const weightedCount = rows.filter((r: any) => r.ratio !== null && r.ratio < 0.99).length;
  const unweightedCount = rows.filter((r: any) => r.ratio !== null && r.ratio >= 0.99).length;

  return {
    name: 'Thompson Weighted Updates',
    status: weightedCount > 0 ? 'PASS' : 'PENDING',
    message: weightedCount > 0
      ? `${weightedCount} activities have weighted updates (ratio < 1.0)`
      : `All ${unweightedCount} activities have unweighted updates (ratio ≈ 1.0)`,
    details: { weighted: weightedCount, unweighted: unweightedCount, total: rows.length },
  };
}

async function testShapeMatchMetadata(): Promise<TestResult> {
  const sql = `
    SELECT
      COUNT() AS total,
      COUNT(IF metadata.shape_match IS NOT NONE THEN 1 END) AS with_shape_match,
      COUNT(IF metadata.shape_match.shapeMatchScore >= 0 AND metadata.shape_match.shapeMatchScore <= 1 THEN 1 END) AS valid_score
    FROM activity_execution_traces
  `;

  const result = await queryDB(sql);
  const row = (result[0] as any)?.result?.[0] || { total: 0, with_shape_match: 0, valid_score: 0 };

  const hasData = row.total > 0;
  const hasShapeMatch = row.with_shape_match > 0;

  return {
    name: 'Shape Match Metadata',
    status: hasShapeMatch ? 'PASS' : 'PENDING',
    message: hasShapeMatch
      ? `${row.with_shape_match} traces have shape_match, ${row.valid_score} have valid scores`
      : 'No shape_match metadata yet',
    details: row,
  };
}

async function testResolverTierTracking(): Promise<TestResult> {
  const sql = `
    SELECT
      resolver_tier,
      COUNT() AS count
    FROM execution
    WHERE resolver_tier IS NOT NONE
    GROUP BY resolver_tier
  `;

  const result = await queryDB(sql);
  const rows = (result[0] as any)?.result || [];

  if (rows.length === 0) {
    return {
      name: 'Resolver Tier Tracking',
      status: 'PENDING',
      message: 'No executions with resolver_tier recorded',
      details: { tiers: [] },
    };
  }

  const tiers = rows.map((r: any) => ({ tier: r.resolver_tier, count: r.count }));
  const totalExecutions = tiers.reduce((sum: number, t: any) => sum + t.count, 0);

  return {
    name: 'Resolver Tier Tracking',
    status: tiers.length >= 2 ? 'PASS' : 'PENDING',
    message: `${totalExecutions} executions across ${tiers.length} tier(s)`,
    details: { tiers, total: totalExecutions },
  };
}

async function testOrgIdIsolation(): Promise<TestResult> {
  const tables = ['activity_execution_traces', 'execution', 'variant_performance_metrics'];
  const checks: AlignmentCheck[] = [];

  for (const table of tables) {
    const sql = `
      SELECT
        COUNT() AS total,
        COUNT(IF org_id IS NONE THEN 1 END) AS without_org
      FROM ${table}
    `;

    const result = await queryDB(sql);
    const row = (result[0] as any)?.result?.[0] || { total: 0, without_org: 0 };

    checks.push({
      field: table,
      present: row.total > 0,
      validRange: row.without_org === 0,
      count: row.total,
    });
  }

  const hasData = checks.some(c => c.count && c.count > 0);
  const allIsolated = checks.every(c => !c.present || c.validRange);

  return {
    name: 'Org ID Isolation',
    status: allIsolated && hasData ? 'PASS' : hasData ? 'FAIL' : 'PENDING',
    message: allIsolated
      ? 'All records have org_id populated'
      : 'Some records missing org_id',
    details: { tables: checks },
  };
}

// =============================================================================
// DISCOVERY TESTS
// =============================================================================

async function testDiscoveryHealth(): Promise<TestResult> {
  const { ok, status, data } = await httpRequest(`${config.discovery}/health`);

  if (!ok) {
    return {
      name: 'Discovery Health',
      status: 'FAIL',
      message: `Health endpoint failed with status ${status}`,
      details: { status },
    };
  }

  const hasStatus = typeof (data as any)?.status === 'string';
  const hasVesselCount = typeof (data as any)?.vesselCount === 'number';

  return {
    name: 'Discovery Health',
    status: hasStatus ? 'PASS' : 'PENDING',
    message: hasStatus
      ? `Discovery healthy, ${(data as any)?.vesselCount || 0} vessels`
      : 'Health endpoint missing expected fields',
    details: data as Record<string, unknown>,
  };
}

async function testDiscoveryConfidence(): Promise<TestResult> {
  const { ok, data } = await httpRequest(`${config.discovery}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pointer: { type: 'vesselRegistry' } }),
  });

  if (!ok) {
    return {
      name: 'Discovery Confidence',
      status: 'PENDING',
      message: 'Could not query vessel registry',
      details: {},
    };
  }

  const vessels = (data as any)?.content?.vessels || [];

  if (vessels.length === 0) {
    return {
      name: 'Discovery Confidence',
      status: 'PENDING',
      message: 'No vessels registered',
      details: { vessel_count: 0 },
    };
  }

  const confidences = vessels.map((v: any) => v.confidence).filter((c: any) => c !== undefined);
  const uniqueConfidences = [...new Set(confidences)];
  const allOne = uniqueConfidences.length === 1 && uniqueConfidences[0] === 1;

  return {
    name: 'Discovery Confidence',
    status: allOne ? 'PENDING' : 'PASS',
    message: allOne
      ? `All ${vessels.length} vessels have confidence=1.0 (hardcoded)`
      : `Confidence varies across ${vessels.length} vessels`,
    details: { vessel_count: vessels.length, unique_confidences: uniqueConfidences },
  };
}

async function testDiscoveryResolverTier(): Promise<TestResult> {
  const { ok, data } = await httpRequest(`${config.discovery}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pointer: { type: 'vesselRegistry' } }),
  });

  if (!ok) {
    return {
      name: 'Discovery Resolver Tier',
      status: 'PENDING',
      message: 'Could not query vessel registry',
      details: {},
    };
  }

  const vessels = (data as any)?.content?.vessels || [];
  const withResolvers = vessels.filter((v: any) => v.resolvers && v.resolvers.length > 0);

  if (withResolvers.length === 0) {
    return {
      name: 'Discovery Resolver Tier',
      status: 'PENDING',
      message: 'No vessels have resolvers registered',
      details: { vessel_count: vessels.length, with_resolvers: 0 },
    };
  }

  const tiers = withResolvers
    .flatMap((v: any) => v.resolvers.map((r: any) => r.tier))
    .filter((t: any) => t);

  const uniqueTiers = [...new Set(tiers)];

  return {
    name: 'Discovery Resolver Tier',
    status: uniqueTiers.length > 0 ? 'PASS' : 'PENDING',
    message: `${withResolvers.length} vessels with resolvers, tiers: ${uniqueTiers.join(', ') || 'none'}`,
    details: { vessels_with_resolvers: withResolvers.length, tiers: uniqueTiers },
  };
}

async function testDiscoveryAuth(): Promise<TestResult> {
  // Try to register without auth
  const { status } = await httpRequest(`${config.discovery}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vesselId: 'test-no-auth-' + Date.now(),
      endpoint: 'http://test',
      shapes: ['test'],
    }),
  });

  const requiresAuth = status === 401 || status === 403;

  // Clean up if registration succeeded
  if (status === 200 || status === 201) {
    await httpRequest(`${config.discovery}/vessels/test-no-auth-${Date.now()}`, {
      method: 'DELETE',
    });
  }

  return {
    name: 'Discovery Auth',
    status: requiresAuth ? 'PASS' : 'PENDING',
    message: requiresAuth
      ? `Registration requires auth (HTTP ${status})`
      : `Registration succeeded without auth (HTTP ${status})`,
    details: { http_status: status, requires_auth: requiresAuth },
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function runTests() {
  console.log('='.repeat(80));
  console.log('ALIGNMENT OBSERVATION TESTS');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('');
  console.log('Config:');
  console.log(`  Activity API: ${config.activityApi}`);
  console.log(`  Discovery: ${config.discovery}`);
  console.log(`  SurrealDB: ${config.surrealdb.url}`);
  console.log('');

  // Database tests
  console.log('--- DATABASE TESTS ---');
  results.push(await testValidationResultsInTrace());
  results.push(await testValidationConfidenceField());
  results.push(await testThompsonWeightedUpdates());
  results.push(await testShapeMatchMetadata());
  results.push(await testResolverTierTracking());
  results.push(await testOrgIdIsolation());

  // Discovery tests
  console.log('');
  console.log('--- DISCOVERY TESTS ---');
  results.push(await testDiscoveryHealth());
  results.push(await testDiscoveryConfidence());
  results.push(await testDiscoveryResolverTier());
  results.push(await testDiscoveryAuth());

  // Print results
  console.log('');
  console.log('='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));

  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏳';
    console.log(`${icon} ${result.status.padEnd(7)} ${result.name}`);
    console.log(`         ${result.message}`);
  }

  // Summary
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const pending = results.filter(r => r.status === 'PENDING').length;

  console.log('');
  console.log('-'.repeat(80));
  console.log(`SUMMARY: ${pass} PASS, ${fail} FAIL, ${pending} PENDING`);
  console.log('-'.repeat(80));

  // Output JSON for programmatic use
  if (process.env.OUTPUT_JSON === 'true') {
    console.log('');
    console.log('JSON OUTPUT:');
    console.log(JSON.stringify({ results, summary: { pass, fail, pending } }, null, 2));
  }

  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch(console.error);
