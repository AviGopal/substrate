#!/usr/bin/env bun
/**
 * Test Goal Executor
 *
 * Executes test goals through MiniBob and collects traces for validation.
 *
 * Usage:
 *   bun run execute-test-goals.ts [goal-id]
 *   bun run execute-test-goals.ts --all
 *   bun run execute-test-goals.ts --category simple
 *   bun run execute-test-goals.ts --dry-run
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// Types
interface TestGoal {
  id: string;
  category: string;
  goal: string | { targetState: Record<string, unknown> };
  expectedResolver: string;
  expectedApproach: string;
  expectedComplexity?: string;
  traceValidation: Record<string, unknown>;
  impulseState?: {
    impulses: Array<{ id: string; pointer: Record<string, unknown> }>;
  };
  setupRequired?: {
    createFile?: string;
    content?: string;
  };
  description: string;
}

interface ExecutionResult {
  goalId: string;
  success: boolean;
  duration_ms: number;
  traceId?: string;
  error?: string;
  output?: string;
}

// Configuration
const MINIBOB_PATH = join(import.meta.dir, '../index.ts');
const RESULTS_FILE = join(import.meta.dir, 'test-results.json');
const VERBOSE = process.env.VERBOSE === 'true';

// Load test goals
function loadTestGoals(): TestGoal[] {
  const goalsPath = join(import.meta.dir, 'test-goals.json');
  const content = readFileSync(goalsPath, 'utf-8');
  return JSON.parse(content);
}

// Execute a single goal through MiniBob
async function executeGoal(goal: TestGoal): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Prepare goal text
  const goalText = typeof goal.goal === 'string' ? goal.goal : JSON.stringify(goal.goal);

  // Setup if needed
  if (goal.setupRequired?.createFile && goal.setupRequired?.content) {
    const filePath = join(process.cwd(), goal.setupRequired.createFile);
    writeFileSync(filePath, goal.setupRequired.content);
    console.log(`  Setup: Created ${goal.setupRequired.createFile}`);
  }

  // Prepare impulse state if provided
  let impulseStateArg = '';
  if (goal.impulseState) {
    const impulseStateFile = join('/tmp', `impulse-state-${goal.id}.json`);
    writeFileSync(impulseStateFile, JSON.stringify(goal.impulseState, null, 2));
    impulseStateArg = `--impulse-state ${impulseStateFile}`;
  }

  // Execute MiniBob
  return new Promise((resolve) => {
    const args = [
      'run',
      MINIBOB_PATH,
      '--single',
      goalText,
      '--trace-metadata',
      JSON.stringify({
        test_goal_id: goal.id,
        test_category: goal.category,
        expected_resolver: goal.expectedResolver,
        expected_approach: goal.expectedApproach,
      }),
    ];

    if (impulseStateArg) {
      args.push(...impulseStateArg.split(' '));
    }

    const process = spawn('bun', args, {
      cwd: join(import.meta.dir, '..'),
      env: {
        ...Bun.env,
        MINIBOB_TRACE_ENABLED: 'true',
      },
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (VERBOSE) {
        console.log(text);
      }
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (VERBOSE) {
        console.error(text);
      }
    });

    process.on('close', (code) => {
      const duration = Date.now() - startTime;

      // Extract trace ID from output if available
      const traceMatch = stdout.match(/Trace ID: ([\w-]+)/);
      const traceId = traceMatch?.[1];

      if (code === 0) {
        resolve({
          goalId: goal.id,
          success: true,
          duration_ms: duration,
          traceId,
          output: stdout,
        });
      } else {
        resolve({
          goalId: goal.id,
          success: false,
          duration_ms: duration,
          traceId,
          error: stderr || stdout,
          output: stdout,
        });
      }
    });
  });
}

// Save results to file
function saveResults(results: ExecutionResult[]): void {
  const output = {
    timestamp: new Date().toISOString(),
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };

  writeFileSync(RESULTS_FILE, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${RESULTS_FILE}`);
}

// Print summary
function printSummary(results: ExecutionResult[]): void {
  console.log('\n=== EXECUTION SUMMARY ===\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Average duration: ${(totalDuration / results.length / 1000).toFixed(1)}s`);
  console.log();

  // Group by category
  const categories = new Map<string, { total: number; successful: number }>();
  const goals = loadTestGoals();

  for (const result of results) {
    const goal = goals.find(g => g.id === result.goalId);
    if (!goal) continue;

    const cat = categories.get(goal.category) || { total: 0, successful: 0 };
    cat.total++;
    if (result.success) cat.successful++;
    categories.set(goal.category, cat);
  }

  console.log('Category Breakdown:');
  for (const [category, stats] of categories) {
    const percent = ((stats.successful / stats.total) * 100).toFixed(1);
    console.log(`  ${category.padEnd(20)} ${stats.successful}/${stats.total} (${percent}%)`);
  }
  console.log();

  // Show failures
  if (failed.length > 0) {
    console.log('Failed Goals:');
    for (const result of failed) {
      console.log(`  ❌ ${result.goalId}`);
      if (result.error) {
        const errorPreview = result.error.split('\n').slice(0, 3).join('\n');
        console.log(`     ${errorPreview.replace(/\n/g, '\n     ')}`);
      }
    }
    console.log();
  }

  // Show trace IDs
  const withTraces = results.filter(r => r.traceId);
  if (withTraces.length > 0) {
    console.log(`Trace IDs collected: ${withTraces.length}/${results.length}`);
    console.log('Run analyze-traces.ts to validate results');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const goalId = args.find(a => !a.startsWith('--'));
  const runAll = args.includes('--all');
  const category = args.find(a => a.startsWith('--category'))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  console.log('Loading test goals...');
  let goals = loadTestGoals();
  console.log(`Loaded ${goals.length} test goals\n`);

  // Filter goals
  if (goalId && !runAll) {
    goals = goals.filter(g => g.id === goalId);
    if (goals.length === 0) {
      console.error(`Error: Goal "${goalId}" not found`);
      process.exit(1);
    }
  } else if (category) {
    goals = goals.filter(g => g.category === category);
    if (goals.length === 0) {
      console.error(`Error: No goals found for category "${category}"`);
      process.exit(1);
    }
  } else if (!runAll) {
    console.error('Error: Specify a goal ID, --category, or --all');
    console.error('\nUsage:');
    console.error('  bun run execute-test-goals.ts <goal-id>');
    console.error('  bun run execute-test-goals.ts --category simple');
    console.error('  bun run execute-test-goals.ts --all');
    process.exit(1);
  }

  console.log(`Selected ${goals.length} goals to execute\n`);

  if (dryRun) {
    console.log('Dry run - would execute:');
    for (const goal of goals) {
      console.log(`  [${goal.category}] ${goal.id}: ${goal.description}`);
    }
    return;
  }

  // Execute goals sequentially
  const results: ExecutionResult[] = [];

  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    console.log(`\n[${i + 1}/${goals.length}] Executing: ${goal.id}`);
    console.log(`  Category: ${goal.category}`);
    console.log(`  Description: ${goal.description}`);

    const result = await executeGoal(goal);
    results.push(result);

    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`  ${status} (${(result.duration_ms / 1000).toFixed(1)}s)`);

    if (result.traceId) {
      console.log(`  Trace ID: ${result.traceId}`);
    }

    // Brief delay between executions to avoid rate limits
    if (i < goals.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Save and print results
  saveResults(results);
  printSummary(results);

  // Exit with error if any failed
  const failedCount = results.filter(r => !r.success).length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
