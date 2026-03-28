/**
 * Trace Extractor
 *
 * Analyzes execution traces to identify task boundaries and variables.
 * First step in the ribosome pattern: trace → analysis → template.
 */

import type { ExecutionTrace, ExecutedTask, ToolCall } from "../internal-types.ts";
import type {
  ExtractionAnalysis,
  ExtractionOptions,
  ExecutionContext,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Task group identified from trace analysis
 */
export interface TaskGroup {
  /** Tasks in this group */
  tasks: ExecutedTask[];
  /** Description inferred from tasks */
  description: string;
  /** Tool types used in this group */
  toolsUsed: string[];
  /** Files involved */
  filesInvolved: string[];
  /** Whether this is a read-only phase */
  isReadOnly: boolean;
}

/**
 * Variable point identified for parameterization
 */
export interface VariablePoint {
  /** Variable name */
  name: string;
  /** Current value */
  value: string;
  /** Where it was found */
  location: "prompt" | "tool_argument" | "file_path";
  /** Task ID where found */
  taskId: string;
  /** Confidence that this should be parameterized */
  confidence: number;
}

// =============================================================================
// EXTRACTOR
// =============================================================================

/**
 * TraceExtractor - analyzes execution traces
 */
export class TraceExtractor {
  private options: Required<ExtractionOptions>;

  constructor(options: ExtractionOptions = {}) {
    this.options = {
      minTaskSize: options.minTaskSize ?? 1,
      maxTaskSize: options.maxTaskSize ?? 5,
      parameterizePaths: options.parameterizePaths ?? true,
      category: options.category ?? "feature",
    };
  }

  // ===========================================================================
  // MAIN ANALYSIS
  // ===========================================================================

  /**
   * Analyze an execution trace
   */
  analyze(context: ExecutionContext): ExtractionAnalysis {
    const trace = context.trace;
    const tasks = trace.tasks;

    // Count tool calls
    const toolCallCount = tasks.reduce(
      (sum: number, task: (typeof tasks)[number]) => sum + task.toolCalls.length,
      0
    );

    // Identify files modified
    const filesModified = this.extractFilesModified(tasks);

    // Identify variables
    const variables = this.identifyVariables(tasks, context.goal);

    // Identify input/output shapes
    const inputShapes = this.extractInputShapes(trace);
    const outputShapes = this.extractOutputShapes(trace);

    // Generate warnings
    const warnings: string[] = [];

    if (tasks.length === 0) {
      warnings.push("No tasks in trace");
    }

    if (toolCallCount === 0) {
      warnings.push("No tool calls recorded");
    }

    if (!context.success) {
      warnings.push("Execution was not successful - template may be incomplete");
    }

    if (variables.length === 0 && this.options.parameterizePaths) {
      warnings.push("No variables identified for parameterization");
    }

    return {
      taskCount: tasks.length,
      toolCallCount,
      filesModified,
      variablesIdentified: variables.map((v) => v.name),
      inputShapes,
      outputShapes,
      warnings,
    };
  }

  /**
   * Identify task boundaries in the trace
   */
  identifyTaskBoundaries(trace: ExecutionTrace): TaskGroup[] {
    const tasks = trace.tasks;

    if (tasks.length === 0) {
      return [];
    }

    const groups: TaskGroup[] = [];
    let currentGroup: ExecutedTask[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]!;
      const prevTask = i > 0 ? tasks[i - 1] : null;

      currentGroup.push(task);

      // Check if we should break into a new group
      const shouldBreak =
        currentGroup.length >= this.options.maxTaskSize ||
        (prevTask && this.isSignificantTransition(prevTask, task)) ||
        (prevTask && this.isDifferentPhase(prevTask, task));

      if (shouldBreak && currentGroup.length >= this.options.minTaskSize) {
        groups.push(this.createTaskGroup(currentGroup));
        currentGroup = [];
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
      groups.push(this.createTaskGroup(currentGroup));
    }

    return groups;
  }

  /**
   * Identify variables that should be parameterized
   */
  identifyVariables(
    tasks: ExecutedTask[],
    goal: string
  ): VariablePoint[] {
    const variables: VariablePoint[] = [];
    const seenPaths = new Set<string>();

    for (const task of tasks) {
      // Check tool calls for file paths
      for (const call of task.toolCalls) {
        const filePath = this.extractFilePath(call);
        if (filePath && !seenPaths.has(filePath)) {
          seenPaths.add(filePath);
          variables.push({
            name: this.generateVariableName(filePath),
            value: filePath,
            location: "tool_argument",
            taskId: task.id,
            confidence: this.calculatePathConfidence(filePath, goal),
          });
        }
      }

      // Check prompt for potential variables
      const promptVars = this.extractPromptVariables(task.actualPrompt);
      for (const pv of promptVars) {
        if (!variables.some((v) => v.name === pv.name)) {
          variables.push({
            ...pv,
            taskId: task.id,
          });
        }
      }
    }

    // Sort by confidence
    return variables.sort((a, b) => b.confidence - a.confidence);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Extract files modified from tasks
   */
  private extractFilesModified(tasks: ExecutedTask[]): string[] {
    const files = new Set<string>();

    for (const task of tasks) {
      // Check output state
      if (task.outputState?.filesModified) {
        task.outputState.filesModified.forEach((f) => files.add(f));
      }
      if (task.outputState?.filesCreated) {
        task.outputState.filesCreated.forEach((f) => files.add(f));
      }

      // Check tool calls
      for (const call of task.toolCalls) {
        if (call.name === "write" || call.name === "edit") {
          const path = call.arguments.file_path as string | undefined;
          if (path) files.add(path);
        }
      }
    }

    return Array.from(files);
  }

  /**
   * Extract input shapes from trace
   */
  private extractInputShapes(trace: ExecutionTrace): string[] {
    const shapes = new Set<string>();

    // From goal context
    if (trace.goalContext) {
      shapes.add("goal_context");
    }

    // From task inputs
    for (const task of trace.tasks) {
      if (task.inputState?.impulses) {
        for (const impulseId of task.inputState.impulses) {
          // Extract shape from impulse ID convention (e.g., "source_code:xxx")
          const shape = impulseId.split(":")[0];
          if (shape) shapes.add(shape);
        }
      }

      // Infer from tool calls
      for (const call of task.toolCalls) {
        if (call.name === "read") {
          shapes.add("file_content");
        } else if (call.name === "bash" && call.arguments.command) {
          const cmd = call.arguments.command as string;
          if (cmd.includes("grep") || cmd.includes("find")) {
            shapes.add("search_results");
          }
        }
      }
    }

    return Array.from(shapes);
  }

  /**
   * Extract output shapes from trace
   */
  private extractOutputShapes(trace: ExecutionTrace): string[] {
    const shapes = new Set<string>();

    // From files modified
    for (const file of trace.filesModified) {
      const ext = file.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "ts":
        case "tsx":
        case "js":
        case "jsx":
          shapes.add("source_code");
          break;
        case "json":
          shapes.add("json_data");
          break;
        case "md":
          shapes.add("documentation");
          break;
        case "test.ts":
        case "spec.ts":
          shapes.add("test_file");
          break;
        default:
          shapes.add("file_content");
      }
    }

    // From impulses created
    for (const impulseId of trace.impulsesCreated) {
      const shape = impulseId.split(":")[0];
      if (shape) shapes.add(shape);
    }

    return Array.from(shapes);
  }

  /**
   * Create a task group from a set of tasks
   */
  private createTaskGroup(tasks: ExecutedTask[]): TaskGroup {
    const toolsUsed = new Set<string>();
    const filesInvolved = new Set<string>();
    let isReadOnly = true;

    for (const task of tasks) {
      for (const call of task.toolCalls) {
        toolsUsed.add(call.name);

        if (call.name === "write" || call.name === "edit") {
          isReadOnly = false;
          const path = call.arguments.file_path as string | undefined;
          if (path) filesInvolved.add(path);
        }

        if (call.name === "read") {
          const path = call.arguments.file_path as string | undefined;
          if (path) filesInvolved.add(path);
        }
      }
    }

    return {
      tasks,
      description: this.inferGroupDescription(tasks, isReadOnly),
      toolsUsed: Array.from(toolsUsed),
      filesInvolved: Array.from(filesInvolved),
      isReadOnly,
    };
  }

  /**
   * Infer a description for a task group
   */
  private inferGroupDescription(
    tasks: ExecutedTask[],
    isReadOnly: boolean
  ): string {
    if (tasks.length === 0) return "Empty task group";

    const firstTask = tasks[0]!;
    const toolNames = new Set<string>();

    for (const task of tasks) {
      for (const call of task.toolCalls) {
        toolNames.add(call.name);
      }
    }

    // Generate description based on tool patterns
    if (isReadOnly && toolNames.has("read")) {
      return "Analyze and understand current state";
    }

    if (toolNames.has("write") && !toolNames.has("edit")) {
      return "Create new files and components";
    }

    if (toolNames.has("edit") && !toolNames.has("write")) {
      return "Modify existing files";
    }

    if (toolNames.has("bash")) {
      const commands = tasks.flatMap((t) =>
        t.toolCalls
          .filter((c) => c.name === "bash")
          .map((c) => c.arguments.command as string)
      );

      if (commands.some((c) => c?.includes("test") || c?.includes("jest"))) {
        return "Run tests and verify changes";
      }

      if (commands.some((c) => c?.includes("git"))) {
        return "Manage version control";
      }
    }

    // Fall back to first task description
    return firstTask.description || "Execute task";
  }

  /**
   * Check if there's a significant transition between tasks
   */
  private isSignificantTransition(
    prevTask: ExecutedTask,
    currentTask: ExecutedTask
  ): boolean {
    const prevActions = new Set(prevTask.toolCalls.map((c) => c.name));
    const currentActions = new Set(currentTask.toolCalls.map((c) => c.name));

    // Significant transitions
    const transitions = [
      ["read", "write"],
      ["read", "edit"],
      ["bash", "write"],
      ["bash", "edit"],
      ["write", "bash"],
      ["edit", "bash"],
    ];

    for (const [from, to] of transitions) {
      if (prevActions.has(from!) && currentActions.has(to!)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if tasks are in different phases (e.g., analysis vs modification)
   */
  private isDifferentPhase(
    prevTask: ExecutedTask,
    currentTask: ExecutedTask
  ): boolean {
    const prevReadOnly = prevTask.toolCalls.every(
      (c) => c.name === "read" || c.name === "bash"
    );
    const currentReadOnly = currentTask.toolCalls.every(
      (c) => c.name === "read" || c.name === "bash"
    );

    return prevReadOnly !== currentReadOnly;
  }

  /**
   * Extract file path from a tool call
   */
  private extractFilePath(call: ToolCall): string | undefined {
    return call.arguments.file_path as string | undefined;
  }

  /**
   * Generate a variable name from a file path
   */
  private generateVariableName(filePath: string): string {
    const parts = filePath.split("/");
    const filename = parts[parts.length - 1] || "file";
    const name = filename
      .replace(/\.[^.]+$/, "") // Remove extension
      .replace(/[^a-zA-Z0-9]/g, "_") // Replace non-alphanumeric
      .replace(/_+/g, "_") // Collapse underscores
      .toLowerCase();

    return `${name}_path`;
  }

  /**
   * Calculate confidence that a path should be parameterized
   */
  private calculatePathConfidence(filePath: string, goal: string): number {
    let confidence = 0.5;

    // Higher confidence if path is mentioned in goal
    const pathParts = filePath.toLowerCase().split("/");
    const goalLower = goal.toLowerCase();

    for (const part of pathParts) {
      if (part.length > 2 && goalLower.includes(part)) {
        confidence += 0.2;
      }
    }

    // Lower confidence for common paths
    if (filePath.includes("node_modules") || filePath.includes(".git")) {
      confidence -= 0.3;
    }

    // Higher confidence for source files
    if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract potential variables from a prompt
   */
  private extractPromptVariables(prompt: string): VariablePoint[] {
    const variables: VariablePoint[] = [];

    // Look for quoted strings that look like identifiers
    const quotedMatches = prompt.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedMatches) {
      for (const match of quotedMatches) {
        const value = match.slice(1, -1);
        // Only consider if it looks like a path or identifier
        if (value.includes("/") || value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
          variables.push({
            name: this.generateVariableName(value),
            value,
            location: "prompt",
            taskId: "",
            confidence: 0.4,
          });
        }
      }
    }

    return variables;
  }
}

/**
 * Calculate extraction confidence score
 */
export function calculateExtractionConfidence(
  context: ExecutionContext,
  analysis: ExtractionAnalysis
): number {
  let confidence = 0.5;

  // Success is crucial
  if (context.success) {
    confidence += 0.2;
  } else {
    confidence -= 0.3;
  }

  // More tasks = more complete template
  if (analysis.taskCount >= 2) confidence += 0.1;
  if (analysis.taskCount >= 4) confidence += 0.05;

  // Tool calls indicate concrete actions
  if (analysis.toolCallCount >= 3) confidence += 0.1;
  if (analysis.toolCallCount >= 10) confidence += 0.05;

  // Files modified = actual work done
  if (analysis.filesModified.length > 0) confidence += 0.1;

  // Input/output shapes help with matching
  if (analysis.inputShapes.length > 0) confidence += 0.05;
  if (analysis.outputShapes.length > 0) confidence += 0.05;

  // Warnings reduce confidence
  confidence -= analysis.warnings.length * 0.05;

  // Cap at reasonable bounds
  return Math.max(0.1, Math.min(0.95, confidence));
}
