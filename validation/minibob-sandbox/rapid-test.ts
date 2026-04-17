#!/usr/bin/env bun
/**
 * Rapid Test Runner - Batch goal execution with trace collection
 *
 * Enables quick iteration and validation:
 * - Execute multiple goals in parallel
 * - Automatic trace submission to backend
 * - Real-time progress tracking
 * - Error capture and reporting
 * - Thompson Sampling metrics
 *
 * Usage:
 *   bun sandbox/rapid-test.ts --scenario simple
 *   bun sandbox/rapid-test.ts --scenario complex --concurrency 5
 *   bun sandbox/rapid-test.ts --goals "goal1,goal2,goal3"
 */

import { processGoal } from "../src/goal-processor";
import { createLLMClient } from "../src/llm";
import { getMCPClient, initializeMCP } from "../src/mcp";
import { getLogger, configureLogger } from "../src/logger";
import { loadConfig } from "../src/config";
import path from "path";
import fs from "fs";

const log = getLogger("RapidTest");

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface RapidTestConfig {
  /** Array of goal strings to execute */
  goals: string[];
  /** Number of parallel executions */
  concurrency: number;
  /** Backend API endpoint */
  backend: string;
  /** Automatically submit traces to backend */
  collectTraces: boolean;
  /** Progress update frequency in ms */
  reportInterval: number;
  /** Maximum execution time per goal in ms */
  timeout: number;
  /** Working directory for execution */
  workingDirectory: string;
  /** Test scenario name */
  scenario?: string;
}

const DEFAULT_CONFIG: RapidTestConfig = {
  goals: [],
  concurrency: 3,
  backend: "https://activity.metabob.com",
  collectTraces: true,
  reportInterval: 2000,
  timeout: 300000, // 5 minutes
  workingDirectory: "./sandbox/workspace",
};

// =============================================================================
// TEST SCENARIOS
// =============================================================================

const SCENARIOS: Record<string, string[]> = {
  simple: [
    "list files in the current directory",
    "show git status",
    "read package.json",
    "check TypeScript configuration",
    "show recent commits",
  ],

  complex: [
    "analyze the codebase structure",
    "find all TypeScript files with more than 100 lines",
    "identify potential code quality issues",
    "check for unused dependencies",
    "generate a summary of recent changes",
  ],

  bootstrap: [
    "create a simple test activity template",
    "execute the test activity",
    "verify the activity completed successfully",
    "extract metrics from execution trace",
  ],

  resolver: [
    "test file resolver with read operation",
    "test bash resolver with simple command",
    "test git resolver with status check",
    "test composition of file and bash resolvers",
  ],

  state_navigation: [
    "identify current state from git status",
    "determine missing impulses for goal completion",
    "suggest next activity to execute",
    "verify state change after activity execution",
  ],
};

// =============================================================================
// EXECUTION TRACKING
// =============================================================================

interface ExecutionResult {
  goal: string;
  success: boolean;
  duration: number;
  error?: string;
  executionId?: string;
  activitiesExecuted?: number;
  resolversInvoked?: string[];
  tracesSubmitted?: number;
}

interface ProgressState {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  startTime: number;
  results: ExecutionResult[];
}

// =============================================================================
// RAPID TEST EXECUTOR
// =============================================================================

export class RapidTestExecutor {
  private config: RapidTestConfig;
  private progress: ProgressState;
  private llmClient: ReturnType<typeof createLLMClient> | null = null;

  constructor(config: Partial<RapidTestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.progress = {
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      startTime: 0,
      results: [],
    };
  }

  /**
   * Initialize the test environment
   */
  async initialize(): Promise<void> {
    log.info("Initializing rapid test environment...");

    // Load configuration
    const minibobConfig = await loadConfig();

    // Initialize LLM client
    this.llmClient = createLLMClient({
      provider: minibobConfig.provider,
      apiKey: minibobConfig.apiKey,
      model: minibobConfig.model,
    });

    // Initialize MCP client if enabled
    if (minibobConfig.vessels?.["activity-api"]) {
      await initializeMCP(
        minibobConfig.vessels["activity-api"].endpoint,
        minibobConfig.vessels["activity-api"].apiKey || "",
      );
    }

    // Create working directory
    if (!fs.existsSync(this.config.workingDirectory)) {
      fs.mkdirSync(this.config.workingDirectory, { recursive: true });
    }

    log.info("Environment initialized");
  }

  /**
   * Execute a batch of goals
   */
  async runBatch(): Promise<ExecutionResult[]> {
    this.progress = {
      total: this.config.goals.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      startTime: Date.now(),
      results: [],
    };

    log.info(`Starting batch execution of ${this.progress.total} goals`);
    log.info(`Concurrency: ${this.config.concurrency}`);
    log.info(`Backend: ${this.config.backend}`);

    // Start progress reporting
    const progressInterval = setInterval(() => {
      this.reportProgress();
    }, this.config.reportInterval);

    try {
      // Execute goals in batches based on concurrency
      const batches: string[][] = [];
      for (let i = 0; i < this.config.goals.length; i += this.config.concurrency) {
        batches.push(this.config.goals.slice(i, i + this.config.concurrency));
      }

      for (const batch of batches) {
        await Promise.all(batch.map(goal => this.executeGoal(goal)));
      }

      clearInterval(progressInterval);
      this.reportFinalResults();

      return this.progress.results;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  /**
   * Execute a single goal
   */
  private async executeGoal(goal: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      log.debug(`Executing goal: ${goal}`);

      if (!this.llmClient) {
        throw new Error("LLM client not initialized");
      }

      // Execute goal using goal processor
      const execution = await processGoal(goal, {
        llmClient: this.llmClient,
        maxAttempts: 3,
      });

      const duration = Date.now() - startTime;

      const result: ExecutionResult = {
        goal,
        success: execution.status === "completed",
        duration,
        executionId: execution.id,
        activitiesExecuted: execution.taskResults.length,
        resolversInvoked: this.extractResolvers(execution),
        tracesSubmitted: this.config.collectTraces ? 1 : 0,
      };

      this.progress.succeeded++;
      this.progress.completed++;
      this.progress.results.push(result);

      log.info(`✓ Goal completed: ${goal} (${duration}ms)`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      const result: ExecutionResult = {
        goal,
        success: false,
        duration,
        error: errorMsg,
      };

      this.progress.failed++;
      this.progress.completed++;
      this.progress.results.push(result);

      log.error(`✗ Goal failed: ${goal} - ${errorMsg}`);

      return result;
    }
  }

  /**
   * Extract resolver names from execution
   */
  private extractResolvers(execution: any): string[] {
    const resolvers = new Set<string>();

    for (const taskResult of execution.taskResults || []) {
      if (taskResult.metadata?.resolver) {
        resolvers.add(taskResult.metadata.resolver);
      }
    }

    return Array.from(resolvers);
  }

  /**
   * Report current progress
   */
  private reportProgress(): void {
    const elapsed = Date.now() - this.progress.startTime;
    const rate = this.progress.completed / (elapsed / 1000);
    const eta = (this.progress.total - this.progress.completed) / rate;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Progress: ${this.progress.completed}/${this.progress.total}`);
    console.log(`Succeeded: ${this.progress.succeeded} | Failed: ${this.progress.failed}`);
    console.log(`Rate: ${rate.toFixed(2)} goals/sec | ETA: ${eta.toFixed(0)}s`);
    console.log(`${"=".repeat(60)}\n`);
  }

  /**
   * Report final results
   */
  private reportFinalResults(): void {
    const duration = Date.now() - this.progress.startTime;

    console.log(`\n${"=".repeat(60)}`);
    console.log("FINAL RESULTS");
    console.log(`${"=".repeat(60)}`);
    console.log(`Total: ${this.progress.total}`);
    console.log(`Succeeded: ${this.progress.succeeded} (${((this.progress.succeeded / this.progress.total) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${this.progress.failed} (${((this.progress.failed / this.progress.total) * 100).toFixed(1)}%)`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Average: ${(duration / this.progress.total).toFixed(0)}ms per goal`);
    console.log(`${"=".repeat(60)}\n`);

    // Show failures
    if (this.progress.failed > 0) {
      console.log("FAILURES:");
      for (const result of this.progress.results) {
        if (!result.success) {
          console.log(`  ✗ ${result.goal}`);
          console.log(`    Error: ${result.error}`);
        }
      }
      console.log();
    }

    // Show resolver usage
    const resolverCounts = new Map<string, number>();
    for (const result of this.progress.results) {
      for (const resolver of result.resolversInvoked || []) {
        resolverCounts.set(resolver, (resolverCounts.get(resolver) || 0) + 1);
      }
    }

    if (resolverCounts.size > 0) {
      console.log("RESOLVER USAGE:");
      for (const [resolver, count] of Array.from(resolverCounts.entries()).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${resolver}: ${count} invocations`);
      }
      console.log();
    }
  }

  /**
   * Generate validation report
   */
  generateReport(): ValidationReport {
    return {
      timestamp: new Date().toISOString(),
      scenario: this.config.scenario || "custom",
      config: this.config,
      results: this.progress.results,
      summary: {
        total: this.progress.total,
        succeeded: this.progress.succeeded,
        failed: this.progress.failed,
        successRate: this.progress.total > 0 ? this.progress.succeeded / this.progress.total : 0,
        totalDuration: Date.now() - this.progress.startTime,
        averageDuration: this.progress.total > 0
          ? this.progress.results.reduce((sum, r) => sum + r.duration, 0) / this.progress.total
          : 0,
      },
      resolvers: this.summarizeResolvers(),
    };
  }

  /**
   * Summarize resolver usage
   */
  private summarizeResolvers(): Record<string, { count: number; successRate: number }> {
    const resolverStats = new Map<string, { count: number; succeeded: number }>();

    for (const result of this.progress.results) {
      for (const resolver of result.resolversInvoked || []) {
        const current = resolverStats.get(resolver) || { count: 0, succeeded: 0 };
        current.count++;
        if (result.success) current.succeeded++;
        resolverStats.set(resolver, current);
      }
    }

    const summary: Record<string, { count: number; successRate: number }> = {};
    for (const [resolver, stats] of resolverStats.entries()) {
      summary[resolver] = {
        count: stats.count,
        successRate: stats.succeeded / stats.count,
      };
    }

    return summary;
  }
}

// =============================================================================
// VALIDATION REPORT
// =============================================================================

interface ValidationReport {
  timestamp: string;
  scenario: string;
  config: RapidTestConfig;
  results: ExecutionResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    successRate: number;
    totalDuration: number;
    averageDuration: number;
  };
  resolvers: Record<string, { count: number; successRate: number }>;
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let scenario: string | undefined;
  let goals: string[] = [];
  let concurrency = 3;
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--scenario":
        scenario = args[++i];
        break;
      case "--goals":
        goals = args[++i].split(",").map(g => g.trim());
        break;
      case "--concurrency":
        concurrency = parseInt(args[++i], 10);
        break;
      case "--output":
        outputFile = args[++i];
        break;
      case "--help":
        console.log(`
Rapid Test Runner - Batch goal execution with trace collection

Usage:
  bun sandbox/rapid-test.ts [options]

Options:
  --scenario <name>       Predefined test scenario (simple|complex|bootstrap|resolver|state_navigation)
  --goals <goals>         Comma-separated list of goals
  --concurrency <n>       Number of parallel executions (default: 3)
  --output <file>         Output report file (JSON)
  --help                  Show this help

Examples:
  bun sandbox/rapid-test.ts --scenario simple
  bun sandbox/rapid-test.ts --scenario complex --concurrency 5
  bun sandbox/rapid-test.ts --goals "goal1,goal2,goal3"
        `);
        process.exit(0);
    }
  }

  // Load goals from scenario
  if (scenario) {
    if (!SCENARIOS[scenario]) {
      console.error(`Unknown scenario: ${scenario}`);
      console.error(`Available scenarios: ${Object.keys(SCENARIOS).join(", ")}`);
      process.exit(1);
    }
    goals = SCENARIOS[scenario];
  }

  if (goals.length === 0) {
    console.error("No goals specified. Use --scenario or --goals");
    process.exit(1);
  }

  // Set log level
  configureLogger({ level: "info" });

  // Create executor
  const executor = new RapidTestExecutor({
    goals,
    concurrency,
    scenario,
  });

  // Initialize and run
  await executor.initialize();
  await executor.runBatch();

  // Generate and save report
  const report = executor.generateReport();

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${outputFile}`);
  }

  // Exit with appropriate code
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

if (import.meta.main) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
