/**
 * Goal Executor
 *
 * Executes goals using activity templates from minibob.
 * Coordinates between selection, execution, narrative, and trace capture.
 */

import {
  ActivityExecutor,
  configureLogger,
  type ActivityTemplate,
  type ExecutorConfig,
  type ExecuteOptions,
} from "@metabob/minibob";

import { TemplateSelector } from "../selection/selector.ts";
import { NarrativeStream } from "../tui/narrative.ts";
import { PRIMORDIAL_TEMPLATES } from "../primordials/index.ts";
import type {
  ExecutionContext,
  ExecutionResult,
  ExecutionEventType,
  ExecutionEventData,
  ExecutionEventListener,
  GoalExecutorOptions,
} from "./types.ts";

// =============================================================================
// GOAL EXECUTOR
// =============================================================================

/**
 * GoalExecutor - executes goals using activity templates
 */
export class GoalExecutor {
  private selector: TemplateSelector;
  private narrativeStream: NarrativeStream;
  private options: GoalExecutorOptions;
  private listeners: Map<ExecutionEventType, Set<ExecutionEventListener<ExecutionEventType>>> = new Map();
  private impulseStore: GoalExecutorOptions["impulseStore"];

  private primordialSeeded = false;

  constructor(options: GoalExecutorOptions = {}) {
    this.options = options;
    this.impulseStore = options.impulseStore;

    // Initialize selector
    this.selector = new TemplateSelector({
      api: {
        baseUrl: options.apiBaseUrl ?? process.env.ACTIVITY_API_URL ?? "http://localhost:8080",
        timeout: options.apiTimeout ?? 5000,
        authToken: options.apiAuthToken ?? process.env.ACTIVITY_API_KEY,
      },
    });

    // Initialize narrative stream
    this.narrativeStream = new NarrativeStream();

    // Configure minibob logger
    configureLogger({ minLevel: "warn" });
  }

  /**
   * Seed primordial templates to backend (one-time operation)
   */
  async seedPrimordials(): Promise<void> {
    if (this.primordialSeeded) return;

    for (const template of PRIMORDIAL_TEMPLATES) {
      await this.selector.createTemplate(template);
    }
    this.primordialSeeded = true;
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  /**
   * Subscribe to execution events
   */
  on<T extends ExecutionEventType>(
    event: T,
    listener: ExecutionEventListener<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as ExecutionEventListener<ExecutionEventType>);

    return () => {
      this.listeners.get(event)?.delete(listener as ExecutionEventListener<ExecutionEventType>);
    };
  }

  /**
   * Emit an execution event and optionally create an impulse
   */
  private emit<T extends ExecutionEventType>(
    event: T,
    data: ExecutionEventData[T]
  ): void {
    // Emit traditional event to listeners
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as ExecutionEventListener<T>)(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }

    // Also emit as impulse if store is available
    if (this.impulseStore) {
      this.emitImpulse(event, data);
    }
  }

  /**
   * Create an impulse for an execution event
   */
  private emitImpulse<T extends ExecutionEventType>(
    event: T,
    data: ExecutionEventData[T]
  ): void {
    if (!this.impulseStore) return;

    // Map event type to impulse shape
    const shapeMap: Record<ExecutionEventType, string> = {
      "execution:start": "activity",
      "execution:template_selected": "activity",
      "execution:improvising": "activity",
      "execution:task_start": "task",
      "execution:task_complete": "task",
      "execution:tool_call": "tool_call",
      "execution:tool_result": "tool_call",
      "execution:thinking": "notification",
      "execution:complete": "summary",
      "execution:failed": "error",
    };

    this.impulseStore.create({
      pointer: { type: "execution_event", event },
      budget: 1000,
      priority: event.includes("failed") || event.includes("error") ? "high" : "medium",
      shape: shapeMap[event],
      content: JSON.stringify(data),
      metadata: {
        executionEvent: event,
        timestamp: Date.now(),
      },
    });
  }

  // ===========================================================================
  // EXECUTION
  // ===========================================================================

  /**
   * Execute a goal
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Emit start event
    this.emit("execution:start", { goal: context.goal, context });
    this.narrativeStream.emit("goal_received", { goal: context.goal });

    try {
      // Select template
      const selection = await this.selector.select({
        goal: context.goal,
        workspaceType: "typescript", // TODO: detect from context
      });

      if (selection.shouldImprovise) {
        // Improvise - no template matched
        this.emit("execution:improvising", { goal: context.goal });
        this.narrativeStream.emit("improvising", { goal: context.goal });

        if (context.dryRun) {
          const result = this.createDryRunResult(context, null, true, startTime);
          this.emit("execution:complete", { result });
          this.narrativeStream.emit("success", { summary: result.summary });
          return result;
        }

        return this.executeImprovisation(context, startTime);
      }

      // Template selected
      const template = selection.template!;
      this.emit("execution:template_selected", { template, selection });
      this.narrativeStream.emit("template_selected", {
        templateName: template.name,
        successRate: selection.candidates[0]?.score ?? 0,
      });

      if (context.dryRun) {
        const result = this.createDryRunResult(context, template, false, startTime);
        this.emit("execution:complete", { result });
        this.narrativeStream.emit("success", { summary: result.summary });
        return result;
      }

      // Execute template
      return this.executeTemplate(context, template, startTime);
    } catch (error) {
      const result = this.createErrorResult(error, startTime);
      this.emit("execution:failed", { error: result.error!, result });
      this.narrativeStream.emit("failure", { error: result.error });
      return result;
    }
  }

  // ===========================================================================
  // TEMPLATE EXECUTION
  // ===========================================================================

  /**
   * Execute a template
   */
  private async executeTemplate(
    context: ExecutionContext,
    template: ActivityTemplate,
    startTime: number
  ): Promise<ExecutionResult> {
    // Check for API key
    const apiKey = this.options.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    // Track task progress for narrative
    let currentTask = 0;
    const totalTasks = template.tasks.length;

    // Create executor config
    const config: ExecutorConfig = {
      provider: "anthropic",
      model: this.options.model ?? "claude-sonnet-4-20250514",
      apiKey,
      workingDirectory: context.workdir,
      onActivityStarted: (_executionId, templateId, templateName) => {
        if (context.verbose) {
          console.log(`[Activity started] ${templateName ?? templateId}`);
        }
      },
      onActivityTaskCompleted: (_executionId, _taskId, taskDescription, status) => {
        currentTask++;
        this.emit("execution:task_complete", {
          taskIndex: currentTask,
          success: status === "completed",
        });
        this.narrativeStream.emit("task_progress", {
          taskIndex: currentTask,
          totalTasks,
          taskName: taskDescription,
        });
      },
      onActivityCompleted: (execution) => {
        if (context.verbose) {
          console.log(`[Activity completed] ${execution.status}`);
        }
      },
    };

    // Create executor
    const executor = new ActivityExecutor(config);

    // Create execute options
    const executeOptions: ExecuteOptions = {
      template,
      variables: {
        goal: context.goal,
        workdir: context.workdir,
      },
      impulses: context.impulses,
      reason: context.goal,
      onTaskStart: (taskId) => {
        currentTask++;
        const task = template.tasks.find(t => t.id === taskId);
        this.emit("execution:task_start", {
          taskIndex: currentTask,
          totalTasks,
          taskName: task?.description ?? taskId,
        });
        this.narrativeStream.emit("task_starting", {
          taskIndex: currentTask,
          totalTasks,
          taskName: task?.description ?? taskId,
        });
      },
    };

    // Execute template
    const execution = await executor.execute(executeOptions);

    // Record outcome
    const success = execution.status === "completed";
    await this.selector.recordOutcome({
      templateId: template.id,
      success,
      durationMs: execution.metrics?.duration ?? (Date.now() - startTime),
      cost: execution.metrics?.cost ?? 0,
      error: execution.error,
    });

    // Build result
    const result: ExecutionResult = {
      success,
      template,
      improvised: false,
      execution,
      outputImpulses: execution.impulses ?? [],
      summary: success ? "Completed successfully" : (execution.error ?? "Failed"),
      error: execution.error,
      durationMs: Date.now() - startTime,
      cost: execution.metrics?.cost ?? 0,
    };

    // Emit completion
    if (success) {
      this.emit("execution:complete", { result });
      this.narrativeStream.emit("success", {
        summary: result.summary,
        filesModified: execution.executionTrace?.filesModified?.length ?? 0,
      });
    } else {
      this.emit("execution:failed", { error: result.error!, result });
      this.narrativeStream.emit("failure", { error: result.error });
    }

    return result;
  }

  // ===========================================================================
  // IMPROVISATION
  // ===========================================================================

  /**
   * Execute without a template (improvise)
   */
  private async executeImprovisation(
    context: ExecutionContext,
    startTime: number
  ): Promise<ExecutionResult> {
    // Create a minimal template for improvisation
    const improvisationTemplate: ActivityTemplate = {
      id: `improvise-${Date.now()}`,
      name: "Improvisation",
      description: "Improvised execution for goal",
      category: "feature",
      variables: [
        { name: "goal", type: "string", description: "The goal to achieve", required: true },
      ],
      tasks: [
        {
          id: "achieve-goal",
          description: "Achieve the user's goal",
          prompt: {
            template: `You are an AI development assistant. Achieve this goal:

{goal}

Think through the steps needed and execute them using the available tools.
Be thorough but efficient. If you encounter errors, try to fix them.`,
            variables: [{ name: "goal", type: "string", required: true }],
          },
          validation: {},
          retry: { maxAttempts: 2, strategy: "simple" },
        },
      ],
      metadata: {},
    };

    // Execute as template
    return this.executeTemplate(context, improvisationTemplate, startTime);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Create a dry-run result
   */
  private createDryRunResult(
    context: ExecutionContext,
    template: ActivityTemplate | null,
    improvised: boolean,
    startTime: number
  ): ExecutionResult {
    return {
      success: true,
      template,
      improvised,
      execution: null,
      outputImpulses: [],
      summary: improvised
        ? `[dry-run] Would improvise for: ${context.goal}`
        : `[dry-run] Would execute template: ${template?.name}`,
      durationMs: Date.now() - startTime,
      cost: 0,
    };
  }

  /**
   * Create an error result
   */
  private createErrorResult(
    error: unknown,
    startTime: number
  ): ExecutionResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      template: null,
      improvised: false,
      execution: null,
      outputImpulses: [],
      summary: "Execution failed",
      error: message,
      durationMs: Date.now() - startTime,
      cost: 0,
    };
  }

  // ===========================================================================
  // ACCESSORS
  // ===========================================================================

  /**
   * Get the narrative stream
   */
  getNarrativeStream(): NarrativeStream {
    return this.narrativeStream;
  }

  /**
   * Get the selector
   */
  getSelector(): TemplateSelector {
    return this.selector;
  }
}
