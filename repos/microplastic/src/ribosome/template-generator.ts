/**
 * Template Generator
 *
 * Generates ActivityTemplate from execution traces using extraction analysis.
 * Second step in the ribosome pattern: trace → analysis → template.
 */

import type {
  ActivityTemplate,
  ActivityTask,
} from "@metabob/minibob";
import type {
  TaskValidation,
  VariableDefinition,
  ActivityInputSchema,
  ActivityOutputSchema,
  ImpulseShape,
} from "../internal-types.ts";
import {
  TraceExtractor,
  calculateExtractionConfidence,
  type TaskGroup,
  type VariablePoint,
} from "./extractor.ts";
import type {
  ExtractionResult,
  ExtractionOptions,
  ExecutionContext,
} from "./types.ts";

// =============================================================================
// GENERATOR
// =============================================================================

/**
 * TemplateGenerator - creates templates from execution traces
 */
export class TemplateGenerator {
  private extractor: TraceExtractor;

  constructor(options: ExtractionOptions = {}) {
    this.extractor = new TraceExtractor(options);
  }

  // ===========================================================================
  // MAIN GENERATION
  // ===========================================================================

  /**
   * Generate a template from execution context
   */
  generate(context: ExecutionContext): ExtractionResult {
    // Analyze the trace
    const analysis = this.extractor.analyze(context);
    const confidence = calculateExtractionConfidence(context, analysis);

    // Identify task groups
    const taskGroups = this.extractor.identifyTaskBoundaries(context.trace);

    // Identify variables
    const variables = this.extractor.identifyVariables(
      context.trace.tasks,
      context.goal
    );

    // Generate tasks from groups
    const tasks = this.generateTasks(taskGroups, variables);

    // Generate schemas
    const inputSchema = this.generateInputSchema(analysis.inputShapes);
    const outputSchema = this.generateOutputSchema(analysis.outputShapes);

    // Generate template
    const template: ActivityTemplate = {
      id: this.generateTemplateId(),
      name: this.generateTemplateName(context.goal),
      description: context.goal,
      category: this.inferCategory(context.goal, context.success),
      tasks,
      variables: this.generateVariableDefinitions(variables),
      inputSchema: inputSchema.required.length > 0 ? inputSchema : undefined,
      outputSchema: outputSchema.produces.length > 0 ? outputSchema : undefined,
      metadata: {
        generatedFrom: "execution",
        sourceExecutionId: context.executionId,
        firstExecutionMetrics: {
          duration: context.durationMs,
          cost: context.cost,
          tokens: { input: 0, output: 0 }, // Not available from context
          status: context.success ? "completed" : "failed",
        },
        createdAt: Date.now(),
        author: "ribosome",
        inputSchemaInferredFrom: {
          executionId: context.executionId,
          confidence,
          impulseCount: analysis.inputShapes.length,
        },
      },
    };

    return {
      template,
      confidence,
      analysis,
    };
  }

  // ===========================================================================
  // TASK GENERATION
  // ===========================================================================

  /**
   * Generate activity tasks from task groups
   */
  private generateTasks(
    groups: TaskGroup[],
    variables: VariablePoint[]
  ): ActivityTask[] {
    return groups.map((group, index) => {
      const taskId = `task-${index + 1}`;
      const dependencies = index > 0 ? [`task-${index}`] : [];

      // Extract prompt from group
      const prompt = this.generatePrompt(group, variables);

      // Extract validation from group
      const validation = this.generateValidation(group);

      return {
        id: taskId,
        description: group.description,
        prompt: {
          template: prompt,
          variables: this.filterVariablesForTask(variables, group),
        },
        dependencies,
        validation: Object.keys(validation).length > 0 ? validation : undefined,
        retry: {
          maxAttempts: 2,
          strategy: "simple" as const,
        },
      };
    });
  }

  /**
   * Generate a prompt template from a task group
   */
  private generatePrompt(
    group: TaskGroup,
    variables: VariablePoint[]
  ): string {
    const lines: string[] = [];

    lines.push(`## Task: ${group.description}`);
    lines.push("");

    // Add context about what tools were used
    if (group.toolsUsed.length > 0) {
      lines.push(`Use the following tools as needed: ${group.toolsUsed.join(", ")}`);
      lines.push("");
    }

    // Add files involved
    if (group.filesInvolved.length > 0) {
      lines.push("### Files to work with:");
      for (const file of group.filesInvolved) {
        // Check if this file has a variable
        const variable = variables.find((v) => v.value === file);
        if (variable) {
          lines.push(`- {{${variable.name}}} (default: ${file})`);
        } else {
          lines.push(`- ${file}`);
        }
      }
      lines.push("");
    }

    // Add the actual task prompts from executed tasks
    lines.push("### Instructions:");
    for (const task of group.tasks) {
      // Summarize what the task did
      const toolSummary = task.toolCalls
        .slice(0, 3) // First 3 tool calls
        .map((call) => {
          if (call.name === "read") {
            return `Read ${call.arguments.file_path || "file"}`;
          } else if (call.name === "write") {
            return `Create ${call.arguments.file_path || "file"}`;
          } else if (call.name === "edit") {
            return `Modify ${call.arguments.file_path || "file"}`;
          } else if (call.name === "bash") {
            const cmd = (call.arguments.command as string) || "";
            return `Run: ${cmd.slice(0, 50)}${cmd.length > 50 ? "..." : ""}`;
          }
          return `${call.name}`;
        })
        .join(", ");

      if (toolSummary) {
        lines.push(`- ${toolSummary}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate validation rules from a task group
   */
  private generateValidation(group: TaskGroup): TaskValidation {
    const validation: TaskValidation = {};

    // Files that should exist after this task
    const filesCreated: string[] = [];
    const filesModified: string[] = [];

    for (const task of group.tasks) {
      if (task.outputState?.filesCreated) {
        filesCreated.push(...task.outputState.filesCreated);
      }
      if (task.outputState?.filesModified) {
        filesModified.push(...task.outputState.filesModified);
      }

      // Also check tool calls
      for (const call of task.toolCalls) {
        if (call.name === "write" && call.result?.success) {
          const path = call.arguments.file_path as string | undefined;
          if (path && !filesCreated.includes(path)) {
            filesCreated.push(path);
          }
        }
      }
    }

    if (filesCreated.length > 0) {
      validation.requiredFiles = filesCreated;
    }

    return validation;
  }

  /**
   * Filter variables relevant to a specific task group
   */
  private filterVariablesForTask(
    variables: VariablePoint[],
    group: TaskGroup
  ): VariableDefinition[] {
    // Find variables that are used in this group
    const relevant = variables.filter((v) =>
      group.filesInvolved.includes(v.value) ||
      group.tasks.some((t) => t.id === v.taskId)
    );

    return relevant.map((v) => ({
      name: v.name,
      type: "string" as const,
      required: false,
      description: `Path: ${v.value}`,
      default: v.value,
    }));
  }

  // ===========================================================================
  // SCHEMA GENERATION
  // ===========================================================================

  /**
   * Generate input schema from detected shapes
   */
  private generateInputSchema(shapes: string[]): ActivityInputSchema {
    const required: ImpulseShape[] = [];
    const optional: ImpulseShape[] = [];

    for (const shapeStr of shapes) {
      const descriptor: ImpulseShape = {
        shape: shapeStr,
        description: this.getShapeDescription(shapeStr),
      };

      // Goal context is always required
      if (shapeStr === "goal_context") {
        required.push(descriptor);
      } else {
        optional.push(descriptor);
      }
    }

    return { required, optional: optional.length > 0 ? optional : undefined };
  }

  /**
   * Generate output schema from detected shapes
   */
  private generateOutputSchema(shapes: string[]): ActivityOutputSchema {
    return {
      produces: shapes.map((shapeStr) => ({
        shape: shapeStr,
        description: this.getShapeDescription(shapeStr),
      })),
    };
  }

  /**
   * Get human-readable description for a shape
   */
  private getShapeDescription(shape: string): string {
    const descriptions: Record<string, string> = {
      goal_context: "Goal and context information",
      file_content: "File content to read or modify",
      source_code: "Source code file",
      test_file: "Test file for verification",
      json_data: "JSON configuration or data",
      documentation: "Documentation or README",
      search_results: "Search results from codebase",
    };

    return descriptions[shape] || `Content of type: ${shape}`;
  }

  // ===========================================================================
  // VARIABLE GENERATION
  // ===========================================================================

  /**
   * Generate variable definitions from variable points
   */
  private generateVariableDefinitions(
    variables: VariablePoint[]
  ): VariableDefinition[] {
    // Only include high-confidence variables
    const highConfidence = variables.filter((v) => v.confidence >= 0.5);

    // Deduplicate by name
    const unique = new Map<string, VariablePoint>();
    for (const v of highConfidence) {
      if (!unique.has(v.name) || v.confidence > unique.get(v.name)!.confidence) {
        unique.set(v.name, v);
      }
    }

    return Array.from(unique.values()).map((v) => ({
      name: v.name,
      type: "string" as const,
      required: false,
      description: `Path or value: ${v.value}`,
      default: v.value,
    }));
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Generate a unique template ID
   */
  private generateTemplateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `tpl_${timestamp}_${random}`;
  }

  /**
   * Generate a template name from the goal
   */
  private generateTemplateName(goal: string): string {
    // Capitalize first letter of each word
    return goal
      .split(" ")
      .slice(0, 6) // Max 6 words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Infer category from goal and success
   */
  private inferCategory(
    goal: string,
    _success: boolean
  ): "feature" | "bugfix" | "refactor" | "tool" | "infrastructure" {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes("fix") || goalLower.includes("bug") || goalLower.includes("error")) {
      return "bugfix";
    }

    if (goalLower.includes("refactor") || goalLower.includes("clean") || goalLower.includes("improve")) {
      return "refactor";
    }

    if (goalLower.includes("tool") || goalLower.includes("script") || goalLower.includes("automation")) {
      return "tool";
    }

    if (goalLower.includes("deploy") || goalLower.includes("infrastructure") || goalLower.includes("setup")) {
      return "infrastructure";
    }

    return "feature";
  }
}
