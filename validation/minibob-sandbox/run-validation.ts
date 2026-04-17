#!/usr/bin/env bun
/**
 * Sandbox Validation Runner
 *
 * Runs validation test suite and collects execution traces for learning.
 * Tests the unified execution path with all resolvers.
 */

import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import type {
  ActivityExecution,
  ExecutionTrace,
} from "../src/types";

// ============================================================================
// Types
// ============================================================================

interface ValidationTest {
  id: string;
  name: string;
  description: string;
  type: "goal" | "activity" | "bootstrap";
  goal?: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  context?: Record<string, unknown>;
  expectedOutcomes: string[];
  validation: {
    requiredFiles?: string[];
    requiredPatterns?: Array<{ file: string; pattern: string }>;
    requireOutput?: boolean;
    allowFailure?: boolean;
    requireErrorTrace?: boolean;
    checkRibosomeExtraction?: boolean;
    checkThompsonMetadata?: boolean;
    checkMetadataUsage?: boolean;
  };
  expectedResolvers: string[];
  expectedDuration: string;
  priority: "high" | "medium" | "low";
  comment?: string;
}

interface ValidationResult {
  testId: string;
  success: boolean;
  duration: number;
  executionId?: string;
  traceId?: string;
  resolversUsed: string[];
  errors: string[];
  warnings: string[];
  metrics: {
    cost: number;
    tokens: { input: number; output: number };
  };
  outcomes: {
    expected: string[];
    achieved: string[];
    missing: string[];
  };
}

interface ValidationReport {
  timestamp: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  totalCost: number;
  results: ValidationResult[];
  summary: {
    byPriority: Record<string, { passed: number; failed: number }>;
    byResolver: Record<string, { count: number; successRate: number }>;
    traceCollection: {
      collected: number;
      submitted: number;
      failed: number;
    };
  };
}

interface SandboxConfig {
  environment: string;
  backend: {
    endpoint: string;
    apiKey: string;
  };
  llm: {
    provider: string;
    model: string;
    apiKey: string;
  };
  workingDirectory: string;
  traceCollection: {
    enabled: boolean;
    autoSubmit: boolean;
    includeResolverMetrics: boolean;
    includeStateSnapshots: boolean;
  };
  logging: {
    level: string;
    outputFile: string;
    includeTimestamps: boolean;
    includeResolverDetails: boolean;
  };
  discovery?: {
    enabled: boolean;
  };
  validation: {
    validateBeforeSubmit: boolean;
    requireSuccessfulCompletion: boolean;
    collectFailureTraces: boolean;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const SANDBOX_DIR = import.meta.dir;
const CONFIG_PATH = join(SANDBOX_DIR, "sandbox.config.json");
const TESTS_PATH = join(SANDBOX_DIR, "validation-tests.json");
const REPORTS_DIR = join(SANDBOX_DIR, "reports");
const LOGS_DIR = join(SANDBOX_DIR, "logs");

// ============================================================================
// Utilities
// ============================================================================

async function loadConfig(): Promise<SandboxConfig> {
  const file = Bun.file(CONFIG_PATH);
  let config = await file.json();

  // Replace environment variable placeholders
  const replaceEnvVars = (obj: any): any => {
    if (typeof obj === "string") {
      return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || "");
    }
    if (Array.isArray(obj)) {
      return obj.map(replaceEnvVars);
    }
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = replaceEnvVars(value);
      }
      return result;
    }
    return obj;
  };

  return replaceEnvVars(config);
}

async function loadTests(): Promise<ValidationTest[]> {
  const file = Bun.file(TESTS_PATH);
  return await file.json();
}

async function setupLogging(config: SandboxConfig): Promise<void> {
  mkdirSync(LOGS_DIR, { recursive: true });
  console.log(`Logging to: ${config.logging.outputFile}`);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ============================================================================
// Test Execution (Mock - Replace with actual MiniBob integration)
// ============================================================================

/**
 * Execute a single validation test
 * TODO: Integrate with actual MiniBob goal processor
 */
async function executeTest(
  test: ValidationTest,
  config: SandboxConfig,
): Promise<ValidationResult> {
  const startTime = Date.now();

  console.log(`\n▶ Running: ${test.name}`);
  console.log(`  ${test.description}`);

  try {
    // TODO: Replace with actual MiniBob execution
    // For now, this is a mock implementation
    const mockExecution = await mockExecuteGoal(test, config);

    const duration = Date.now() - startTime;

    // Validate outcomes
    const achieved = await validateOutcomes(test, mockExecution);
    const missing = test.expectedOutcomes.filter((o) => !achieved.includes(o));

    const success =
      missing.length === 0 || (test.validation.allowFailure || false);

    const result: ValidationResult = {
      testId: test.id,
      success,
      duration,
      executionId: mockExecution.id,
      traceId: mockExecution.executionTrace?.tasks[0]?.id,
      resolversUsed: extractResolversUsed(mockExecution),
      errors: success ? [] : [`Missing outcomes: ${missing.join(", ")}`],
      warnings: [],
      metrics: {
        cost: mockExecution.metrics?.cost || 0,
        tokens: mockExecution.metrics?.totalTokens || { input: 0, output: 0 },
      },
      outcomes: {
        expected: test.expectedOutcomes,
        achieved,
        missing,
      },
    };

    // Log result
    if (success) {
      console.log(`  ✓ PASSED (${formatDuration(duration)})`);
    } else {
      console.log(`  ✗ FAILED (${formatDuration(duration)})`);
      result.errors.forEach((err) => console.log(`    - ${err}`));
    }

    // Submit trace if configured
    if (config.traceCollection.autoSubmit && mockExecution.executionTrace) {
      await submitTrace(mockExecution.executionTrace, config);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`  ✗ ERROR (${formatDuration(duration)})`);
    console.log(`    ${error instanceof Error ? error.message : String(error)}`);

    return {
      testId: test.id,
      success: false,
      duration,
      resolversUsed: [],
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      metrics: { cost: 0, tokens: { input: 0, output: 0 } },
      outcomes: { expected: test.expectedOutcomes, achieved: [], missing: test.expectedOutcomes },
    };
  }
}

/**
 * Mock goal execution - Replace with actual MiniBob integration
 */
async function mockExecuteGoal(
  test: ValidationTest,
  config: SandboxConfig,
): Promise<ActivityExecution> {
  // TODO: Call actual MiniBob goal processor here
  // For now, return a mock execution
  return {
    id: `exec_${Date.now()}_mock`,
    templateId: test.templateId || "improvised",
    status: "completed",
    variables: test.variables || {},
    impulses: [],
    taskResults: [],
    startedAt: Date.now(),
    completedAt: Date.now() + 1000,
    metrics: {
      duration: 1000,
      cost: 0.01,
      totalTokens: { input: 100, output: 50 },
    },
    executionTrace: {
      tasks: [
        {
          id: "task_1",
          description: test.goal || "Mock task",
          actualPrompt: test.goal || "Mock task",
          toolCalls: [],
          response: "Mock response",
          result: { status: "success" },
        },
      ],
      impulsesCreated: [],
      filesModified: [],
    },
  };
}

async function validateOutcomes(
  test: ValidationTest,
  execution: ActivityExecution,
): Promise<string[]> {
  // TODO: Implement actual outcome validation
  // For now, assume all outcomes achieved
  return test.expectedOutcomes;
}

function extractResolversUsed(execution: ActivityExecution): string[] {
  // TODO: Extract actual resolvers from execution trace
  return ["MockResolver"];
}

async function submitTrace(
  trace: ExecutionTrace,
  config: SandboxConfig,
): Promise<void> {
  // TODO: Submit trace to backend
  console.log(`  📊 Trace submitted to ${config.backend.endpoint}`);
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(results: ValidationResult[]): ValidationReport {
  const now = Date.now();
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const totalCost = results.reduce((sum, r) => sum + r.metrics.cost, 0);

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  // By priority
  const byPriority: Record<string, { passed: number; failed: number }> = {};
  // By resolver
  const resolverStats: Record<string, { successes: number; total: number }> =
    {};

  results.forEach((r) => {
    // Count resolvers
    r.resolversUsed.forEach((resolver) => {
      if (!resolverStats[resolver]) {
        resolverStats[resolver] = { successes: 0, total: 0 };
      }
      resolverStats[resolver].total++;
      if (r.success) resolverStats[resolver].successes++;
    });
  });

  const byResolver: Record<string, { count: number; successRate: number }> = {};
  Object.entries(resolverStats).forEach(([resolver, stats]) => {
    byResolver[resolver] = {
      count: stats.total,
      successRate: stats.total > 0 ? stats.successes / stats.total : 0,
    };
  });

  return {
    timestamp: now,
    totalTests: results.length,
    passed,
    failed,
    skipped: 0,
    totalDuration,
    totalCost,
    results,
    summary: {
      byPriority,
      byResolver,
      traceCollection: {
        collected: results.filter((r) => r.traceId).length,
        submitted: results.filter((r) => r.traceId).length,
        failed: 0,
      },
    },
  };
}

async function saveReport(report: ValidationReport): Promise<void> {
  mkdirSync(REPORTS_DIR, { recursive: true });

  const timestamp = new Date(report.timestamp).toISOString().replace(/:/g, "-");
  const reportPath = join(REPORTS_DIR, `validation-report-${timestamp}.json`);

  await Bun.write(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Also save as latest
  const latestPath = join(REPORTS_DIR, "validation-report.json");
  await Bun.write(latestPath, JSON.stringify(report, null, 2));
}

function printSummary(report: ValidationReport): void {
  console.log("\n========================================");
  console.log("Validation Summary");
  console.log("========================================");
  console.log(`Total Tests:    ${report.totalTests}`);
  console.log(`Passed:         ${report.passed} ✓`);
  console.log(`Failed:         ${report.failed} ✗`);
  console.log(`Duration:       ${formatDuration(report.totalDuration)}`);
  console.log(`Total Cost:     $${report.totalCost.toFixed(4)}`);
  console.log("");
  console.log("Trace Collection:");
  console.log(
    `  Collected:    ${report.summary.traceCollection.collected}`,
  );
  console.log(
    `  Submitted:    ${report.summary.traceCollection.submitted}`,
  );
  console.log("");
  console.log("Resolver Usage:");
  Object.entries(report.summary.byResolver)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([resolver, stats]) => {
      const successRate = (stats.successRate * 100).toFixed(1);
      console.log(
        `  ${resolver.padEnd(30)} ${stats.count} executions (${successRate}% success)`,
      );
    });
  console.log("========================================\n");
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("MiniBob Sandbox Validation Runner");
  console.log("==================================\n");

  try {
    // Load configuration
    const config = await loadConfig();
    console.log(`Environment: ${config.environment}`);
    console.log(`Backend:     ${config.backend.endpoint}`);
    console.log(`Model:       ${config.llm.model}`);

    // Setup logging
    await setupLogging(config);

    // Load tests
    const tests = await loadTests();
    console.log(`\nLoaded ${tests.length} validation tests`);

    // Filter by priority if specified
    const priorityFilter = process.argv[2]; // e.g., "high"
    const filteredTests = priorityFilter
      ? tests.filter((t) => t.priority === priorityFilter)
      : tests;

    if (filteredTests.length < tests.length) {
      console.log(
        `Filtered to ${filteredTests.length} tests (priority: ${priorityFilter})`,
      );
    }

    // Execute tests
    const results: ValidationResult[] = [];
    for (const test of filteredTests) {
      const result = await executeTest(test, config);
      results.push(result);
    }

    // Generate report
    const report = generateReport(results);
    await saveReport(report);

    // Print summary
    printSummary(report);

    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Fatal error:");
    console.error(
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main();
