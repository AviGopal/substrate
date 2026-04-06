#!/usr/bin/env bun
/**
 * Activity Improvement Runtime Test Harness
 *
 * Exercises the full learning loop:
 * 1. Execute activities with variations
 * 2. Record traces to backend
 * 3. Trigger ribosome extraction
 * 4. Show Thompson Sampling convergence
 * 5. Demonstrate cost/time improvement
 *
 * Usage:
 *   bun run scripts/activity-improvement-harness.ts
 *   bun run scripts/activity-improvement-harness.ts --activity fix-bug-complete
 *   bun run scripts/activity-improvement-harness.ts --iterations 10
 *   bun run scripts/activity-improvement-harness.ts --extract  # Trigger ribosome
 */

const API_BASE = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local';

// =============================================================================
// TYPES
// =============================================================================

interface ExecutionTrace {
  execution_id: string;
  template_id: string;
  activity_id: string;
  success: boolean;
  duration_ms: number;
  cost_usd: number;
  tokens: { input: number; output: number; cache: number };
  tasks?: TaskTrace[];
  metadata?: Record<string, unknown>;
}

interface TaskTrace {
  task_id: string;
  status: 'completed' | 'failed';
  duration_ms: number;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
  duration_ms: number;
}

interface RibosomeCandidate {
  activity_id: string;
  execution_count: number;
  success_count: number;
  avg_duration_ms: number;
  execution_ids: string[];
}

interface ExtractedTemplate {
  id: string;
  name: string;
  tasks: any[];
  confidence: number;
  input_shapes: string[];
  output_shapes: string[];
}

interface ThompsonScore {
  template_id: string;
  alpha: number;
  beta: number;
  score: number;
  total_executions: number;
}

// =============================================================================
// API HELPERS
// =============================================================================

async function storeExecutionTrace(trace: ExecutionTrace): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/v2/activities/execution-traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        execution_id: trace.execution_id,
        template_id: trace.template_id,
        activity_id: trace.activity_id,
        status: trace.success ? 'completed' : 'failed',
        duration_ms: trace.duration_ms,
        cost_usd: trace.cost_usd,
        tokens: trace.tokens,
        execution_trace: trace.tasks ? { tasks: trace.tasks } : undefined,
        metadata: trace.metadata,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`\n   ⚠️  Store failed for ${trace.template_id}: ${response.status} - ${text}`);
    }
    return response.ok;
  } catch (error) {
    console.error(`\n   ❌ Store error for ${trace.template_id}:`, error);
    return false;
  }
}

async function getRibosomeCandidates(limit = 10, minTraces = 2): Promise<RibosomeCandidate[]> {
  try {
    const response = await fetch(
      `${API_BASE}/v2/ribosome/candidates?limit=${limit}&min_traces=${minTraces}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.candidates || [];
  } catch (error) {
    return [];
  }
}

async function extractTemplate(executionIds: string[], name?: string): Promise<ExtractedTemplate | null> {
  try {
    const response = await fetch(`${API_BASE}/v2/ribosome/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        execution_ids: executionIds,
        name,
        category: 'infrastructure',
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('Extraction failed:', error);
      return null;
    }
    const data = await response.json();
    return data.template;
  } catch (error) {
    console.error('Extraction error:', error);
    return null;
  }
}

async function getThompsonScores(activityIds?: string[]): Promise<ThompsonScore[]> {
  try {
    const response = await fetch(`${API_BASE}/v2/activities/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_ids: activityIds }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.scores || [];
  } catch (error) {
    return [];
  }
}

async function getRecommendations(task: string, limit = 5): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE}/v2/activities/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_description: task, limit, org_id: 'public' }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    return [];
  }
}

async function registerTemplate(variant: VariantConfig): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/v2/activities/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: variant.name,
        description: `Simulated ${variant.name} for learning validation`,
        category: 'infrastructure',
        tags: ['infrastructure.validation', 'meta.simulation'],
        variant_id: variant.id,
        activity_id: variant.id,
        org_id: 'public',
        public: true,
        scope: 'global',
        tasks: variant.tasks.map(t => ({
          id: t.id,
          description: t.description,
          prompt: { template: `Execute ${t.description}` },
          tools: { required: t.tools },
        })),
      }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// =============================================================================
// SIMULATION ENGINE
// =============================================================================

interface SimulationConfig {
  activityId: string;
  variants: VariantConfig[];
  iterations: number;
}

interface VariantConfig {
  id: string;
  name: string;
  successRate: number;  // 0-1
  baseDuration: number;  // ms
  baseCost: number;  // USD
  baseTokens: number;
  tasks: SimulatedTask[];
}

interface SimulatedTask {
  id: string;
  description: string;
  tools: string[];
  successRate: number;
}

function simulateExecution(variant: VariantConfig): ExecutionTrace {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Simulate task execution
  const tasks: TaskTrace[] = variant.tasks.map((task, idx) => {
    const taskSuccess = Math.random() < task.successRate;
    const toolCalls: ToolCall[] = task.tools.map(tool => ({
      tool,
      args: { simulated: true },
      success: taskSuccess,
      duration_ms: Math.floor(Math.random() * 500) + 100,
    }));

    return {
      task_id: task.id,
      status: taskSuccess ? 'completed' : 'failed',
      duration_ms: toolCalls.reduce((sum, tc) => sum + tc.duration_ms, 0),
      tool_calls: toolCalls,
    };
  });

  // Overall success based on variant success rate
  const success = Math.random() < variant.successRate;

  // Add variance to metrics
  const durationVariance = 0.2;
  const costVariance = 0.1;

  return {
    execution_id: executionId,
    template_id: variant.id,
    activity_id: variant.id,
    success,
    duration_ms: Math.floor(variant.baseDuration * (1 + (Math.random() - 0.5) * durationVariance)),
    cost_usd: variant.baseCost * (1 + (Math.random() - 0.5) * costVariance),
    tokens: {
      input: Math.floor(variant.baseTokens * (1 + Math.random() * 0.2)),
      output: Math.floor(variant.baseTokens * 0.15 * (1 + Math.random() * 0.2)),
      cache: 0,
    },
    tasks,
    metadata: {
      simulated: true,
      variant_name: variant.name,
      simulation_timestamp: new Date().toISOString(),
    },
  };
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

const FIX_BUG_SCENARIOS: VariantConfig[] = [
  {
    id: 'fix.bug.comprehensive',
    name: 'Fix Bug (Comprehensive)',
    successRate: 0.85,
    baseDuration: 45000,
    baseCost: 0.08,
    baseTokens: 5000,
    tasks: [
      { id: 'analyze', description: 'Analyze error logs', tools: ['read', 'grep'], successRate: 0.95 },
      { id: 'locate', description: 'Locate bug source', tools: ['grep', 'read'], successRate: 0.90 },
      { id: 'fix', description: 'Apply fix', tools: ['edit'], successRate: 0.85 },
      { id: 'test', description: 'Run tests', tools: ['bash'], successRate: 0.80 },
    ],
  },
  {
    id: 'fix.bug.quick',
    name: 'Fix Bug (Quick)',
    successRate: 0.60,
    baseDuration: 15000,
    baseCost: 0.03,
    baseTokens: 2000,
    tasks: [
      { id: 'fix', description: 'Quick fix', tools: ['edit'], successRate: 0.70 },
      { id: 'test', description: 'Quick test', tools: ['bash'], successRate: 0.75 },
    ],
  },
  {
    id: 'fix.bug.thorough',
    name: 'Fix Bug (Thorough)',
    successRate: 0.92,
    baseDuration: 90000,
    baseCost: 0.15,
    baseTokens: 10000,
    tasks: [
      { id: 'reproduce', description: 'Reproduce issue', tools: ['bash', 'read'], successRate: 0.98 },
      { id: 'analyze', description: 'Deep analysis', tools: ['read', 'grep', 'bash'], successRate: 0.95 },
      { id: 'locate', description: 'Trace root cause', tools: ['grep', 'read'], successRate: 0.93 },
      { id: 'fix', description: 'Apply fix', tools: ['edit'], successRate: 0.90 },
      { id: 'test', description: 'Comprehensive tests', tools: ['bash'], successRate: 0.88 },
      { id: 'verify', description: 'Verify in staging', tools: ['bash'], successRate: 0.95 },
    ],
  },
];

const ADD_FEATURE_SCENARIOS: VariantConfig[] = [
  {
    id: 'feature.add.incremental',
    name: 'Add Feature (Incremental)',
    successRate: 0.80,
    baseDuration: 60000,
    baseCost: 0.10,
    baseTokens: 6000,
    tasks: [
      { id: 'scaffold', description: 'Create scaffold', tools: ['write'], successRate: 0.95 },
      { id: 'implement', description: 'Implement core', tools: ['edit', 'write'], successRate: 0.85 },
      { id: 'test', description: 'Add tests', tools: ['write', 'bash'], successRate: 0.80 },
    ],
  },
  {
    id: 'feature.add.complete',
    name: 'Add Feature (Complete)',
    successRate: 0.75,
    baseDuration: 120000,
    baseCost: 0.20,
    baseTokens: 12000,
    tasks: [
      { id: 'plan', description: 'Plan implementation', tools: ['read'], successRate: 0.98 },
      { id: 'scaffold', description: 'Create structure', tools: ['write', 'bash'], successRate: 0.95 },
      { id: 'implement', description: 'Implement feature', tools: ['edit', 'write'], successRate: 0.80 },
      { id: 'test', description: 'Write tests', tools: ['write'], successRate: 0.85 },
      { id: 'document', description: 'Add docs', tools: ['write'], successRate: 0.90 },
    ],
  },
];

// =============================================================================
// MAIN HARNESS
// =============================================================================

interface HarnessOptions {
  scenario: 'fix-bug' | 'add-feature' | 'custom';
  iterations: number;
  extract: boolean;
  showProgress: boolean;
}

async function runHarness(options: HarnessOptions) {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║         ACTIVITY IMPROVEMENT RUNTIME TEST HARNESS                ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  // Select scenario
  const variants = options.scenario === 'fix-bug'
    ? FIX_BUG_SCENARIOS
    : options.scenario === 'add-feature'
    ? ADD_FEATURE_SCENARIOS
    : FIX_BUG_SCENARIOS;

  console.log(`📋 Scenario: ${options.scenario}`);
  console.log(`🔄 Iterations per variant: ${options.iterations}`);
  console.log(`📦 Variants: ${variants.map(v => v.name).join(', ')}\n`);

  // Phase 0: Register templates
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('PHASE 0: TEMPLATE REGISTRATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (const variant of variants) {
    const registered = await registerTemplate(variant);
    console.log(`   ${registered ? '✅' : '⚠️ '} ${variant.name} (${variant.id})`);
  }

  // Phase 1: Execute and record traces
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('PHASE 1: EXECUTION & TRACE RECORDING');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const executionResults: Map<string, { successes: number; failures: number; totalDuration: number; totalCost: number }> = new Map();

  for (const variant of variants) {
    executionResults.set(variant.id, { successes: 0, failures: 0, totalDuration: 0, totalCost: 0 });

    if (options.showProgress) {
      process.stdout.write(`   ${variant.name}: `);
    }

    for (let i = 0; i < options.iterations; i++) {
      const trace = simulateExecution(variant);
      const stored = await storeExecutionTrace(trace);

      const results = executionResults.get(variant.id)!;
      if (trace.success) results.successes++;
      else results.failures++;
      results.totalDuration += trace.duration_ms;
      results.totalCost += trace.cost_usd;

      if (options.showProgress) {
        process.stdout.write(trace.success ? '✓' : '✗');
      }

      // Small delay to avoid overwhelming the API
      await new Promise(r => setTimeout(r, 50));
    }

    if (options.showProgress) {
      console.log('');
    }
  }

  // Print execution summary
  console.log('\n   Execution Summary:');
  console.log('   ┌────────────────────────────┬──────────┬──────────┬───────────┬───────────┐');
  console.log('   │ Variant                    │ Success  │ Failure  │ Avg Time  │ Avg Cost  │');
  console.log('   ├────────────────────────────┼──────────┼──────────┼───────────┼───────────┤');

  for (const variant of variants) {
    const results = executionResults.get(variant.id)!;
    const total = results.successes + results.failures;
    const avgDuration = (results.totalDuration / total / 1000).toFixed(1);
    const avgCost = (results.totalCost / total).toFixed(4);
    const successRate = ((results.successes / total) * 100).toFixed(0);

    const name = variant.name.substring(0, 26).padEnd(26);
    console.log(`   │ ${name} │ ${String(results.successes).padStart(5)} (${successRate}%) │ ${String(results.failures).padStart(8)} │ ${avgDuration.padStart(7)}s │ $${avgCost.padStart(7)} │`);
  }
  console.log('   └────────────────────────────┴──────────┴──────────┴───────────┴───────────┘');

  // Phase 2: Check Thompson Sampling scores
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('PHASE 2: THOMPSON SAMPLING ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const recommendations = await getRecommendations(
    options.scenario === 'fix-bug' ? 'fix a bug in the code' : 'add a new feature'
  );

  if (recommendations.length > 0) {
    console.log('   Recommendations (by Thompson Sampling score):');
    console.log('   ┌────────────────────────────┬───────┬───────┬─────────┐');
    console.log('   │ Template                   │ Alpha │ Beta  │ Score   │');
    console.log('   ├────────────────────────────┼───────┼───────┼─────────┤');

    for (const rec of recommendations.slice(0, 5)) {
      const meta = rec.selection_metadata || {};
      const id = (rec.template_id || '').substring(0, 26).padEnd(26);
      const alpha = String(meta.alpha || '?').padStart(5);
      const beta = String(meta.beta || '?').padStart(5);
      const score = (meta.score || 0).toFixed(4).padStart(7);
      console.log(`   │ ${id} │ ${alpha} │ ${beta} │ ${score} │`);
    }
    console.log('   └────────────────────────────┴───────┴───────┴─────────┘');

    // Check if our variants appear
    const variantIds = new Set(variants.map(v => v.id));
    const matchingRecs = recommendations.filter(r => {
      const id = r.template_id || '';
      return variantIds.has(id) || variants.some(v => id.includes(v.id));
    });

    if (matchingRecs.length > 0) {
      console.log(`\n   ✅ ${matchingRecs.length} of our variants appear in recommendations`);
    } else {
      console.log('\n   ⚠️  Our variants not yet in recommendations (need more executions or FTS indexing)');
    }
  } else {
    console.log('   ⚠️  No recommendations available');
  }

  // Phase 3: Ribosome extraction
  if (options.extract) {
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('PHASE 3: RIBOSOME TEMPLATE EXTRACTION');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const candidates = await getRibosomeCandidates(10, 3);

    if (candidates.length > 0) {
      console.log(`   Found ${candidates.length} extraction candidates:\n`);

      for (const candidate of candidates.slice(0, 5)) {
        const successRate = ((candidate.success_count / candidate.execution_count) * 100).toFixed(0);
        console.log(`   📦 ${candidate.activity_id}`);
        console.log(`      Executions: ${candidate.execution_count}, Success: ${successRate}%`);
        console.log(`      Avg Duration: ${(candidate.avg_duration_ms / 1000).toFixed(1)}s`);

        // Try extraction for high-success candidates
        if (candidate.success_count >= 3 && candidate.execution_count >= 5) {
          console.log(`      🔬 Attempting extraction...`);
          const template = await extractTemplate(
            candidate.execution_ids.slice(0, 5),
            `extracted-${candidate.activity_id}`
          );

          if (template) {
            console.log(`      ✅ Extracted template: ${template.id}`);
            console.log(`         Confidence: ${(template.confidence * 100).toFixed(0)}%`);
            console.log(`         Tasks: ${template.tasks?.length || 0}`);
            console.log(`         Input shapes: ${template.input_shapes?.join(', ') || 'none'}`);
          } else {
            console.log(`      ❌ Extraction failed`);
          }
        }
        console.log('');
      }
    } else {
      console.log('   No extraction candidates found (need more successful executions)');
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const bestVariant = [...executionResults.entries()]
    .map(([id, r]) => ({ id, successRate: r.successes / (r.successes + r.failures) }))
    .sort((a, b) => b.successRate - a.successRate)[0];

  const cheapestVariant = [...executionResults.entries()]
    .map(([id, r]) => ({ id, avgCost: r.totalCost / (r.successes + r.failures) }))
    .sort((a, b) => a.avgCost - b.avgCost)[0];

  console.log(`   📊 Best Success Rate: ${bestVariant.id} (${(bestVariant.successRate * 100).toFixed(0)}%)`);
  console.log(`   💰 Lowest Cost: ${cheapestVariant.id} ($${cheapestVariant.avgCost.toFixed(4)}/exec)`);
  console.log(`   🎯 Total Executions: ${options.iterations * variants.length}`);

  const totalSuccess = [...executionResults.values()].reduce((s, r) => s + r.successes, 0);
  const totalExecs = [...executionResults.values()].reduce((s, r) => s + r.successes + r.failures, 0);
  console.log(`   ✅ Overall Success Rate: ${((totalSuccess / totalExecs) * 100).toFixed(0)}%`);

  console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs(): HarnessOptions {
  const args = process.argv.slice(2);

  const options: HarnessOptions = {
    scenario: 'fix-bug',
    iterations: 10,
    extract: false,
    showProgress: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--scenario' || arg === '-s') {
      const value = args[++i];
      if (value === 'fix-bug' || value === 'add-feature' || value === 'custom') {
        options.scenario = value;
      }
    } else if (arg === '--iterations' || arg === '-i') {
      options.iterations = parseInt(args[++i], 10) || 10;
    } else if (arg === '--extract' || arg === '-e') {
      options.extract = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.showProgress = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Activity Improvement Runtime Test Harness

Usage:
  bun run scripts/activity-improvement-harness.ts [options]

Options:
  -s, --scenario <name>   Scenario to run: fix-bug, add-feature (default: fix-bug)
  -i, --iterations <n>    Executions per variant (default: 10)
  -e, --extract           Trigger ribosome extraction after executions
  -q, --quiet             Don't show per-execution progress
  -h, --help              Show this help message

Examples:
  # Run fix-bug scenario with 20 iterations
  bun run scripts/activity-improvement-harness.ts -s fix-bug -i 20

  # Run and extract templates
  bun run scripts/activity-improvement-harness.ts --extract

  # Quick test
  bun run scripts/activity-improvement-harness.ts -i 5 -q
      `);
      process.exit(0);
    }
  }

  return options;
}

// Run
const options = parseArgs();
runHarness(options).catch(console.error);
