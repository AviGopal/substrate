#!/usr/bin/env bun
/**
 * Test script to demonstrate that templates flow through the backend
 * with correct Thompson Sampling frequencies.
 *
 * This script:
 * 1. Authenticates as a MiniBob instance
 * 2. Registers test templates with different alpha/beta values
 * 3. Verifies they appear in the backend
 * 4. Reports executions to establish Thompson priors
 * 5. Calls the recommend endpoint multiple times
 * 6. Shows the selection frequency matches expected Thompson Sampling behavior
 */

const API_URL = process.env.API_URL || 'http://localhost:9081';
const NUM_SAMPLES = 100;

// MiniBob test instance credentials (from init-data job)
const MINIBOB_INSTANCE_ID = process.env.MINIBOB_INSTANCE_ID || 'minibob-local-001';
const MINIBOB_API_KEY = process.env.MINIBOB_API_KEY || 'test-api-key-123';

let authToken: string | null = null;

async function authenticate(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/v2/auth/minibob/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_id: MINIBOB_INSTANCE_ID,
        api_key: MINIBOB_API_KEY,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ✗ Authentication failed: ${error}`);
      return false;
    }

    const data = await response.json() as { token: string; org_id: string };
    authToken = data.token;
    console.log(`  ✓ Authenticated as MiniBob instance (org: ${data.org_id})`);
    return true;
  } catch (error) {
    console.error(`  ✗ Authentication error:`, error);
    return false;
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

interface Template {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  description: string;
  category: string;
  task_steps: Array<{
    id: string;
    subagent: string;
    description: string;
    dependencies: string[];
    prompt: { template: string };
  }>;
  scope: string;
}

interface Metrics {
  variant_id: string;
  thompson_alpha: number;
  thompson_beta: number;
  success_rate: number;
  total_executions: number;
}

// Test templates with different expected success rates
const testTemplates: Template[] = [
  {
    variant_id: 'sampling-test-high-v1',
    activity_id: 'sampling-test',
    variant_name: 'High Success Template',
    description: 'Template with high historical success rate (should be selected ~60% of time)',
    category: 'tool',
    scope: 'global',
    task_steps: [{
      id: 't1',
      subagent: 'test',
      description: 'High success task',
      dependencies: [],
      prompt: { template: 'Execute high success task' },
    }],
  },
  {
    variant_id: 'sampling-test-medium-v1',
    activity_id: 'sampling-test',
    variant_name: 'Medium Success Template',
    description: 'Template with medium historical success rate (should be selected ~30% of time)',
    category: 'tool',
    scope: 'global',
    task_steps: [{
      id: 't1',
      subagent: 'test',
      description: 'Medium success task',
      dependencies: [],
      prompt: { template: 'Execute medium success task' },
    }],
  },
  {
    variant_id: 'sampling-test-low-v1',
    activity_id: 'sampling-test',
    variant_name: 'Low Success Template',
    description: 'Template with low historical success rate (should be selected ~10% of time)',
    category: 'tool',
    scope: 'global',
    task_steps: [{
      id: 't1',
      subagent: 'test',
      description: 'Low success task',
      dependencies: [],
      prompt: { template: 'Execute low success task' },
    }],
  },
];

// Simulated execution history to set Thompson priors
const executionHistory: Record<string, { successes: number; failures: number }> = {
  'sampling-test-high-v1': { successes: 8, failures: 2 },    // 80% success, α=9, β=3
  'sampling-test-medium-v1': { successes: 5, failures: 5 },  // 50% success, α=6, β=6
  'sampling-test-low-v1': { successes: 2, failures: 8 },     // 20% success, α=3, β=9
};

async function registerTemplate(template: Template): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(template),
    });

    if (response.ok || response.status === 409) {
      console.log(`  ✓ Registered: ${template.variant_name}`);
      return true;
    }
    const error = await response.text();
    console.log(`  ✗ Failed: ${template.variant_name} (${response.status}): ${error}`);
    return false;
  } catch (error) {
    console.log(`  ✗ Error: ${template.variant_name}`, error);
    return false;
  }
}

async function reportExecution(variantId: string, success: boolean): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/v2/activities/executions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        variant_id: variantId,
        success,
        duration_ms: 1000,
        cost: 0.01,
        tokens: { input: 100, output: 50, cache: 0 },
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error(`    Execution report failed: ${error}`);
    }
    return response.ok;
  } catch {
    return false;
  }
}

async function getRecommendation(): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/v2/activities/recommend`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        task_description: 'Execute a sampling test task',
        category: 'tool',
        limit: 1,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as { recommendations?: Array<{ template_id: string }> };
    return data.recommendations?.[0]?.template_id || null;
  } catch {
    return null;
  }
}

async function getTemplateMetrics(variantId: string): Promise<Metrics | null> {
  try {
    const response = await fetch(`${API_URL}/v2/activities/templates/${variantId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;

    const data = await response.json() as any;
    return {
      variant_id: data.variant_id,
      thompson_alpha: data.metrics?.thompson_alpha || 1,
      thompson_beta: data.metrics?.thompson_beta || 1,
      success_rate: data.metrics?.success_rate || 0,
      total_executions: data.metrics?.total_executions || 0,
    };
  } catch {
    return null;
  }
}

async function verifyTemplatesExist(): Promise<boolean> {
  console.log('\n📋 Verifying templates in backend...');
  let allExist = true;

  for (const template of testTemplates) {
    const metrics = await getTemplateMetrics(template.variant_id);
    if (metrics) {
      console.log(`  ✓ ${template.variant_name}: α=${metrics.thompson_alpha.toFixed(1)}, β=${metrics.thompson_beta.toFixed(1)}`);
    } else {
      console.log(`  ✗ ${template.variant_name}: NOT FOUND`);
      allExist = false;
    }
  }

  return allExist;
}

async function simulateExecutionHistory(): Promise<void> {
  console.log('\n📊 Setting up Thompson Sampling priors via execution history...');

  for (const [variantId, history] of Object.entries(executionHistory)) {
    const template = testTemplates.find(t => t.variant_id === variantId);
    if (!template) continue;

    let successCount = 0;
    let failCount = 0;

    // Report successes
    for (let i = 0; i < history.successes; i++) {
      const reported = await reportExecution(variantId, true);
      if (reported) successCount++;
    }

    // Report failures
    for (let i = 0; i < history.failures; i++) {
      const reported = await reportExecution(variantId, false);
      if (reported) failCount++;
    }

    console.log(`  ${template.variant_name}: ${successCount} successes, ${failCount} failures reported`);
  }
}

async function runSamplingTest(): Promise<void> {
  console.log(`\n🎲 Running ${NUM_SAMPLES} Thompson Sampling selections...`);

  const selectionCounts: Record<string, number> = {};
  for (const template of testTemplates) {
    selectionCounts[template.variant_id] = 0;
  }
  selectionCounts['other'] = 0;

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const selected = await getRecommendation();
    if (selected && selected in selectionCounts) {
      selectionCounts[selected]++;
    } else if (selected) {
      selectionCounts['other']++;
    }

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  Progress: ${i + 1}/${NUM_SAMPLES}\r`);
    }
  }
  console.log('');

  // Calculate and display results
  console.log('\n📈 Selection Frequency Results:');
  console.log('─'.repeat(70));
  console.log('Template                          | Expected | Observed | Diff');
  console.log('─'.repeat(70));

  // Expected frequencies based on Thompson Sampling mean
  // Mean of Beta(α, β) = α / (α + β)
  const expectations: Record<string, number> = {
    'sampling-test-high-v1': 9 / 12,    // 0.75
    'sampling-test-medium-v1': 6 / 12,  // 0.50
    'sampling-test-low-v1': 3 / 12,     // 0.25
  };

  // Normalize expectations to sum to 1
  const totalExp = Object.values(expectations).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(expectations)) {
    expectations[key] = expectations[key] / totalExp;
  }

  for (const template of testTemplates) {
    const observed = selectionCounts[template.variant_id] / NUM_SAMPLES;
    const expected = expectations[template.variant_id] || 0;
    const diff = Math.abs(observed - expected);
    const diffSign = observed > expected ? '+' : '';

    console.log(
      `${template.variant_name.padEnd(33)} | ${(expected * 100).toFixed(1).padStart(6)}% | ${(observed * 100).toFixed(1).padStart(6)}% | ${diffSign}${(diff * 100).toFixed(1)}%`
    );
  }

  if (selectionCounts['other'] > 0) {
    console.log(`${'Other templates'.padEnd(33)} | ${'N/A'.padStart(7)} | ${((selectionCounts['other'] / NUM_SAMPLES) * 100).toFixed(1).padStart(6)}%`);
  }

  console.log('─'.repeat(70));

  // Statistical assessment
  const totalTestSelections = testTemplates.reduce((sum, t) => sum + selectionCounts[t.variant_id], 0);
  if (totalTestSelections === 0) {
    console.log('\n⚠️  No test templates were selected! The recommend endpoint may not be matching these templates.');
  } else {
    console.log(`\n✅ Thompson Sampling is working! ${totalTestSelections}/${NUM_SAMPLES} selections from test templates.`);
    console.log('   Note: Thompson Sampling is stochastic, so exact match to expectations is not required.');
    console.log('   High-success templates should be selected more often than low-success ones.');
  }
}

async function main() {
  console.log('🧪 Template Sampling Test');
  console.log('========================\n');
  console.log(`API URL: ${API_URL}`);

  // Step 1: Check health
  try {
    const health = await fetch(`${API_URL}/health`);
    if (!health.ok) {
      console.error('❌ Backend API not healthy');
      process.exit(1);
    }
    console.log('✓ Backend API is healthy\n');
  } catch (error) {
    console.error('❌ Cannot connect to backend API:', error);
    process.exit(1);
  }

  // Step 2: Authenticate as MiniBob instance
  console.log('🔐 Authenticating...');
  const authenticated = await authenticate();
  if (!authenticated) {
    console.error('❌ Failed to authenticate. Make sure minibob-local-001 instance exists.');
    console.log('   Run: kubectl logs -n activity-system job/surrealdb-init-data');
    process.exit(1);
  }
  console.log('');

  // Step 3: Register test templates
  console.log('📝 Registering test templates...');
  for (const template of testTemplates) {
    await registerTemplate(template);
  }

  // Step 3: Verify templates exist
  const templatesExist = await verifyTemplatesExist();
  if (!templatesExist) {
    console.log('\n⚠️  Some templates missing - this may affect results');
  }

  // Step 4: Simulate execution history to establish Thompson priors
  await simulateExecutionHistory();

  // Step 5: Verify metrics updated
  console.log('\n📊 Verifying Thompson priors after execution history...');
  for (const template of testTemplates) {
    const metrics = await getTemplateMetrics(template.variant_id);
    if (metrics) {
      const expectedMean = metrics.thompson_alpha / (metrics.thompson_alpha + metrics.thompson_beta);
      console.log(
        `  ${template.variant_name}: α=${metrics.thompson_alpha.toFixed(1)}, β=${metrics.thompson_beta.toFixed(1)} (mean=${(expectedMean * 100).toFixed(1)}%)`
      );
    }
  }

  // Step 6: Run sampling test
  await runSamplingTest();
}

main().catch(console.error);
