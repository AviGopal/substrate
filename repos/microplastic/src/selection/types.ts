/**
 * Selection Types
 *
 * Type definitions for Thompson Sampling template selection.
 */

import type { ActivityTemplate } from "@metabob/minibob";

// =============================================================================
// THOMPSON SAMPLING TYPES
// =============================================================================

/**
 * Beta distribution parameters for a template
 */
export interface BetaParams {
  /** Success count + prior */
  alpha: number;
  /** Failure count + prior */
  beta: number;
}

/**
 * Template statistics for selection
 */
export interface TemplateStats {
  /** Template ID */
  templateId: string;
  /** Beta distribution parameters */
  params: BetaParams;
  /** Number of executions */
  executionCount: number;
  /** Last execution timestamp */
  lastExecutedAt: number | null;
  /** Average execution time (ms) */
  avgDurationMs: number | null;
  /** Average cost (USD) */
  avgCost: number | null;
}

/**
 * Template recommendation from backend
 */
export interface TemplateRecommendation {
  /** Template definition */
  template: ActivityTemplate;
  /** Sampled score (0-1) */
  score: number;
  /** Match confidence (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
}

/**
 * Selection result
 */
export interface SelectionResult {
  /** Selected template (null if improvisation needed) */
  template: ActivityTemplate | null;
  /** All candidates considered */
  candidates: TemplateRecommendation[];
  /** Whether to improvise */
  shouldImprovise: boolean;
  /** Reason for selection */
  reason: string;
  /** Source of selection (backend or local) */
  source: "backend" | "local" | "cache";
}

// =============================================================================
// GOAL CONTEXT
// =============================================================================

/**
 * Context for goal matching
 */
export interface GoalContext {
  /** User's goal description */
  goal: string;
  /** Detected workspace type */
  workspaceType?: string;
  /** Detected language */
  language?: string;
  /** Detected framework */
  framework?: string;
  /** Tags from goal analysis */
  tags?: string[];
  /** Recent execution history */
  recentTemplates?: string[];
}

// =============================================================================
// EXECUTION OUTCOME
// =============================================================================

/**
 * Outcome of a template execution
 */
export interface ExecutionOutcome {
  /** Template ID */
  templateId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Duration in ms */
  durationMs: number;
  /** Cost in USD */
  cost: number;
  /** Error message if failed */
  error?: string;
}
