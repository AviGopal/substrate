#!/usr/bin/env bun
/**
 * Trace Collection Pipeline
 *
 * Multi-stage pipeline for collecting and validating execution traces:
 * 1. Execute - Run goals with unified path
 * 2. Capture - Collect execution traces
 * 3. Validate - Check trace completeness
 * 4. Submit - Send to activity.metabob.com
 * 5. Verify - Confirm backend receipt
 * 6. Analyze - Extract metrics
 *
 * Usage:
 *   bun sandbox/trace-pipeline.ts --goal "test goal"
 *   bun sandbox/trace-pipeline.ts --batch goals.json
 */

import { processGoal } from "../src/goal-processor";
import { createLLMClient } from "../src/llm";
import { getMCPClient } from "../src/mcp";
import { getLogger, configureLogger } from "../src/logger";
import type { ActivityExecution, ExecutionTrace } from "../src/types";
import fs from "fs";

const log = getLogger("TracePipeline");

// =============================================================================
// PIPELINE STAGES
// =============================================================================

export interface PipelineStage {
  name: string;
  execute(context: PipelineContext): Promise<PipelineStageResult>;
}

export interface PipelineContext {
  goal: string;
  execution?: ActivityExecution;
  trace?: ExecutionTrace;
  validation?: TraceValidation;
  submission?: SubmissionResult;
  verification?: VerificationResult;
  analysis?: TraceAnalysis;
}

export interface PipelineStageResult {
  success: boolean;
  error?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface TraceValidation {
  complete: boolean;
  missingFields: string[];
  warnings: string[];
  issues: Array<{
    severity: "error" | "warning" | "info";
    message: string;
    field?: string;
  }>;
}

export interface SubmissionResult {
  success: boolean;
  traceId?: string;
  endpoint: string;
  statusCode?: number;
  error?: string;
}

export interface VerificationResult {
  confirmed: boolean;
  traceId?: string;
  backendMetadata?: Record<string, unknown>;
  error?: string;
}

export interface TraceAnalysis {
  resolvers: Array<{
    name: string;
    invocations: number;
    successRate: number;
    averageDuration?: number;
  }>;
  compositions: Array<{
    activityId: string;
    sequence: number;
    success: boolean;
  }>;
  thompsonSampling?: {
    templateId: string;
    alpha: number;
    beta: number;
    sampledValue: number;
  };
  stateNavigation?: {
    initialDistance: number;
    finalDistance: number;
    reductionRate: number;
    steps: number;
  };
  impulseUsage: Array<{
    impulseId: string;
    shape: string;
    loaded: boolean;
    tokenCount?: number;
  }>;
}

// =============================================================================
// STAGE 1: EXECUTE
// =============================================================================

export class ExecuteStage implements PipelineStage {
  name = "Execute";

  async execute(context: PipelineContext): Promise<PipelineStageResult> {
    const startTime = Date.now();

    try {
      log.info(`Executing goal: ${context.goal}`);

      // Create LLM client
      const llmClient = createLLMClient({
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        model: "claude-sonnet-4-20250514",
      });

      // Execute goal
      const execution = await processGoal(context.goal, {
        llmClient,
        maxAttempts: 3,
      });

      context.execution = execution;

      const duration = Date.now() - startTime;

      return {
        success: execution.status === "completed",
        duration,
        metadata: {
          executionId: execution.id,
          status: execution.status,
          taskCount: execution.taskResults.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }
}

// =============================================================================
// STAGE 2: CAPTURE
// =============================================================================

export class CaptureStage implements PipelineStage {
  name = "Capture";

  async execute(context: PipelineContext): Promise<PipelineStageResult> {
    const startTime = Date.now();

    try {
      if (!context.execution) {
        throw new Error("No execution to capture");
      }

      log.info("Capturing execution trace");

      // Extract trace from execution
      const trace = context.execution.executionTrace;
      if (!trace) {
        throw new Error("Execution has no trace");
      }

      context.trace = trace;

      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
        metadata: {
          taskCount: trace.tasks?.length || 0,
          impulsesCreated: trace.impulsesCreated?.length || 0,
          filesModified: trace.filesModified?.length || 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }
}

// =============================================================================
// STAGE 3: VALIDATE
// =============================================================================

export class ValidateStage implements PipelineStage {
  name = "Validate";

  async execute(context: PipelineContext): Promise<PipelineStageResult> {
    const startTime = Date.now();

    try {
      if (!context.trace) {
        throw new Error("No trace to validate");
      }

      log.info("Validating trace completeness");

      const validation: TraceValidation = {
        complete: true,
        missingFields: [],
        warnings: [],
        issues: [],
      };

      // Check required fields
      const requiredFields = ["tasks", "impulsesCreated", "filesModified"];
      for (const field of requiredFields) {
        if (!(field in context.trace)) {
          validation.missingFields.push(field);
          validation.complete = false;
          validation.issues.push({
            severity: "error",
            message: `Missing required field: ${field}`,
            field,
          });
        }
      }

      // Check task completeness
      if (context.trace.tasks) {
        for (let i = 0; i < context.trace.tasks.length; i++) {
          const task = context.trace.tasks[i];
          if (!task.actualPrompt) {
            validation.warnings.push(`Task ${i} missing actualPrompt`);
            validation.issues.push({
              severity: "warning",
              message: `Task ${i} missing actualPrompt`,
              field: `tasks[${i}].actualPrompt`,
            });
          }
          if (!task.toolCalls || task.toolCalls.length === 0) {
            validation.warnings.push(`Task ${i} has no tool calls`);
            validation.issues.push({
              severity: "info",
              message: `Task ${i} has no tool calls (may be resolver-based)`,
              field: `tasks[${i}].toolCalls`,
            });
          }
        }
      }

      // Check state snapshots
      if (!context.trace.beforeSnapshot) {
        validation.warnings.push("Missing beforeSnapshot");
        validation.issues.push({
          severity: "warning",
          message: "Missing beforeSnapshot - state tracking incomplete",
          field: "beforeSnapshot",
        });
      }

      if (!context.trace.afterSnapshot) {
        validation.warnings.push("Missing afterSnapshot");
        validation.issues.push({
          severity: "warning",
          message: "Missing afterSnapshot - state tracking incomplete",
          field: "afterSnapshot",
        });
      }

      context.validation = validation;

      const duration = Date.now() - startTime;

      return {
        success: validation.complete,
        duration,
        metadata: {
          missingFields: validation.missingFields.length,
          warnings: validation.warnings.length,
          issues: validation.issues.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }
}

// =============================================================================
// STAGE 4: SUBMIT
// =============================================================================

export class SubmitStage implements PipelineStage {
  name = "Submit";
  private backend: string;
  private apiKey: string;

  constructor(backend: string, apiKey: string) {
    this.backend = backend;
    this.apiKey = apiKey;
  }

  async execute(context: PipelineContext): Promise<PipelineStageResult> {
    const startTime = Date.now();

    try {
      if (!context.execution || !context.trace) {
        throw new Error("No execution or trace to submit");
      }

      log.info("Submitting trace to backend");

      const endpoint = `${this.backend}/v2/activities/execution-traces`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${this.apiKey}`,
        },
        body: JSON.stringify({
          execution_id: context.execution.id,
          template_id: context.execution.templateId,
          status: context.execution.status,
          trace: context.trace,
          metrics: context.execution.metrics,
        }),
      });

      const result: SubmissionResult = {
        success: response.ok,
        endpoint,
        statusCode: response.status,
      };

      if (response.ok) {
        const data = await response.json();
        result.traceId = data.trace_id || context.execution.id;
      } else {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      context.submission = result;

      const duration = Date.now() - startTime;

      return {
        success: result.success,
        error: result.error,
        duration,
        metadata: {
          statusCode: result.statusCode,
          traceId: result.traceId,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }
}

// =============================================================================
// STAGE 5: VERIFY
// =============================================================================

export class VerifyStage implements PipelineStage {
  name = "Verify";
  private backend: string;
  private apiKey: string;

  constructor(backend: string, apiKey: string) {
    this.backend = backend;
    this.apiKey = apiKey;
  }

  async execute(context: PipelineContext): Promise<PipelineStageResult> {
    const startTime = Date.now();

    try {
      if (!context.submission?.traceId) {
        throw new Error("No trace ID to verify");
      }

      log.info(`Verifying trace: ${context.submission.traceId}`);

      // Query backend for trace
      const endpoint = `${this.backend}/v2/activities/execution-traces/${context.submission.traceId}`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `ApiKey ${this.apiKey}`,
        },
      });

      const result: VerificationResult = {
        confirmed: response.ok,
        traceId: context.submission.traceId,
      };

      if (response.ok) {
        result.backendMetadata = await response.json();
      } else {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      context.verification = result;

      const duration = Date.now() - startTime;

      return {
        success: result.confirmed,
        error: result.error,
        duration,
        metadata: {
          traceId: result.traceId,
          confirmed: result.confirmed,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }
}

// =============================================================================
// STAGE 6: ANALYZE
// =============================================================================

export class AnalyzeStage implements PipelineStage {
  name = "Analyze";

  async execute(context: PipelineContext): Promise<PipelineStageResult> {
    const startTime = Date.now();

    try {
      if (!context.trace) {
        throw new Error("No trace to analyze");
      }

      log.info("Analyzing trace metrics");

      const analysis: TraceAnalysis = {
        resolvers: [],
        compositions: [],
        impulseUsage: [],
      };

      // Analyze resolvers
      const resolverStats = new Map<string, { count: number; successful: number }>();

      for (const task of context.trace.tasks || []) {
        // Extract resolver from metadata or tool calls
        const resolver = this.extractResolver(task);
        if (resolver) {
          const stats = resolverStats.get(resolver) || { count: 0, successful: 0 };
          stats.count++;
          if (task.result?.status === "success") {
            stats.successful++;
          }
          resolverStats.set(resolver, stats);
        }
      }

      for (const [name, stats] of resolverStats.entries()) {
        analysis.resolvers.push({
          name,
          invocations: stats.count,
          successRate: stats.successful / stats.count,
        });
      }

      // Analyze impulse usage
      if (context.execution?.impulses) {
        for (const impulse of context.execution.impulses) {
          analysis.impulseUsage.push({
            impulseId: impulse.id,
            shape: impulse.pointer.type,
            loaded: impulse.loaded,
            tokenCount: impulse.tokenCount,
          });
        }
      }

      // Analyze state navigation (if available)
      if (context.trace.beforeSnapshot && context.trace.afterSnapshot) {
        const beforeShapes = context.trace.beforeSnapshot.availableShapes || [];
        const afterShapes = context.trace.afterSnapshot.availableShapes || [];

        analysis.stateNavigation = {
          initialDistance: beforeShapes.length,
          finalDistance: afterShapes.length,
          reductionRate: beforeShapes.length > 0
            ? (beforeShapes.length - afterShapes.length) / beforeShapes.length
            : 0,
          steps: context.trace.tasks?.length || 0,
        };
      }

      context.analysis = analysis;

      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
        metadata: {
          resolverCount: analysis.resolvers.length,
          impulseCount: analysis.impulseUsage.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  private extractResolver(task: any): string | null {
    // Check metadata first
    if (task.metadata?.resolver) {
      return task.metadata.resolver;
    }

    // Check tool calls
    if (task.toolCalls && task.toolCalls.length > 0) {
      // Return first tool as resolver
      return task.toolCalls[0].name;
    }

    return null;
  }
}

// =============================================================================
// PIPELINE EXECUTOR
// =============================================================================

export class TracePipeline {
  private stages: PipelineStage[];
  private backend: string;
  private apiKey: string;

  constructor(backend: string, apiKey: string) {
    this.backend = backend;
    this.apiKey = apiKey;

    this.stages = [
      new ExecuteStage(),
      new CaptureStage(),
      new ValidateStage(),
      new SubmitStage(backend, apiKey),
      new VerifyStage(backend, apiKey),
      new AnalyzeStage(),
    ];
  }

  /**
   * Execute complete pipeline for a goal
   */
  async execute(goal: string): Promise<PipelineResult> {
    const context: PipelineContext = { goal };
    const stageResults: Record<string, PipelineStageResult> = {};

    log.info(`Starting pipeline for goal: ${goal}`);

    for (const stage of this.stages) {
      log.info(`Stage: ${stage.name}`);

      const result = await stage.execute(context);
      stageResults[stage.name] = result;

      log.info(`${stage.name}: ${result.success ? "✓" : "✗"} (${result.duration}ms)`);

      if (!result.success) {
        log.error(`Pipeline failed at stage: ${stage.name} - ${result.error}`);
        break;
      }
    }

    return {
      goal,
      context,
      stageResults,
      success: Object.values(stageResults).every(r => r.success),
    };
  }

  /**
   * Execute pipeline for multiple goals
   */
  async executeBatch(goals: string[]): Promise<PipelineResult[]> {
    const results: PipelineResult[] = [];

    for (const goal of goals) {
      const result = await this.execute(goal);
      results.push(result);
    }

    return results;
  }
}

export interface PipelineResult {
  goal: string;
  context: PipelineContext;
  stageResults: Record<string, PipelineStageResult>;
  success: boolean;
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  let goal: string | undefined;
  let batchFile: string | undefined;
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--goal":
        goal = args[++i];
        break;
      case "--batch":
        batchFile = args[++i];
        break;
      case "--output":
        outputFile = args[++i];
        break;
      case "--help":
        console.log(`
Trace Collection Pipeline

Usage:
  bun sandbox/trace-pipeline.ts [options]

Options:
  --goal <goal>           Single goal to execute
  --batch <file>          JSON file with array of goals
  --output <file>         Output report file (JSON)
  --help                  Show this help

Examples:
  bun sandbox/trace-pipeline.ts --goal "test goal"
  bun sandbox/trace-pipeline.ts --batch goals.json --output report.json
        `);
        process.exit(0);
    }
  }

  configureLogger({ level: "info" });

  const backend = process.env.METABOB_ENDPOINT || "https://activity.metabob.com";
  const apiKey = process.env.METABOB_API_KEY || "";

  if (!apiKey) {
    console.error("METABOB_API_KEY environment variable required");
    process.exit(1);
  }

  const pipeline = new TracePipeline(backend, apiKey);

  let results: PipelineResult[];

  if (batchFile) {
    const goals = JSON.parse(fs.readFileSync(batchFile, "utf-8"));
    results = await pipeline.executeBatch(goals);
  } else if (goal) {
    const result = await pipeline.execute(goal);
    results = [result];
  } else {
    console.error("Either --goal or --batch required");
    process.exit(1);
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    backend,
    results,
    summary: {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
  };

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${outputFile}`);
  }

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

if (import.meta.main) {
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
