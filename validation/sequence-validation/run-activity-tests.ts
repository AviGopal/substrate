#!/usr/bin/env bun
/**
 * Activity-Based Sequence Validation
 *
 * Executes validation activities through MiniBob's activity executor
 * to validate that the system works as documented in sequence diagrams.
 */

import { parseArgs } from "util";
import { existsSync } from "fs";
import { resolve } from "path";

interface ActivityExecutionResult {
  activityId: string;
  status: "completed" | "failed";
  duration: number;
  trace: {
    executionId: string;
    tasks: Array<{
      id: string;
      status: string;
      resolver?: {
        name: string;
        inputShapes: string[];
        outputShapes: string[];
      };
    }>;
    metadata?: any;
  };
  validation: {
    passed: boolean;
    errors: string[];
    sequenceValidated: string;
    resolversExercised: string[];
  };
}

const ACTIVITIES = [
  "01-validate-activity-selection",
  "02-validate-impulse-resolution",
  "03-validate-resolver-processing",
  "04-validate-improvisation",
  "05-validate-hooks",
];

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      activity: { type: "string" },
      verbose: { type: "boolean", default: false },
      backend: { type: "string", default: "https://activity.metabob.com" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  console.log("🧪 MiniBob Sequence Validation (Activity-Based)\n");
  console.log(`Backend: ${values.backend}`);
  console.log(`Mode: Activity Execution (Real Resolvers)\n`);

  const activitiesToRun = values.activity
    ? [values.activity]
    : ACTIVITIES;

  const results: ActivityExecutionResult[] = [];

  for (const activityId of activitiesToRun) {
    const result = await runValidationActivity(activityId, values as any);
    results.push(result);
  }

  printSummary(results);

  const failed = results.filter(r => !r.validation.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

async function runValidationActivity(
  activityId: string,
  options: any
): Promise<ActivityExecutionResult> {
  const activityFile = resolve(__dirname, "activities", `${activityId}.json`);

  if (!existsSync(activityFile)) {
    console.log(`⚠️  ${activityId}: Activity file not found`);
    return {
      activityId,
      status: "failed",
      duration: 0,
      trace: { executionId: "", tasks: [] },
      validation: {
        passed: false,
        errors: ["Activity file not found"],
        sequenceValidated: activityId,
        resolversExercised: [],
      },
    };
  }

  console.log(`\n📋 Executing ${activityId}...`);

  const startTime = Date.now();

  try {
    // Load activity template
    const template = await Bun.file(activityFile).json();

    console.log(`  Activity: ${template.name}`);
    console.log(`  Tasks: ${template.tasks.length}`);
    console.log(`  Resolvers: ${template.metadata?.exercisedResolvers?.join(", ") || "unknown"}`);

    // Execute activity through MiniBob
    const result = await executeActivity(template, options);

    const duration = Date.now() - startTime;

    // Validate execution trace
    const validation = validateTrace(result.trace, template);

    if (validation.passed) {
      console.log(`✅ ${activityId}: Validation passed (${duration}ms)`);
    } else {
      console.error(`❌ ${activityId}: Validation failed`);
      for (const error of validation.errors) {
        console.error(`   - ${error}`);
      }
    }

    return {
      activityId,
      status: result.status,
      duration,
      trace: result.trace,
      validation,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${activityId}: Execution error`);
    console.error(`   ${error.message}`);

    return {
      activityId,
      status: "failed",
      duration,
      trace: { executionId: "", tasks: [] },
      validation: {
        passed: false,
        errors: [error.message],
        sequenceValidated: activityId,
        resolversExercised: [],
      },
    };
  }
}

async function executeActivity(template: any, options: any): Promise<any> {
  // Import the MiniBob executor integration
  const { executeWithMiniBob } = await import("./execute-with-minibob.ts");

  // Execute activity through MiniBob
  const result = await executeWithMiniBob(template, {});

  // Return result in expected format
  return result;
}

function validateTrace(trace: any, template: any): {
  passed: boolean;
  errors: string[];
  sequenceValidated: string;
  resolversExercised: string[];
} {
  const errors: string[] = [];
  const exercisedResolvers: string[] = [];

  // Validate all tasks executed
  if (trace.tasks.length !== template.tasks.length) {
    errors.push(
      `Task count mismatch: expected ${template.tasks.length}, got ${trace.tasks.length}`
    );
  }

  // Validate all expected resolvers were exercised
  const expectedResolvers = template.metadata?.exercisedResolvers || [];
  for (const task of trace.tasks) {
    if (task.resolver) {
      exercisedResolvers.push(task.resolver.name);
    }
  }

  for (const expected of expectedResolvers) {
    if (!exercisedResolvers.includes(expected)) {
      errors.push(`Expected resolver not exercised: ${expected}`);
    }
  }

  // Validate task dependencies were respected
  const executedTasks = new Set<string>();
  for (const task of trace.tasks) {
    const templateTask = template.tasks.find((t: any) => t.id === task.id);
    if (templateTask?.dependencies) {
      for (const dep of templateTask.dependencies) {
        if (!executedTasks.has(dep)) {
          errors.push(
            `Dependency violation: ${task.id} executed before ${dep}`
          );
        }
      }
    }
    executedTasks.add(task.id);
  }

  return {
    passed: errors.length === 0,
    errors,
    sequenceValidated: template.metadata?.validatesSequence || "unknown",
    resolversExercised: [...new Set(exercisedResolvers)],
  };
}

function printSummary(results: ActivityExecutionResult[]) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Validation Summary");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.validation.passed).length;
  const failed = results.filter(r => !r.validation.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal Activities: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏱️  Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log("❌ Failures:\n");
    for (const result of results) {
      if (!result.validation.passed) {
        console.log(`  ${result.activityId}:`);
        for (const error of result.validation.errors) {
          console.log(`    - ${error}`);
        }
      }
    }
    console.log();
  }

  console.log("Resolvers Exercised:");
  const allResolvers = new Set<string>();
  for (const result of results) {
    for (const resolver of result.validation.resolversExercised) {
      allResolvers.add(resolver);
    }
  }
  for (const resolver of allResolvers) {
    console.log(`  - ${resolver}`);
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

function printHelp() {
  console.log(`
MiniBob Activity-Based Sequence Validation

Usage:
  bun run-activity-tests.ts [options]

Options:
  --activity <id>      Run specific validation activity
  --verbose            Enable verbose output
  --backend <url>      Backend URL (default: https://activity.metabob.com)
  --help               Show this help message

Examples:
  bun run-activity-tests.ts
  bun run-activity-tests.ts --activity 01-validate-activity-selection --verbose

Available Activities:
  ${ACTIVITIES.map(a => `  - ${a}`).join("\n")}
`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
