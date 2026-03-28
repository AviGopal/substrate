#!/usr/bin/env bun
/**
 * Test the instrumentation flow end-to-end:
 * 1. Create traced functions
 * 2. Execute them
 * 3. Verify traces appear in the backend
 * 4. Use ribosome to extract a template from the traces
 */

import { traced, createTracer, getActiveTraceCount } from '../repos/minibob/src/tracer/index.js';

const API_URL = process.env.API_URL || 'http://activity.metabob.local';
const MINIBOB_INSTANCE_ID = process.env.MINIBOB_INSTANCE_ID || 'minibob-local-001';
const MINIBOB_API_KEY = process.env.MINIBOB_API_KEY || 'test-api-key-123';

let authToken: string | null = null;

// ============================================================================
// Step 1: Authenticate
// ============================================================================
async function authenticate(): Promise<boolean> {
  const response = await fetch(`${API_URL}/v2/auth/minibob/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: MINIBOB_INSTANCE_ID,
      api_key: MINIBOB_API_KEY,
    }),
  });

  if (!response.ok) {
    console.error(`Authentication failed: ${await response.text()}`);
    return false;
  }

  const data = await response.json() as { token: string; org_id: string };
  authToken = data.token;

  // Set env var for tracer
  process.env.MCP_ENDPOINT = API_URL;
  process.env.MINIBOB_AUTH_TOKEN = authToken;

  console.log(`✓ Authenticated as ${data.org_id}`);
  return true;
}

// ============================================================================
// Step 2: Define some functions to trace
// ============================================================================

// A simple data processing function
async function processData(input: { values: number[] }): Promise<{ sum: number; avg: number; count: number }> {
  const sum = input.values.reduce((a, b) => a + b, 0);
  const avg = sum / input.values.length;
  return { sum, avg, count: input.values.length };
}

// A function that calls another function
async function analyzeDataset(name: string, data: number[]): Promise<{ name: string; stats: any }> {
  const stats = await processData({ values: data });
  return { name, stats };
}

// A function that might fail
async function validateInput(input: unknown): Promise<boolean> {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input: expected object');
  }
  if (!('values' in input) || !Array.isArray((input as any).values)) {
    throw new Error('Invalid input: expected values array');
  }
  return true;
}

// A function that does multiple steps
async function fullPipeline(datasetName: string, rawData: number[]): Promise<any> {
  // Step 1: Validate
  await validateInput({ values: rawData });

  // Step 2: Analyze
  const result = await analyzeDataset(datasetName, rawData);

  // Step 3: Format output
  return {
    ...result,
    timestamp: new Date().toISOString(),
    status: 'complete',
  };
}

// ============================================================================
// Step 3: Create traced versions with input shapes for goal-aware learning
// ============================================================================

// Shape-conditioned tracing: different input shapes enable the system
// to learn which activities work best for different goal types
const tracer = createTracer({ prefix: 'test-instrumentation', sync: true });

// Data processing: works with structured data inputs
const tracedProcessData = tracer.trace(processData, 'processData', {
  inputShapes: ['structured_data'],
  outputShapes: ['analysis_result'],
});

// Dataset analysis: combines data with a name/goal
const tracedAnalyzeDataset = tracer.trace(analyzeDataset, 'analyzeDataset', {
  inputShapes: ['goal', 'structured_data'],
  outputShapes: ['analysis_result'],
});

// Validation: works with arbitrary input
const tracedValidateInput = tracer.trace(validateInput, 'validateInput', {
  inputShapes: ['input_data'],
  outputShapes: ['validation_result'],
});

// Full pipeline: orchestrates multiple steps
const tracedFullPipeline = tracer.trace(fullPipeline, 'fullPipeline', {
  inputShapes: ['goal', 'structured_data'],
  outputShapes: ['analysis_result', 'validation_result'],
});

// ============================================================================
// Step 4: Execute and generate traces
// ============================================================================

async function runTracedExecutions(): Promise<string[]> {
  const executionIds: string[] = [];

  console.log('\n📊 Running traced executions...\n');

  // Execution 1: Simple data processing
  console.log('  1. Processing data [1, 2, 3, 4, 5]...');
  const result1 = await tracedProcessData({ values: [1, 2, 3, 4, 5] });
  console.log(`     Result: sum=${result1.sum}, avg=${result1.avg}`);

  // Execution 2: Full dataset analysis
  console.log('  2. Analyzing dataset "test-data"...');
  const result2 = await tracedAnalyzeDataset('test-data', [10, 20, 30, 40, 50]);
  console.log(`     Result: ${result2.name} stats: sum=${result2.stats.sum}`);

  // Execution 3: Validation success
  console.log('  3. Validating valid input...');
  const result3 = await tracedValidateInput({ values: [1, 2, 3] });
  console.log(`     Result: valid=${result3}`);

  // Execution 4: Validation failure
  console.log('  4. Validating invalid input (expected failure)...');
  try {
    await tracedValidateInput('not an object');
  } catch (e: any) {
    console.log(`     Expected error: ${e.message}`);
  }

  // Execution 5: Full pipeline
  console.log('  5. Running full pipeline...');
  const result5 = await tracedFullPipeline('production-data', [100, 200, 300]);
  console.log(`     Result: ${result5.name} status=${result5.status}`);

  // Wait for async trace uploads
  console.log('\n  Waiting for traces to upload...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  return executionIds;
}

// ============================================================================
// Step 5: Verify traces in backend
// ============================================================================

async function verifyTraces(): Promise<any[]> {
  console.log('\n📋 Verifying traces in backend...\n');

  const response = await fetch(
    `${API_URL}/v2/activities/execution-traces?limit=20`,
    {
      headers: { 'Authorization': `Bearer ${authToken}` },
    }
  );

  if (!response.ok) {
    console.error(`Failed to fetch traces: ${response.status}`);
    return [];
  }

  const data = await response.json() as { executions: any[] };

  // Filter to our test traces
  const testTraces = data.executions.filter(
    (t: any) => t.variant_id?.startsWith('test-instrumentation-')
  );

  console.log(`  Found ${testTraces.length} test-instrumentation traces:`);

  for (const trace of testTraces) {
    const status = trace.success ? '✓' : '✗';
    console.log(`    ${status} ${trace.variant_id} (${trace.duration_ms}ms)`);
  }

  // Analyze patterns
  const activities = new Map<string, { success: number; fail: number; totalMs: number }>();
  for (const trace of testTraces) {
    const actId = trace.variant_id;
    if (!activities.has(actId)) {
      activities.set(actId, { success: 0, fail: 0, totalMs: 0 });
    }
    const stats = activities.get(actId)!;
    if (trace.success) stats.success++;
    else stats.fail++;
    stats.totalMs += trace.duration_ms || 0;
  }

  console.log('\n  Activity Summary:');
  for (const [actId, stats] of activities) {
    const successRate = stats.success / (stats.success + stats.fail) * 100;
    const avgMs = stats.totalMs / (stats.success + stats.fail);
    console.log(`    ${actId}: ${successRate.toFixed(0)}% success, ${avgMs.toFixed(0)}ms avg`);
  }

  return testTraces;
}

// ============================================================================
// Step 6: Extract template using ribosome (if enough traces)
// ============================================================================

async function extractTemplate(traces: any[]): Promise<void> {
  const successfulTraces = traces.filter(t => t.success);

  if (successfulTraces.length < 2) {
    console.log('\n⚠️  Not enough successful traces for template extraction');
    return;
  }

  console.log('\n🧬 Attempting template extraction via ribosome...\n');

  // Get execution IDs from traces
  const executionIds = successfulTraces.slice(0, 5).map(t => t.execution_id);

  const response = await fetch(`${API_URL}/v2/ribosome/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      execution_ids: executionIds,
      template_name: 'auto-extracted-data-processing',
      category: 'tool',
    }),
  });

  if (response.ok) {
    const result = await response.json();
    console.log('  ✓ Template extracted successfully!');
    console.log(`    ID: ${(result as any).template?.id || 'unknown'}`);
    console.log(`    Confidence: ${((result as any).template?.confidence || 0) * 100}%`);
  } else if (response.status === 404) {
    console.log('  ⚠️  Ribosome endpoint not available (may not be implemented yet)');
  } else {
    console.log(`  ✗ Extraction failed: ${response.status}`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔬 Instrumentation Flow Test');
  console.log('='.repeat(50));
  console.log(`API: ${API_URL}\n`);

  // Check health
  try {
    const health = await fetch(`${API_URL}/health`);
    if (!health.ok) throw new Error('unhealthy');
    console.log('✓ Backend healthy\n');
  } catch {
    console.error('❌ Backend not available');
    process.exit(1);
  }

  // Authenticate
  if (!await authenticate()) {
    process.exit(1);
  }

  // Run traced executions
  await runTracedExecutions();

  // Verify traces
  const traces = await verifyTraces();

  // Try template extraction
  await extractTemplate(traces);

  console.log('\n' + '='.repeat(50));
  console.log('✅ Instrumentation flow test complete!');
  console.log('\nThe traced executions are now in the backend where:');
  console.log('  - Thompson Sampling can learn from success/failure patterns');
  console.log('  - Ribosome can extract templates from successful patterns');
  console.log('  - Dataflow analysis can track function call chains');
}

main().catch(console.error);
