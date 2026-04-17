#!/usr/bin/env bun

/**
 * Trace Format Validator
 *
 * Validates that execution traces from the unified path include all required metadata:
 * - Resolver invocations (name, duration, inputs, outputs)
 * - Impulse state snapshots (before, after)
 * - Composition metadata
 * - State transitions (for StateNavigator)
 * - Thompson Sampling context
 * - Budget tracking
 */

import type { ActivityExecution, ExecutionTrace, ExecutedTask } from "../src/types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, unknown>;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateResolverInvocations(trace: ExecutionTrace): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!trace.tasks || trace.tasks.length === 0) {
    warnings.push("No tasks in execution trace");
    return { valid: true, errors, warnings, details: {} };
  }

  let resolverTaskCount = 0;
  const resolverTypes = new Set<string>();

  for (const task of trace.tasks) {
    // Check if task has resolver metadata
    if (!task.result?.metadata?.resolver) {
      warnings.push(`Task ${task.id} has no resolver metadata`);
      continue;
    }

    resolverTaskCount++;
    resolverTypes.add(task.result.metadata.resolver as string);

    // Validate resolver metadata structure
    const resolver = task.result.metadata.resolver;
    if (typeof resolver !== "string") {
      errors.push(`Task ${task.id}: resolver must be string, got ${typeof resolver}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      resolverTaskCount,
      resolverTypes: Array.from(resolverTypes)
    }
  };
}

function validateImpulseStateSnapshots(trace: ExecutionTrace): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for before/after snapshots
  if (!trace.beforeSnapshot) {
    warnings.push("Missing beforeSnapshot");
  } else {
    if (!trace.beforeSnapshot.timestamp) {
      errors.push("beforeSnapshot missing timestamp");
    }
    if (!trace.beforeSnapshot.workingDirectory) {
      errors.push("beforeSnapshot missing workingDirectory");
    }
    if (!trace.beforeSnapshot.files) {
      errors.push("beforeSnapshot missing files");
    }
  }

  if (!trace.afterSnapshot) {
    warnings.push("Missing afterSnapshot");
  } else {
    if (!trace.afterSnapshot.timestamp) {
      errors.push("afterSnapshot missing timestamp");
    }
    if (!trace.afterSnapshot.workingDirectory) {
      errors.push("afterSnapshot missing workingDirectory");
    }
    if (!trace.afterSnapshot.files) {
      errors.push("afterSnapshot missing files");
    }
  }

  // Check for available shapes
  const beforeShapes = trace.beforeSnapshot?.availableShapes || [];
  const afterShapes = trace.afterSnapshot?.availableShapes || [];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      beforeShapes,
      afterShapes,
      shapesAdded: afterShapes.filter(s => !beforeShapes.includes(s)),
      hasSnapshots: !!trace.beforeSnapshot && !!trace.afterSnapshot
    }
  };
}

function validateCompositionMetadata(execution: ActivityExecution): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!execution.composition) {
    warnings.push("No composition metadata (may not be a composed execution)");
    return { valid: true, errors, warnings, details: { hasComposition: false } };
  }

  if (execution.composition.depth === undefined) {
    errors.push("Composition missing depth");
  }

  if (!execution.composition.compositionChain) {
    errors.push("Composition missing compositionChain");
  } else if (!Array.isArray(execution.composition.compositionChain)) {
    errors.push("compositionChain must be array");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      hasComposition: true,
      depth: execution.composition?.depth,
      chainLength: execution.composition?.compositionChain?.length,
      parentExecutionId: execution.composition?.parentExecutionId
    }
  };
}

function validateStateTransitions(trace: ExecutionTrace): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!trace.stateDelta) {
    warnings.push("No stateDelta (no file changes)");
    return { valid: true, errors, warnings, details: { hasStateDelta: false } };
  }

  if (!Array.isArray(trace.stateDelta.created)) {
    errors.push("stateDelta.created must be array");
  }

  if (!Array.isArray(trace.stateDelta.modified)) {
    errors.push("stateDelta.modified must be array");
  }

  if (!Array.isArray(trace.stateDelta.deleted)) {
    errors.push("stateDelta.deleted must be array");
  }

  if (trace.stateDelta.totalChanges === undefined) {
    errors.push("stateDelta missing totalChanges");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      hasStateDelta: true,
      totalChanges: trace.stateDelta.totalChanges,
      created: trace.stateDelta.created?.length || 0,
      modified: trace.stateDelta.modified?.length || 0,
      deleted: trace.stateDelta.deleted?.length || 0
    }
  };
}

function validateThompsonSamplingContext(execution: ActivityExecution): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for template ID (required for Thompson Sampling)
  if (!execution.templateId) {
    errors.push("Missing templateId");
  }

  // Check for metrics (required for Thompson updates)
  if (!execution.metrics) {
    errors.push("Missing metrics");
  } else {
    if (execution.metrics.duration === undefined) {
      errors.push("metrics missing duration");
    }
    if (execution.metrics.cost === undefined) {
      errors.push("metrics missing cost");
    }
    if (!execution.metrics.totalTokens) {
      errors.push("metrics missing totalTokens");
    }
  }

  // Check for status (required for Thompson updates)
  if (!execution.status) {
    errors.push("Missing status");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      hasTemplateId: !!execution.templateId,
      hasMetrics: !!execution.metrics,
      status: execution.status,
      duration: execution.metrics?.duration,
      cost: execution.metrics?.cost
    }
  };
}

function validateBudgetTracking(execution: ActivityExecution): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!execution.impulses || execution.impulses.length === 0) {
    warnings.push("No impulses (no budget tracking needed)");
    return { valid: true, errors, warnings, details: { hasImpulses: false } };
  }

  let budgetedImpulses = 0;
  let loadedImpulses = 0;

  for (const impulse of execution.impulses) {
    if (impulse.budget === undefined) {
      warnings.push(`Impulse ${impulse.id} missing budget`);
    } else {
      budgetedImpulses++;
    }

    if (impulse.loaded) {
      loadedImpulses++;

      if (!impulse.tokenCount) {
        warnings.push(`Loaded impulse ${impulse.id} missing tokenCount`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      hasImpulses: true,
      totalImpulses: execution.impulses.length,
      budgetedImpulses,
      loadedImpulses
    }
  };
}

function validateGitState(execution: ActivityExecution): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!execution.gitState) {
    warnings.push("No gitState (may not be in git repo)");
    return { valid: true, errors, warnings, details: { hasGitState: false } };
  }

  if (!execution.gitState.branch) {
    errors.push("gitState missing branch");
  }

  if (!execution.gitState.commit) {
    errors.push("gitState missing commit");
  }

  if (execution.gitState.dirty === undefined) {
    errors.push("gitState missing dirty flag");
  }

  if (!Array.isArray(execution.gitState.changedFiles)) {
    errors.push("gitState.changedFiles must be array");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      hasGitState: true,
      branch: execution.gitState.branch,
      commit: execution.gitState.commit?.substring(0, 7),
      dirty: execution.gitState.dirty,
      changedFiles: execution.gitState.changedFiles?.length || 0
    }
  };
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

export function validateTraceFormat(execution: ActivityExecution): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  // Validate execution structure
  if (!execution.id) {
    errors.push("Missing execution ID");
  }

  if (!execution.executionTrace) {
    errors.push("Missing execution trace");
    return {
      valid: false,
      errors,
      warnings,
      details: { hasTrace: false }
    };
  }

  const trace = execution.executionTrace;

  // Run all validations
  const validations = [
    { name: "resolverInvocations", fn: () => validateResolverInvocations(trace) },
    { name: "impulseStateSnapshots", fn: () => validateImpulseStateSnapshots(trace) },
    { name: "compositionMetadata", fn: () => validateCompositionMetadata(execution) },
    { name: "stateTransitions", fn: () => validateStateTransitions(trace) },
    { name: "thompsonSamplingContext", fn: () => validateThompsonSamplingContext(execution) },
    { name: "budgetTracking", fn: () => validateBudgetTracking(execution) },
    { name: "gitState", fn: () => validateGitState(execution) }
  ];

  for (const validation of validations) {
    const result = validation.fn();

    errors.push(...result.errors.map(e => `[${validation.name}] ${e}`));
    warnings.push(...result.warnings.map(w => `[${validation.name}] ${w}`));
    details[validation.name] = result.details;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: {
      executionId: execution.id,
      templateId: execution.templateId,
      status: execution.status,
      validations: details
    }
  };
}

// =============================================================================
// CLI INTERFACE
// =============================================================================

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: validate-trace-format.ts <trace-file.json>");
    console.error("       validate-trace-format.ts --stdin");
    process.exit(1);
  }

  let executionData: string;

  if (args[0] === "--stdin") {
    // Read from stdin
    executionData = await Bun.stdin.text();
  } else {
    // Read from file
    const file = Bun.file(args[0]);
    executionData = await file.text();
  }

  try {
    const execution: ActivityExecution = JSON.parse(executionData);
    const result = validateTraceFormat(execution);

    console.log("\n=== TRACE FORMAT VALIDATION ===\n");
    console.log(`Execution ID: ${execution.id}`);
    console.log(`Template ID: ${execution.templateId || "N/A"}`);
    console.log(`Status: ${execution.status}`);
    console.log();

    if (result.errors.length > 0) {
      console.error("❌ ERRORS:");
      result.errors.forEach(e => console.error(`  - ${e}`));
      console.log();
    }

    if (result.warnings.length > 0) {
      console.warn("⚠️  WARNINGS:");
      result.warnings.forEach(w => console.warn(`  - ${w}`));
      console.log();
    }

    console.log("📊 DETAILS:");
    console.log(JSON.stringify(result.details, null, 2));
    console.log();

    if (result.valid) {
      console.log("✓ Trace format is valid!");
      process.exit(0);
    } else {
      console.error("✗ Trace format has errors");
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed to parse execution data:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
