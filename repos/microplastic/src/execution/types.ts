/**
 * Execution Types
 *
 * Types for goal execution and activity coordination.
 */

import type { ActivityTemplate, Impulse, ActivityExecution } from "@metabob/minibob";
import type { SelectionResult } from "../selection/types.ts";
import type { ImpulseStore } from "../impulse/index.ts";

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Context passed to execution
 */
export interface ExecutionContext {
  /** User's goal */
  goal: string;
  /** Working directory */
  workdir: string;
  /** Input impulses */
  impulses: Impulse[];
  /** Verbose output */
  verbose: boolean;
  /** Dry run mode */
  dryRun: boolean;
}

// =============================================================================
// EXECUTION RESULT
// =============================================================================

/**
 * Result of goal execution
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Selected template (or null if improvised) */
  template: ActivityTemplate | null;
  /** Whether we improvised */
  improvised: boolean;
  /** Execution trace */
  execution: ActivityExecution | null;
  /** Output impulses */
  outputImpulses: Impulse[];
  /** Summary of what was done */
  summary: string;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Estimated cost */
  cost: number;
}

// =============================================================================
// EXECUTION EVENTS
// =============================================================================

/**
 * Events emitted during execution
 */
export type ExecutionEventType =
  | "execution:start"
  | "execution:template_selected"
  | "execution:improvising"
  | "execution:task_start"
  | "execution:task_complete"
  | "execution:tool_call"
  | "execution:tool_result"
  | "execution:thinking"
  | "execution:complete"
  | "execution:failed";

/**
 * Event data for execution events
 */
export interface ExecutionEventData {
  "execution:start": { goal: string; context: ExecutionContext };
  "execution:template_selected": { template: ActivityTemplate; selection: SelectionResult };
  "execution:improvising": { goal: string };
  "execution:task_start": { taskIndex: number; totalTasks: number; taskName: string };
  "execution:task_complete": { taskIndex: number; success: boolean };
  "execution:tool_call": { tool: string; args?: Record<string, unknown> };
  "execution:tool_result": { tool: string; success: boolean; duration?: number };
  "execution:thinking": { thought: string };
  "execution:complete": { result: ExecutionResult };
  "execution:failed": { error: string; result: ExecutionResult };
}

/**
 * Execution event listener
 */
export type ExecutionEventListener<T extends ExecutionEventType> = (
  data: ExecutionEventData[T]
) => void;

// =============================================================================
// EXECUTOR OPTIONS
// =============================================================================

/**
 * Options for the executor
 */
export interface GoalExecutorOptions {
  /** API base URL */
  apiBaseUrl?: string;
  /** API timeout */
  apiTimeout?: number;
  /** API auth token for backend */
  apiAuthToken?: string;
  /** Anthropic API key */
  anthropicApiKey?: string;
  /** LLM model to use */
  model?: string;
  /** Enable trace capture */
  captureTraces?: boolean;
  /**
   * Shared impulse store for emitting execution events as impulses.
   * If provided, executor will emit impulses instead of events.
   */
  impulseStore?: ImpulseStore;
}
