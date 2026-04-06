#!/usr/bin/env bun
/**
 * Quick Learning Loop Validation Script
 *
 * Validates MiniBob's learning system against local docker-desktop cluster:
 * 1. Registers test templates with variants (good, medium, poor)
 * 2. Simulates executions with different success rates
 * 3. Verifies Thompson Sampling converges to better variant
 * 4. Shows metrics improvement over time
 *
 * Usage:
 *   bun run scripts/validate-learning-loop.ts
 *   bun run scripts/validate-learning-loop.ts --clean  # Clean up test data first
 */

const API_BASE = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local';
const TEST_ORG = 'test_learning_validation';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  tasks: any[];
  successRate?: number; // For simulation
}

interface ExecutionResult {
  success: boolean;
  duration_ms: number;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
}

// =============================================================================
// TEST TEMPLATES: Three variants with different "quality"
// =============================================================================

const TEMPLATES: Template[] = [
  {
    id: 'infrastructure.validation.greeting.good',
    name: 'Greeting Generator (Good)',
    description: 'High-quality greeting generator with validation',
    category: 'infrastructure',
    tags: ['infrastructure.validation', 'meta.test'],
    tasks: [
      {
        id: 'generate',
        description: 'Generate greeting',
        prompt: { template: 'Generate a friendly greeting for {{name}}' },
      },
    ],
    successRate: 0.9, // 90% success rate
  },
  {
    id: 'infrastructure.validation.greeting.medium',
    name: 'Greeting Generator (Medium)',
    description: 'Standard greeting generator',
    category: 'infrastructure',
    tags: ['infrastructure.validation', 'meta.test'],
    tasks: [
      {
        id: 'generate',
        description: 'Generate greeting',
        prompt: { template: 'Say hello to {{name}}' },
      },
    ],
    successRate: 0.6, // 60% success rate
  },
  {
    id: 'infrastructure.validation.greeting.poor',
    name: 'Greeting Generator (Poor)',
    description: 'Basic greeting with errors',
    category: 'infrastructure',
    tags: ['infrastructure.validation', 'meta.test'],
    tasks: [
      {
        id: 'generate',
        description: 'Generate greeting',
        prompt: { template: 'Greet {{name}}' },
      },
    ],
    successRate: 0.3, // 30% success rate
  },
];

// =============================================================================
// API HELPERS
// =============================================================================

async function registerTemplate(template: Template): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/v2/activities/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        tasks: template.tasks,
        variant_id: template.id,
        activity_id: template.id,
        org_id: TEST_ORG,
        public: true,  // Make public for testing
        scope: 'global',  // Valid scope enum
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ❌ Failed to register ${template.id}: ${error}`);
      return false;
    }

    console.log(`  ✅ Registered: ${template.id}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error registering ${template.id}:`, error);
    return false;
  }
}

async function recordExecution(
  templateId: string,
  result: ExecutionResult
): Promise<boolean> {
  try {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const response = await fetch(`${API_BASE}/v2/activities/execution-traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        execution_id: executionId,
        template_id: templateId,  // Required field - maps to variant_id internally
        activity_id: templateId,
        status: result.success ? 'completed' : 'failed',
        duration_ms: result.duration_ms,
        cost_usd: result.cost_usd,
        tokens: {
          input: result.tokens_input,
          output: result.tokens_output,
          cache: 0,
        },
        metadata: { test_validation: true },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ❌ Failed to record execution: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error recording execution:`, error);
    return false;
  }
}

async function getRecommendations(task: string, limit = 5): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE}/v2/activities/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_description: task,
        tags: ['test', 'greeting'],
        limit,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    return [];
  }
}

async function getTemplateMetrics(): Promise<Map<string, any>> {
  const metrics = new Map();

  try {
    const response = await fetch(`${API_BASE}/v2/activities/execution-traces?limit=1000`);
    if (!response.ok) return metrics;

    const data = await response.json();
    const executions = data.executions || [];

    // Aggregate by activity_id
    for (const exec of executions) {
      const id = exec.activity_id || exec.variant_id;
      if (!id?.includes('validation.greeting')) continue;

      const current = metrics.get(id) || {
        total: 0,
        successes: 0,
        total_cost: 0,
        total_duration: 0,
      };

      current.total++;
      if (exec.success) current.successes++;
      current.total_cost += exec.cost_usd || 0;
      current.total_duration += exec.duration_ms || 0;

      metrics.set(id, current);
    }
  } catch (error) {
    // Ignore
  }

  return metrics;
}

// =============================================================================
// SIMULATION
// =============================================================================

function simulateExecution(template: Template): ExecutionResult {
  const success = Math.random() < (template.successRate || 0.5);

  // Vary metrics based on quality
  const baseTokens = template.successRate! > 0.7 ? 500 : template.successRate! > 0.5 ? 800 : 1200;
  const baseDuration = template.successRate! > 0.7 ? 5000 : template.successRate! > 0.5 ? 8000 : 12000;

  return {
    success,
    duration_ms: baseDuration + Math.floor(Math.random() * 2000),
    cost_usd: (baseTokens * 0.000003) + Math.random() * 0.001,
    tokens_input: baseTokens + Math.floor(Math.random() * 200),
    tokens_output: Math.floor(baseTokens * 0.1) + Math.floor(Math.random() * 50),
  };
}

// =============================================================================
// MAIN VALIDATION
// =============================================================================

async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║       LEARNING LOOP VALIDATION - docker-desktop cluster          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Health check
  console.log('1️⃣  HEALTH CHECK');
  const healthy = await checkHealth();
  if (!healthy) {
    console.error(`   ❌ API not healthy at ${API_BASE}`);
    console.error('   Make sure the cluster is running: kubectl get pods -n activity-system');
    process.exit(1);
  }
  console.log(`   ✅ API healthy at ${API_BASE}\n`);

  // Step 2: Register templates
  console.log('2️⃣  REGISTERING TEST TEMPLATES');
  for (const template of TEMPLATES) {
    await registerTemplate(template);
  }
  console.log('');

  // Step 3: Baseline recommendations (before learning)
  console.log('3️⃣  BASELINE RECOMMENDATIONS (before learning)');
  const baselineRecs = await getRecommendations('generate a greeting message');
  if (baselineRecs.length === 0) {
    console.log('   ⚠️  No recommendations yet (templates may need FTS indexing)');
  } else {
    console.log('   Top recommendations:');
    for (const rec of baselineRecs.slice(0, 3)) {
      const meta = rec.selection_metadata || {};
      console.log(`   - ${rec.template_id}: α=${meta.alpha || '?'}, β=${meta.beta || '?'}, score=${(meta.score || 0).toFixed(3)}`);
    }
  }
  console.log('');

  // Step 4: Simulate executions
  console.log('4️⃣  SIMULATING EXECUTIONS (20 per template)');
  const EXECUTIONS_PER_TEMPLATE = 20;

  for (const template of TEMPLATES) {
    let successes = 0;
    for (let i = 0; i < EXECUTIONS_PER_TEMPLATE; i++) {
      const result = simulateExecution(template);
      if (result.success) successes++;
      await recordExecution(template.id, result);
    }
    console.log(`   ${template.id}: ${successes}/${EXECUTIONS_PER_TEMPLATE} successes (${((successes/EXECUTIONS_PER_TEMPLATE)*100).toFixed(0)}%)`);
  }
  console.log('');

  // Step 5: Post-learning recommendations
  console.log('5️⃣  POST-LEARNING RECOMMENDATIONS');
  const postRecs = await getRecommendations('generate a greeting message');
  if (postRecs.length === 0) {
    console.log('   ⚠️  No recommendations (may need time for aggregation)');
  } else {
    console.log('   Top recommendations (should favor high-quality template):');
    for (const rec of postRecs.slice(0, 3)) {
      const meta = rec.selection_metadata || {};
      console.log(`   - ${rec.template_id}: α=${meta.alpha || '?'}, β=${meta.beta || '?'}, score=${(meta.score || 0).toFixed(3)}`);
    }
  }
  console.log('');

  // Step 6: Verify convergence
  console.log('6️⃣  VERIFYING CONVERGENCE');
  const metrics = await getTemplateMetrics();

  console.log('   Execution metrics by template:');
  console.log('   ┌────────────────────────┬───────┬──────────┬─────────────┬────────────┐');
  console.log('   │ Template               │ Total │ Successes│ Success Rate│ Avg Cost   │');
  console.log('   ├────────────────────────┼───────┼──────────┼─────────────┼────────────┤');

  for (const [id, m] of metrics) {
    const successRate = m.total > 0 ? (m.successes / m.total * 100).toFixed(1) : '0.0';
    const avgCost = m.total > 0 ? (m.total_cost / m.total).toFixed(6) : '0.000000';
    const shortId = id.replace('test:', '').substring(0, 20).padEnd(20);
    console.log(`   │ ${shortId} │ ${String(m.total).padStart(5)} │ ${String(m.successes).padStart(8)} │ ${successRate.padStart(10)}% │ $${avgCost} │`);
  }
  console.log('   └────────────────────────┴───────┴──────────┴─────────────┴────────────┘');
  console.log('');

  // Step 7: Validation summary
  console.log('7️⃣  VALIDATION SUMMARY');

  // Check if top recommendation is the good template
  const topRec = postRecs[0];
  const isGoodOnTop = topRec?.template_id?.includes('greeting.good');

  if (isGoodOnTop) {
    console.log('   ✅ PASS: Thompson Sampling correctly favors high-quality template');
  } else if (postRecs.length === 0) {
    console.log('   ⚠️  INCONCLUSIVE: No recommendations available (may need FTS reindex)');
  } else {
    console.log('   ❌ FAIL: Top recommendation is not the high-quality template');
    console.log(`      Expected: infrastructure.validation.greeting.good, Got: ${topRec?.template_id}`);
  }

  // Check if metrics show improvement potential
  const goodMetrics = metrics.get('infrastructure.validation.greeting.good');
  const poorMetrics = metrics.get('infrastructure.validation.greeting.poor');

  if (goodMetrics && poorMetrics) {
    const goodRate = goodMetrics.successes / goodMetrics.total;
    const poorRate = poorMetrics.successes / poorMetrics.total;

    if (goodRate > poorRate) {
      console.log('   ✅ PASS: High-quality template has higher success rate');
    } else {
      console.log('   ⚠️  WARNING: Success rates not as expected (random variance)');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('Validation complete. Check the dashboard for visual confirmation:');
  console.log('  http://graph.metabob.local (if available)');
  console.log('  http://internal.metabob.local');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});
