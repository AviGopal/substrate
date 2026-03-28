/**
 * Failure Analyzer
 *
 * Analyzes execution traces to identify failure points, root causes,
 * and suggest fixes.
 */

import type { ExecutionTrace, ExecutedTask } from "../internal-types.ts";
import {
  DEFAULT_FAILURE_PATTERNS,
  type FailureAnalysis,
  type FailureCategory,
  type FailureSeverity,
  type FailurePattern,
  type FailurePoint,
  type RootCauseAnalysis,
  type SuggestedFix,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Execution context for analysis
 */
export interface FailureContext {
  /** Execution ID */
  executionId: string;
  /** Template ID */
  templateId: string;
  /** Original goal */
  goal: string;
  /** Execution trace */
  trace: ExecutionTrace;
  /** Error message (if available) */
  error?: string;
  /** Execution duration (ms) */
  durationMs?: number;
}

// =============================================================================
// ANALYZER
// =============================================================================

/**
 * FailureAnalyzer - analyzes execution failures
 */
export class FailureAnalyzer {
  private patterns: FailurePattern[];

  constructor(customPatterns?: FailurePattern[]) {
    this.patterns = customPatterns || DEFAULT_FAILURE_PATTERNS;
  }

  // ===========================================================================
  // MAIN ANALYSIS
  // ===========================================================================

  /**
   * Analyze a failed execution
   */
  analyze(context: FailureContext): FailureAnalysis {
    // Find failure point
    const failurePoint = this.findFailurePoint(context.trace, context.error);

    // Match failure pattern
    const pattern = this.matchPattern(failurePoint.error);

    // Determine category and severity
    const category = pattern?.category || this.inferCategory(failurePoint);
    const severity = pattern?.defaultSeverity || this.inferSeverity(context, failurePoint);

    // Analyze root cause
    const rootCause = this.analyzeRootCause(context, failurePoint, pattern);

    // Generate fix suggestions
    const suggestedFixes = this.generateFixes(context, failurePoint, pattern, rootCause);

    // Identify completed and skipped tasks
    const { completedTasks, skippedTasks } = this.categorizeTasks(context.trace, failurePoint);

    return {
      executionId: context.executionId,
      templateId: context.templateId,
      goal: context.goal,
      category,
      severity,
      failurePoint,
      rootCause,
      suggestedFixes,
      completedTasks,
      skippedTasks,
      analyzedAt: Date.now(),
    };
  }

  // ===========================================================================
  // FAILURE POINT DETECTION
  // ===========================================================================

  /**
   * Find the point where execution failed
   */
  findFailurePoint(trace: ExecutionTrace, error?: string): FailurePoint {
    const tasks = trace.tasks;

    // Look for failed tool calls first (more specific)
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]!;

      // Check for failed tool calls first - they have more specific errors
      for (let j = 0; j < task.toolCalls.length; j++) {
        const call = task.toolCalls[j]!;
        if (call.result && !call.result.success) {
          return {
            taskId: task.id,
            stepIndex: j,
            tool: call.name,
            error: call.result.error || "Tool call failed",
            timestamp: Date.now(),
          };
        }
      }

      // Then check task result status (less specific)
      if (task.result.status === "failure") {
        return {
          taskId: task.id,
          stepIndex: this.findFailedStep(task),
          tool: this.findFailedTool(task),
          error: task.result.error || error || "Task failed",
          timestamp: Date.now(),
        };
      }
    }

    // No specific failure found - use provided error or generic
    const lastTask = tasks[tasks.length - 1];
    return {
      taskId: lastTask?.id || "unknown",
      stepIndex: -1,
      error: error || "Execution failed without specific error",
      timestamp: Date.now(),
    };
  }

  /**
   * Find the step index where a task failed
   */
  private findFailedStep(task: ExecutedTask): number {
    for (let i = 0; i < task.toolCalls.length; i++) {
      const call = task.toolCalls[i]!;
      if (call.result && !call.result.success) {
        return i;
      }
    }
    return task.toolCalls.length - 1;
  }

  /**
   * Find the tool that failed in a task
   */
  private findFailedTool(task: ExecutedTask): string | undefined {
    for (const call of task.toolCalls) {
      if (call.result && !call.result.success) {
        return call.name;
      }
    }
    return undefined;
  }

  // ===========================================================================
  // PATTERN MATCHING
  // ===========================================================================

  /**
   * Match error against known patterns
   */
  matchPattern(error: string): FailurePattern | undefined {
    for (const pattern of this.patterns) {
      for (const regex of pattern.errorPatterns) {
        if (regex.test(error)) {
          return pattern;
        }
      }
    }
    return undefined;
  }

  /**
   * Infer category from failure point
   */
  private inferCategory(failurePoint: FailurePoint): FailureCategory {
    const error = failurePoint.error.toLowerCase();

    if (error.includes("validation") || error.includes("required")) {
      return "validation";
    }
    if (error.includes("timeout") || error.includes("timed out")) {
      return "timeout";
    }
    if (error.includes("not found") || error.includes("no such")) {
      return "resource";
    }
    if (error.includes("network") || error.includes("connection")) {
      return "external";
    }
    if (failurePoint.tool) {
      return "tool_error";
    }

    return "unknown";
  }

  /**
   * Infer severity from context
   */
  private inferSeverity(
    context: FailureContext,
    failurePoint: FailurePoint
  ): FailureSeverity {
    // Early failure is more severe
    const taskIndex = context.trace.tasks.findIndex(
      (t) => t.id === failurePoint.taskId
    );
    const progress = taskIndex / Math.max(context.trace.tasks.length, 1);

    if (progress < 0.25) {
      return "critical"; // Failed very early
    }
    if (progress < 0.5) {
      return "major";
    }
    if (progress < 0.75) {
      return "minor";
    }

    return "warning"; // Failed near the end
  }

  // ===========================================================================
  // ROOT CAUSE ANALYSIS
  // ===========================================================================

  /**
   * Analyze root cause of failure
   */
  private analyzeRootCause(
    context: FailureContext,
    failurePoint: FailurePoint,
    pattern?: FailurePattern
  ): RootCauseAnalysis {
    const evidence: string[] = [];
    const contributingFactors: string[] = [];
    let confidence = 0.5;

    // Use pattern if available
    if (pattern) {
      confidence += 0.2;
      evidence.push(`Matched known pattern: ${pattern.name}`);
    }

    // Analyze the failed task
    const failedTask = context.trace.tasks.find(
      (t) => t.id === failurePoint.taskId
    );

    if (failedTask) {
      // Check input state
      if (failedTask.inputState) {
        const missingFiles = this.checkMissingInputs(failedTask);
        if (missingFiles.length > 0) {
          contributingFactors.push(
            `Missing input files: ${missingFiles.join(", ")}`
          );
          evidence.push("Task input state shows missing files");
        }
      }

      // Check tool call sequence
      const toolSequence = failedTask.toolCalls.map((c) => c.name).join(" → ");
      evidence.push(`Tool sequence: ${toolSequence}`);

      // Check for repeated failures
      const retries = this.countRetries(failedTask);
      if (retries > 0) {
        contributingFactors.push(`Task was retried ${retries} times`);
        confidence -= 0.1; // Less confident if retries didn't help
      }
    }

    // Check for environmental issues
    if (failurePoint.error.includes("ENOENT") || failurePoint.error.includes("not found")) {
      contributingFactors.push("File or resource not available");
    }

    // Determine primary cause
    const primaryCause = this.determinePrimaryCause(
      failurePoint,
      pattern,
      contributingFactors
    );

    return {
      primaryCause,
      contributingFactors,
      evidence,
      confidence: Math.max(0.1, Math.min(0.95, confidence)),
    };
  }

  /**
   * Check for missing input files
   */
  private checkMissingInputs(task: ExecutedTask): string[] {
    const missing: string[] = [];

    // Check read operations that failed
    for (const call of task.toolCalls) {
      if (call.name === "read" && call.result && !call.result.success) {
        const path = call.arguments.file_path as string | undefined;
        if (path) missing.push(path);
      }
    }

    return missing;
  }

  /**
   * Count retry attempts in a task
   */
  private countRetries(task: ExecutedTask): number {
    // Look for repeated tool calls to same target
    const callCounts = new Map<string, number>();

    for (const call of task.toolCalls) {
      const key = `${call.name}:${JSON.stringify(call.arguments)}`;
      callCounts.set(key, (callCounts.get(key) || 0) + 1);
    }

    let retries = 0;
    for (const count of callCounts.values()) {
      if (count > 1) retries += count - 1;
    }

    return retries;
  }

  /**
   * Determine the primary cause
   */
  private determinePrimaryCause(
    failurePoint: FailurePoint,
    pattern?: FailurePattern,
    contributingFactors: string[] = []
  ): string {
    if (pattern) {
      return pattern.description;
    }

    if (failurePoint.tool) {
      return `${failurePoint.tool} tool failed: ${failurePoint.error}`;
    }

    if (contributingFactors.length > 0) {
      return contributingFactors[0]!;
    }

    return failurePoint.error;
  }

  // ===========================================================================
  // FIX SUGGESTIONS
  // ===========================================================================

  /**
   * Generate fix suggestions
   */
  private generateFixes(
    _context: FailureContext,
    failurePoint: FailurePoint,
    pattern?: FailurePattern,
    _rootCause?: RootCauseAnalysis
  ): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    // Add pattern-based suggestions
    if (pattern) {
      for (const suggestion of pattern.fixSuggestions) {
        fixes.push({
          description: suggestion,
          type: "modify_input",
          confidence: 0.6,
        });
      }
    }

    // Add contextual suggestions
    if (failurePoint.tool === "read") {
      fixes.push({
        description: "Create the missing file before reading",
        type: "modify_input",
        confidence: 0.7,
      });
    }

    if (failurePoint.tool === "bash") {
      fixes.push({
        description: "Retry the command with different parameters",
        type: "retry",
        confidence: 0.5,
      });
    }

    // Add generic suggestions
    fixes.push({
      description: "Retry the failed task",
      type: "retry",
      confidence: 0.4,
    });

    fixes.push({
      description: "Create a variant with modified approach",
      type: "use_alternative",
      confidence: 0.5,
    });

    // Sort by confidence
    return fixes.sort((a, b) => b.confidence - a.confidence);
  }

  // ===========================================================================
  // TASK CATEGORIZATION
  // ===========================================================================

  /**
   * Categorize tasks as completed or skipped
   */
  private categorizeTasks(
    trace: ExecutionTrace,
    failurePoint: FailurePoint
  ): { completedTasks: string[]; skippedTasks: string[] } {
    const completedTasks: string[] = [];
    const skippedTasks: string[] = [];
    let foundFailure = false;

    for (const task of trace.tasks) {
      if (task.id === failurePoint.taskId) {
        foundFailure = true;
        continue; // Don't include the failed task in either list
      }

      if (foundFailure) {
        skippedTasks.push(task.id);
      } else if (task.result.status === "success") {
        completedTasks.push(task.id);
      }
    }

    return { completedTasks, skippedTasks };
  }

  // ===========================================================================
  // PATTERN MANAGEMENT
  // ===========================================================================

  /**
   * Add a custom failure pattern
   */
  addPattern(pattern: FailurePattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get all patterns
   */
  getPatterns(): FailurePattern[] {
    return [...this.patterns];
  }
}
