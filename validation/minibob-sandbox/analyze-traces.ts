#!/usr/bin/env bun
/**
 * Trace Analysis Tool
 *
 * Fetches execution traces from the backend and validates them against
 * expected resolver invocations, composition edges, and impulse state evolution.
 *
 * Usage:
 *   bun run analyze-traces.ts [goal-id]
 *   bun run analyze-traces.ts --all
 *   bun run analyze-traces.ts --summary
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Types
interface TestGoal {
  id: string;
  category: string;
  goal: string | { targetState: Record<string, unknown> };
  expectedResolver: string;
  expectedApproach: string;
  expectedComplexity?: string;
  traceValidation: TraceValidation;
  impulseState?: {
    impulses: Array<{ id: string; pointer: Record<string, unknown> }>;
  };
  description: string;
}

interface TraceValidation {
  shouldInclude: string[];
  shouldNotInclude?: string[];
  maxTurns?: number;
  minTasks?: number;
  expectedTools?: string[];
  expectedImpulses?: string[];
  expectedCompositionEdges?: number;
  compositionPattern?: string;
  activitySequence?: string[];
  bootstrapActions?: string[];
  stateTransitions?: string[];
  fallbackReason?: string;
  expectedFailures?: number;
  expectedRetries?: number;
  recoveryStrategy?: string;
  cycleDetected?: boolean;
  maxCompositionDepth?: number;
  terminationReason?: string;
  partialCompletion?: boolean;
  maxDuration?: number;
  maxTokens?: number;
  parallelActivities?: boolean;
  concurrency?: number;
  thompsonSampling?: {
    shouldRecord: boolean;
    templateSelectionLogged?: boolean;
    rewardCalculated?: boolean;
    posteriorUpdated?: boolean;
    expectedRewards?: number[];
  };
  ribosome?: {
    shouldExtract: boolean;
    expectedTemplateCategory?: string;
    stateTracking?: boolean;
    validationRules?: boolean;
  };
  newTemplateCreated?: boolean;
  shouldFindMatchingActivity?: boolean;
  hybridExecution?: boolean;
}

interface ExecutionTrace {
  id: string;
  activity_id: string;
  activity_name: string;
  timestamp: string;
  duration_ms: number;
  success: boolean;
  total_cost: number;
  total_tokens: number;
  tasks: TaskTrace[];
  composition_edges?: CompositionEdge[];
  impulse_state?: {
    before: ImpulseSnapshot[];
    after: ImpulseSnapshot[];
  };
  metadata?: {
    resolver_chain?: string[];
    goal?: string;
    approach?: string;
    complexity?: string;
    bootstrap_actions?: string[];
    state_transitions?: string[];
    failure_reason?: string;
    retry_count?: number;
    cycle_detected?: boolean;
    depth_reached?: number;
    thompson_sampling?: {
      template_id: string;
      selection_probability: number;
      reward: number;
    };
    ribosome_extraction?: {
      extracted: boolean;
      new_template_id?: string;
      category?: string;
    };
  };
}

interface TaskTrace {
  task_id: string;
  description: string;
  success: boolean;
  duration_ms: number;
  llm_calls: number;
  tool_calls: ToolCall[];
  output?: string;
}

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
}

interface CompositionEdge {
  from_activity: string;
  to_activity: string;
  pattern: string;
  timestamp: string;
}

interface ImpulseSnapshot {
  id: string;
  type: string;
  loaded: boolean;
  budget_used: number;
  priority: string;
}

interface ValidationResult {
  goalId: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    duration_ms: number;
    total_cost: number;
    total_tokens: number;
    success_rate: number;
  };
  resolverChain: string[];
  compositionEdges: CompositionEdge[];
  impulseEvolution: {
    types_created: string[];
    total_budget_used: number;
  };
}

// Configuration
const BACKEND_URL = process.env.METABOB_ENDPOINT || 'https://activity.metabob.com';
const API_KEY = process.env.METABOB_API_KEY;

if (!API_KEY) {
  console.error('Error: METABOB_API_KEY environment variable not set');
  process.exit(1);
}

// Load test goals
function loadTestGoals(): TestGoal[] {
  const goalsPath = join(import.meta.dir, 'test-goals.json');
  const content = readFileSync(goalsPath, 'utf-8');
  return JSON.parse(content);
}

// Fetch traces from backend
async function fetchTraces(goalId?: string): Promise<ExecutionTrace[]> {
  const url = goalId
    ? `${BACKEND_URL}/v2/activities/execution-traces?goal_id=${goalId}`
    : `${BACKEND_URL}/v2/activities/execution-traces?limit=100`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `ApiKey ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch traces: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.traces || [];
}

// Fetch composition edges
async function fetchCompositionEdges(activityId: string): Promise<CompositionEdge[]> {
  const url = `${BACKEND_URL}/v2/activities/composition/edges?activity_id=${activityId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `ApiKey ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.warn(`Failed to fetch composition edges: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.edges || [];
}

// Validate a single trace against expected criteria
function validateTrace(trace: ExecutionTrace, goal: TestGoal): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validation = goal.traceValidation;

  // Check resolver chain
  const resolverChain = trace.metadata?.resolver_chain || [];
  for (const expectedResolver of validation.shouldInclude) {
    if (!resolverChain.includes(expectedResolver)) {
      errors.push(`Missing expected resolver: ${expectedResolver}`);
    }
  }

  for (const forbiddenResolver of validation.shouldNotInclude || []) {
    if (resolverChain.includes(forbiddenResolver)) {
      errors.push(`Unexpected resolver invoked: ${forbiddenResolver}`);
    }
  }

  // Check approach
  if (trace.metadata?.approach !== goal.expectedApproach) {
    errors.push(
      `Expected approach "${goal.expectedApproach}", got "${trace.metadata?.approach}"`
    );
  }

  // Check complexity (if applicable)
  if (goal.expectedComplexity && trace.metadata?.complexity !== goal.expectedComplexity) {
    warnings.push(
      `Expected complexity "${goal.expectedComplexity}", got "${trace.metadata?.complexity}"`
    );
  }

  // Check turn count
  if (validation.maxTurns && trace.tasks.length > validation.maxTurns) {
    errors.push(
      `Exceeded max turns: ${trace.tasks.length} > ${validation.maxTurns}`
    );
  }

  // Check minimum tasks
  if (validation.minTasks && trace.tasks.length < validation.minTasks) {
    errors.push(
      `Insufficient tasks: ${trace.tasks.length} < ${validation.minTasks}`
    );
  }

  // Check tools used
  if (validation.expectedTools) {
    const toolsUsed = new Set<string>();
    for (const task of trace.tasks) {
      for (const toolCall of task.tool_calls) {
        toolsUsed.add(toolCall.tool);
      }
    }

    for (const expectedTool of validation.expectedTools) {
      if (!toolsUsed.has(expectedTool)) {
        warnings.push(`Expected tool not used: ${expectedTool}`);
      }
    }
  }

  // Check impulses created
  if (validation.expectedImpulses) {
    const impulsesCreated = new Set<string>(
      (trace.impulse_state?.after || []).map(i => i.type)
    );

    for (const expectedImpulse of validation.expectedImpulses) {
      if (!impulsesCreated.has(expectedImpulse)) {
        warnings.push(`Expected impulse type not created: ${expectedImpulse}`);
      }
    }
  }

  // Check composition edges
  const compositionEdges = trace.composition_edges || [];
  if (validation.expectedCompositionEdges !== undefined) {
    if (compositionEdges.length !== validation.expectedCompositionEdges) {
      errors.push(
        `Expected ${validation.expectedCompositionEdges} composition edges, got ${compositionEdges.length}`
      );
    }
  }

  // Check composition pattern
  if (validation.compositionPattern && compositionEdges.length > 0) {
    const patterns = new Set(compositionEdges.map(e => e.pattern));
    if (!patterns.has(validation.compositionPattern)) {
      errors.push(
        `Expected composition pattern "${validation.compositionPattern}", got ${Array.from(patterns).join(', ')}`
      );
    }
  }

  // Check bootstrap actions
  if (validation.bootstrapActions) {
    const bootstrapActions = trace.metadata?.bootstrap_actions || [];
    for (const expectedAction of validation.bootstrapActions) {
      if (!bootstrapActions.includes(expectedAction)) {
        errors.push(`Missing bootstrap action: ${expectedAction}`);
      }
    }
  }

  // Check state transitions
  if (validation.stateTransitions) {
    const stateTransitions = trace.metadata?.state_transitions || [];
    for (const expectedTransition of validation.stateTransitions) {
      if (!stateTransitions.includes(expectedTransition)) {
        warnings.push(`Missing state transition: ${expectedTransition}`);
      }
    }
  }

  // Check fallback reason
  if (validation.fallbackReason) {
    if (trace.metadata?.failure_reason !== validation.fallbackReason) {
      warnings.push(
        `Expected fallback reason "${validation.fallbackReason}", got "${trace.metadata?.failure_reason}"`
      );
    }
  }

  // Check retries
  if (validation.expectedRetries !== undefined) {
    const retryCount = trace.metadata?.retry_count || 0;
    if (retryCount !== validation.expectedRetries) {
      errors.push(
        `Expected ${validation.expectedRetries} retries, got ${retryCount}`
      );
    }
  }

  // Check cycle detection
  if (validation.cycleDetected !== undefined) {
    if (trace.metadata?.cycle_detected !== validation.cycleDetected) {
      errors.push(
        `Expected cycle detection: ${validation.cycleDetected}, got ${trace.metadata?.cycle_detected}`
      );
    }
  }

  // Check depth limit
  if (validation.maxCompositionDepth !== undefined) {
    const depthReached = trace.metadata?.depth_reached || 0;
    if (depthReached > validation.maxCompositionDepth) {
      errors.push(
        `Exceeded max depth: ${depthReached} > ${validation.maxCompositionDepth}`
      );
    }
  }

  // Check duration
  if (validation.maxDuration && trace.duration_ms > validation.maxDuration) {
    warnings.push(
      `Exceeded max duration: ${trace.duration_ms}ms > ${validation.maxDuration}ms`
    );
  }

  // Check tokens
  if (validation.maxTokens && trace.total_tokens > validation.maxTokens) {
    warnings.push(
      `Exceeded max tokens: ${trace.total_tokens} > ${validation.maxTokens}`
    );
  }

  // Check Thompson Sampling
  if (validation.thompsonSampling?.shouldRecord) {
    if (!trace.metadata?.thompson_sampling) {
      errors.push('Thompson Sampling data not recorded');
    } else {
      if (validation.thompsonSampling.rewardCalculated !== undefined) {
        if (trace.metadata.thompson_sampling.reward === undefined) {
          errors.push('Thompson Sampling reward not calculated');
        }
      }
    }
  }

  // Check Ribosome extraction
  if (validation.ribosome?.shouldExtract) {
    if (!trace.metadata?.ribosome_extraction?.extracted) {
      errors.push('Ribosome extraction did not occur');
    } else {
      if (validation.ribosome.expectedTemplateCategory) {
        if (trace.metadata.ribosome_extraction.category !== validation.ribosome.expectedTemplateCategory) {
          errors.push(
            `Expected template category "${validation.ribosome.expectedTemplateCategory}", got "${trace.metadata.ribosome_extraction.category}"`
          );
        }
      }
    }
  }

  // Calculate impulse evolution
  const impulsesBefore = trace.impulse_state?.before || [];
  const impulsesAfter = trace.impulse_state?.after || [];
  const typesCreated = Array.from(
    new Set(impulsesAfter.map(i => i.type).filter(t => !impulsesBefore.some(b => b.type === t)))
  );
  const totalBudgetUsed = impulsesAfter.reduce((sum, i) => sum + i.budget_used, 0);

  // Calculate success rate
  const successfulTasks = trace.tasks.filter(t => t.success).length;
  const successRate = trace.tasks.length > 0 ? successfulTasks / trace.tasks.length : 0;

  return {
    goalId: goal.id,
    passed: errors.length === 0,
    errors,
    warnings,
    metrics: {
      duration_ms: trace.duration_ms,
      total_cost: trace.total_cost,
      total_tokens: trace.total_tokens,
      success_rate: successRate,
    },
    resolverChain,
    compositionEdges,
    impulseEvolution: {
      types_created: typesCreated,
      total_budget_used: totalBudgetUsed,
    },
  };
}

// Generate coverage report
function generateCoverageReport(
  goals: TestGoal[],
  results: Map<string, ValidationResult>
): void {
  console.log('\n=== COVERAGE REPORT ===\n');

  // Overall stats
  const totalGoals = goals.length;
  const executedGoals = results.size;
  const passedGoals = Array.from(results.values()).filter(r => r.passed).length;

  console.log(`Total test goals: ${totalGoals}`);
  console.log(`Executed goals: ${executedGoals} (${((executedGoals / totalGoals) * 100).toFixed(1)}%)`);
  console.log(`Passed goals: ${passedGoals} (${((passedGoals / executedGoals) * 100).toFixed(1)}%)`);
  console.log();

  // Category breakdown
  const categories = new Map<string, { total: number; executed: number; passed: number }>();
  for (const goal of goals) {
    const cat = categories.get(goal.category) || { total: 0, executed: 0, passed: 0 };
    cat.total++;
    categories.set(goal.category, cat);
  }

  for (const [goalId, result] of results) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) continue;

    const cat = categories.get(goal.category)!;
    cat.executed++;
    if (result.passed) cat.passed++;
  }

  console.log('Category Breakdown:');
  for (const [category, stats] of categories) {
    const execPercent = ((stats.executed / stats.total) * 100).toFixed(1);
    const passPercent = stats.executed > 0 ? ((stats.passed / stats.executed) * 100).toFixed(1) : '0.0';
    console.log(
      `  ${category.padEnd(20)} ${stats.executed}/${stats.total} executed (${execPercent}%), ${stats.passed} passed (${passPercent}%)`
    );
  }
  console.log();

  // Resolver coverage
  const resolverCoverage = new Map<string, number>();
  for (const result of results.values()) {
    for (const resolver of result.resolverChain) {
      resolverCoverage.set(resolver, (resolverCoverage.get(resolver) || 0) + 1);
    }
  }

  console.log('Resolver Coverage:');
  for (const [resolver, count] of Array.from(resolverCoverage.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${resolver.padEnd(30)} ${count} invocations`);
  }
  console.log();

  // Composition patterns
  const compositionPatterns = new Map<string, number>();
  for (const result of results.values()) {
    for (const edge of result.compositionEdges) {
      compositionPatterns.set(edge.pattern, (compositionPatterns.get(edge.pattern) || 0) + 1);
    }
  }

  if (compositionPatterns.size > 0) {
    console.log('Composition Patterns:');
    for (const [pattern, count] of Array.from(compositionPatterns.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pattern.padEnd(20)} ${count} occurrences`);
    }
    console.log();
  }

  // Impulse type coverage
  const impulseTypes = new Set<string>();
  for (const result of results.values()) {
    for (const type of result.impulseEvolution.types_created) {
      impulseTypes.add(type);
    }
  }

  console.log('Impulse Types Created:');
  console.log(`  ${Array.from(impulseTypes).join(', ')}`);
  console.log();

  // Performance metrics
  const durations = Array.from(results.values()).map(r => r.metrics.duration_ms);
  const costs = Array.from(results.values()).map(r => r.metrics.total_cost);
  const tokens = Array.from(results.values()).map(r => r.metrics.total_tokens);

  console.log('Performance Metrics:');
  console.log(`  Avg duration: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0)}ms`);
  console.log(`  Avg cost: $${(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(4)}`);
  console.log(`  Avg tokens: ${(tokens.reduce((a, b) => a + b, 0) / tokens.length).toFixed(0)}`);
  console.log();
}

// Print detailed results
function printDetailedResults(
  goals: TestGoal[],
  results: Map<string, ValidationResult>
): void {
  console.log('\n=== DETAILED RESULTS ===\n');

  for (const goal of goals) {
    const result = results.get(goal.id);
    if (!result) {
      console.log(`[SKIPPED] ${goal.id}`);
      console.log(`  Category: ${goal.category}`);
      console.log(`  No trace found\n`);
      continue;
    }

    const status = result.passed ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${goal.id}`);
    console.log(`  Category: ${goal.category}`);
    console.log(`  Description: ${goal.description}`);
    console.log(`  Resolver chain: ${result.resolverChain.join(' → ')}`);
    console.log(`  Duration: ${result.metrics.duration_ms}ms`);
    console.log(`  Cost: $${result.metrics.total_cost.toFixed(4)}`);
    console.log(`  Tokens: ${result.metrics.total_tokens}`);
    console.log(`  Success rate: ${(result.metrics.success_rate * 100).toFixed(1)}%`);

    if (result.compositionEdges.length > 0) {
      console.log(`  Composition edges: ${result.compositionEdges.length}`);
      for (const edge of result.compositionEdges) {
        console.log(`    ${edge.from_activity} → ${edge.to_activity} (${edge.pattern})`);
      }
    }

    if (result.impulseEvolution.types_created.length > 0) {
      console.log(`  Impulses created: ${result.impulseEvolution.types_created.join(', ')}`);
      console.log(`  Budget used: ${result.impulseEvolution.total_budget_used}`);
    }

    if (result.errors.length > 0) {
      console.log('  Errors:');
      for (const error of result.errors) {
        console.log(`    ❌ ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('  Warnings:');
      for (const warning of result.warnings) {
        console.log(`    ⚠️  ${warning}`);
      }
    }

    console.log();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const goalId = args[0];
  const showAll = args.includes('--all');
  const showSummary = args.includes('--summary');

  console.log('Loading test goals...');
  const goals = loadTestGoals();
  console.log(`Loaded ${goals.length} test goals\n`);

  console.log('Fetching traces from backend...');
  const allTraces = await fetchTraces();
  console.log(`Fetched ${allTraces.length} traces\n`);

  // Match traces to goals based on metadata
  const results = new Map<string, ValidationResult>();

  for (const trace of allTraces) {
    const matchedGoal = goals.find(g => {
      // Match by goal text in metadata
      if (trace.metadata?.goal) {
        const goalText = typeof g.goal === 'string' ? g.goal : JSON.stringify(g.goal);
        return goalText === trace.metadata.goal;
      }
      return false;
    });

    if (matchedGoal) {
      // Fetch composition edges for this trace
      const compositionEdges = await fetchCompositionEdges(trace.activity_id);
      trace.composition_edges = compositionEdges;

      const result = validateTrace(trace, matchedGoal);
      results.set(matchedGoal.id, result);
    }
  }

  // Filter by goal ID if specified
  let filteredGoals = goals;
  let filteredResults = results;

  if (goalId && !showAll) {
    filteredGoals = goals.filter(g => g.id === goalId);
    filteredResults = new Map(
      Array.from(results.entries()).filter(([id]) => id === goalId)
    );

    if (filteredGoals.length === 0) {
      console.error(`Error: Goal "${goalId}" not found`);
      process.exit(1);
    }
  }

  // Print results
  if (!showSummary) {
    printDetailedResults(filteredGoals, filteredResults);
  }

  generateCoverageReport(goals, results);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
