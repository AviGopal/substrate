/**
 * Ribosome Types
 *
 * Type definitions for template extraction, caching, and promotion.
 */

import type { ActivityTemplate } from "@metabob/minibob";
import type { ExecutionTrace } from "../internal-types.ts";

// =============================================================================
// EXTRACTION TYPES
// =============================================================================

/**
 * Extraction result from analyzing an execution trace
 */
export interface ExtractionResult {
  /** Extracted template */
  template: ActivityTemplate;
  /** Confidence score (0-1) */
  confidence: number;
  /** Analysis details */
  analysis: ExtractionAnalysis;
}

/**
 * Analysis details from extraction
 */
export interface ExtractionAnalysis {
  /** Number of tasks identified */
  taskCount: number;
  /** Number of tool calls */
  toolCallCount: number;
  /** Files modified during execution */
  filesModified: string[];
  /** Variables identified for parameterization */
  variablesIdentified: string[];
  /** Input shapes detected */
  inputShapes: string[];
  /** Output shapes detected */
  outputShapes: string[];
  /** Warnings or notes from extraction */
  warnings: string[];
}

/**
 * Options for trace extraction
 */
export interface ExtractionOptions {
  /** Minimum task boundary size (steps per task) */
  minTaskSize?: number;
  /** Maximum task boundary size */
  maxTaskSize?: number;
  /** Whether to parameterize file paths */
  parameterizePaths?: boolean;
  /** Category override (infer if not provided) */
  category?: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure";
}

// =============================================================================
// CACHE TYPES
// =============================================================================

/**
 * Cached template with local execution statistics
 */
export interface CachedTemplate {
  /** The activity template */
  template: ActivityTemplate;
  /** Cache metadata */
  metadata: CacheMetadata;
  /** Execution statistics */
  stats: LocalExecutionStats;
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  /** When the template was extracted */
  extractedAt: number;
  /** Source execution ID */
  sourceExecutionId: string;
  /** Original goal that generated this template */
  originalGoal: string;
  /** Extraction confidence score */
  extractionConfidence: number;
  /** Whether promoted to backend */
  promoted: boolean;
  /** When promoted (if applicable) */
  promotedAt?: number;
}

/**
 * Local execution statistics for cached templates
 */
export interface LocalExecutionStats {
  /** Total executions */
  executions: number;
  /** Successful executions */
  successes: number;
  /** Failed executions */
  failures: number;
  /** Average duration (ms) */
  avgDurationMs: number;
  /** Average cost (USD) */
  avgCost: number;
  /** Last execution timestamp */
  lastExecutedAt: number | null;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum number of templates to cache */
  maxTemplates?: number;
  /** Cache TTL in ms */
  cacheTtlMs?: number;
  /** Storage path for persistence */
  storagePath?: string;
}

// =============================================================================
// PROMOTION TYPES
// =============================================================================

/**
 * Promotion criteria for templates
 */
export interface PromotionCriteria {
  /** Minimum executions before considering promotion */
  minExecutions: number;
  /** Minimum success rate (0-1) */
  minSuccessRate: number;
  /** Minimum extraction confidence (0-1) */
  minConfidence?: number;
  /** Maximum age before considering stale (ms) */
  maxAgeMs?: number;
}

/**
 * Promotion decision
 */
export interface PromotionDecision {
  /** Whether to promote */
  shouldPromote: boolean;
  /** Reason for decision */
  reason: string;
  /** Score (0-1) indicating promotion readiness */
  readinessScore: number;
}

/**
 * Promotion result
 */
export interface PromotionResult {
  /** Whether promotion succeeded */
  success: boolean;
  /** Template ID (backend ID if promoted) */
  templateId: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Execution context for template extraction
 */
export interface ExecutionContext {
  /** Execution ID */
  executionId: string;
  /** Original goal */
  goal: string;
  /** Execution trace */
  trace: ExecutionTrace;
  /** Whether execution succeeded */
  success: boolean;
  /** Execution duration (ms) */
  durationMs: number;
  /** Execution cost (USD) */
  cost: number;
  /** Any error from execution */
  error?: string;
}

// =============================================================================
// RIBOSOME CONFIG
// =============================================================================

/**
 * Full ribosome configuration
 */
export interface RibosomeConfig {
  /** Whether ribosome is enabled */
  enabled: boolean;
  /** Extraction options */
  extraction: ExtractionOptions;
  /** Cache configuration */
  cache: CacheConfig;
  /** Promotion criteria */
  promotion: PromotionCriteria;
  /** Whether to auto-promote when threshold met */
  autoPromote: boolean;
}

/**
 * Default ribosome configuration
 */
export const DEFAULT_RIBOSOME_CONFIG: RibosomeConfig = {
  enabled: true,
  extraction: {
    minTaskSize: 1,
    maxTaskSize: 5,
    parameterizePaths: true,
  },
  cache: {
    maxTemplates: 100,
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  promotion: {
    minExecutions: 3,
    minSuccessRate: 0.8,
    minConfidence: 0.5,
  },
  autoPromote: true,
};
