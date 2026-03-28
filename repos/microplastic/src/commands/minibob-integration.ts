/**
 * MiniBob Integration for Self-Development
 *
 * Configures MiniBob to develop microplastic itself, creating a self-improvement loop.
 */

import {
  ActivityExecutor,
  configureLogger,
  type ActivityTemplate,
  type ExecutorConfig,
  type ExecuteOptions,
  type ExecutionResult as MiniBobExecutionResult,
} from "@metabob/minibob";

// =============================================================================
// TYPES
// =============================================================================

export interface MiniBobDevConfig {
  /**
   * Working directory for development (repos/microplastic)
   */
  workdir: string;

  /**
   * Backend API URL for activity storage
   */
  backend: string;

  /**
   * MiniBob API key for authentication
   */
  apiKey: string;

  /**
   * MiniBob instance ID for trace attribution
   */
  instanceId: string;

  /**
   * Anthropic API key for LLM calls
   */
  anthropicApiKey: string;

  /**
   * LLM model to use
   */
  model?: string;

  /**
   * Enable verbose logging
   */
  verbose?: boolean;
}

export interface DevExecutionResult {
  success: boolean;
  summary: string;
  template?: ActivityTemplate;
  improvised: boolean;
  executionId?: string;
  filesModified?: string[];
  error?: string;
  durationMs: number;
  cost: number;
}

// =============================================================================
// MINIBOB DEVELOPMENT EXECUTOR
// =============================================================================

/**
 * MiniBob executor configured for self-development
 */
export class MiniBobDevExecutor {
  private executor: ActivityExecutor;
  private config: MiniBobDevConfig;

  constructor(config: MiniBobDevConfig) {
    this.config = config;

    // Configure logger
    configureLogger({
      minLevel: config.verbose ? "debug" : "info",
    });

    // Create executor config
    const executorConfig: ExecutorConfig = {
      provider: "anthropic",
      model: config.model ?? "claude-sonnet-4-20250514",
      apiKey: config.anthropicApiKey,
      workingDirectory: config.workdir,

      // Event callbacks
      onActivityStarted: (executionId, templateId, templateName) => {
        if (this.config.verbose) {
          console.log(`\x1b[90m[${this.config.instanceId}]\x1b[0m Activity started: ${templateName ?? templateId}`);
          console.log(`\x1b[90m  Execution ID: ${executionId}\x1b[0m`);
        }
      },

      onActivityTaskCompleted: (executionId, taskId, taskDescription, status) => {
        const statusColor = status === "completed" ? "\x1b[32m" : "\x1b[33m";
        const statusSymbol = status === "completed" ? "✓" : "⚠";
        console.log(`${statusColor}${statusSymbol}\x1b[0m ${taskDescription}`);

        if (this.config.verbose) {
          console.log(`\x1b[90m  Task ID: ${taskId}, Status: ${status}\x1b[0m`);
        }
      },

      onActivityCompleted: (execution) => {
        const successColor = execution.status === "completed" ? "\x1b[32m" : "\x1b[31m";
        const statusSymbol = execution.status === "completed" ? "✓" : "✗";
        console.log(`\n${successColor}${statusSymbol}\x1b[0m Activity ${execution.status}`);

        if (this.config.verbose) {
          console.log(`\x1b[90m  Duration: ${execution.metrics?.duration ?? 0}ms\x1b[0m`);
          console.log(`\x1b[90m  Cost: $${(execution.metrics?.cost ?? 0).toFixed(4)}\x1b[0m`);
          if (execution.executionTrace?.filesModified?.length) {
            console.log(`\x1b[90m  Files modified: ${execution.executionTrace.filesModified.length}\x1b[0m`);
          }
        }
      },
    };

    // Create executor
    this.executor = new ActivityExecutor(executorConfig);
  }

  /**
   * Execute a development goal
   */
  async execute(
    goal: string,
    template?: ActivityTemplate,
    impulses: any[] = []
  ): Promise<DevExecutionResult> {
    const startTime = Date.now();

    console.log(`\x1b[36m[${this.config.instanceId}]\x1b[0m Executing development goal`);
    console.log(`\x1b[90m  Goal: ${goal}\x1b[0m`);
    console.log(`\x1b[90m  Workdir: ${this.config.workdir}\x1b[0m`);
    console.log(`\x1b[90m  Backend: ${this.config.backend}\x1b[0m`);

    if (template) {
      console.log(`\x1b[90m  Template: ${template.name}\x1b[0m`);
    } else {
      console.log(`\x1b[33m  Mode: Improvisation (no template)\x1b[0m`);
    }

    try {
      // Create execute options
      const executeOptions: ExecuteOptions = {
        template: template ?? this.createImprovisationTemplate(goal),
        variables: {
          goal,
          workdir: this.config.workdir,
        },
        impulses,
        reason: goal,
        onTaskStart: (taskId) => {
          if (this.config.verbose) {
            console.log(`\x1b[90m→ Starting task: ${taskId}\x1b[0m`);
          }
        },
      };

      // Execute
      const execution: MiniBobExecutionResult = await this.executor.execute(executeOptions);

      // Build result
      const success = execution.status === "completed";
      const result: DevExecutionResult = {
        success,
        summary: success ? "Development goal completed successfully" : (execution.error ?? "Development goal failed"),
        template,
        improvised: !template,
        executionId: execution.id,
        filesModified: execution.executionTrace?.filesModified ?? [],
        error: execution.error,
        durationMs: execution.metrics?.duration ?? (Date.now() - startTime),
        cost: execution.metrics?.cost ?? 0,
      };

      // Report results
      console.log();
      if (success) {
        console.log(`\x1b[32m✓\x1b[0m Development goal completed`);
        if (result.filesModified && result.filesModified.length > 0) {
          console.log(`\x1b[90m  Files modified (${result.filesModified.length}):\x1b[0m`);
          result.filesModified.forEach((file) => {
            console.log(`\x1b[90m    - ${file}\x1b[0m`);
          });
        }
      } else {
        console.log(`\x1b[31m✗\x1b[0m Development goal failed`);
        if (result.error) {
          console.log(`\x1b[31m  Error: ${result.error}\x1b[0m`);
        }
      }

      console.log(`\x1b[90m  Duration: ${result.durationMs}ms\x1b[0m`);
      console.log(`\x1b[90m  Cost: $${result.cost.toFixed(4)}\x1b[0m`);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`\x1b[31m✗\x1b[0m Execution failed: ${message}`);

      return {
        success: false,
        summary: "Execution failed",
        improvised: !template,
        error: message,
        durationMs: Date.now() - startTime,
        cost: 0,
      };
    }
  }

  /**
   * Create an improvisation template for a goal
   */
  private createImprovisationTemplate(goal: string): ActivityTemplate {
    return {
      id: `dev-improvise-${Date.now()}`,
      name: "Development Improvisation",
      description: `Improvised development for: ${goal}`,
      category: "feature",
      variables: [
        { name: "goal", type: "string", description: "The development goal", required: true },
        { name: "workdir", type: "string", description: "Working directory", required: true },
      ],
      tasks: [
        {
          id: "achieve-dev-goal",
          description: "Achieve the development goal",
          prompt: {
            template: `You are developing microplastic - a composite vessel agent-IDE.

Development Goal:
{goal}

Working Directory: {workdir}

Instructions:
1. Read relevant files to understand the current implementation
2. Plan the changes needed to achieve the goal
3. Implement the changes using available tools (read, write, edit, bash)
4. Test your changes to ensure they work correctly
5. Report what you accomplished

Be thorough but efficient. Follow existing code patterns and conventions.`,
            variables: [
              { name: "goal", type: "string", required: true },
              { name: "workdir", type: "string", required: true },
            ],
          },
          validation: {},
          retry: { maxAttempts: 2, strategy: "simple" },
        },
      ],
      metadata: {
        scope: "development",
        instance: this.config.instanceId,
        improvised: true,
      },
    };
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize MiniBob for self-development
 */
export function initializeMiniBobForDev(config: MiniBobDevConfig): MiniBobDevExecutor {
  // Validate config
  if (!config.workdir) {
    throw new Error("workdir is required");
  }
  if (!config.backend) {
    throw new Error("backend is required");
  }
  if (!config.apiKey) {
    throw new Error("apiKey is required");
  }
  if (!config.instanceId) {
    throw new Error("instanceId is required");
  }
  if (!config.anthropicApiKey) {
    throw new Error("anthropicApiKey is required");
  }

  return new MiniBobDevExecutor(config);
}
