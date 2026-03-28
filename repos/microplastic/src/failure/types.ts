/**
 * Failure Types
 *
 * Type definitions for failure analysis, recovery, and variant creation.
 */

import type { ActivityTemplate } from "@metabob/minibob";
// Note: ExecutionTrace and ExecutedTask are used internally but not currently needed in types

// =============================================================================
// FAILURE ANALYSIS TYPES
// =============================================================================

/**
 * Categories of failure
 */
export type FailureCategory =
  | "validation"      // Task validation failed
  | "tool_error"      // Tool call returned error
  | "timeout"         // Execution exceeded time limit
  | "resource"        // Resource not found or inaccessible
  | "logic"           // LLM made incorrect decision
  | "external"        // External service failure
  | "unknown";        // Cannot categorize

/**
 * Severity level of failure
 */
export type FailureSeverity = "critical" | "major" | "minor" | "warning";

/**
 * Identified failure point in execution
 */
export interface FailurePoint {
  /** Task ID where failure occurred */
  taskId: string;
  /** Step index within task (tool call index) */
  stepIndex: number;
  /** Tool that failed (if applicable) */
  tool?: string;
  /** Error message */
  error: string;
  /** Timestamp of failure */
  timestamp: number;
}

/**
 * Root cause analysis result
 */
export interface RootCauseAnalysis {
  /** Primary cause of failure */
  primaryCause: string;
  /** Contributing factors */
  contributingFactors: string[];
  /** Evidence supporting this analysis */
  evidence: string[];
  /** Confidence in this analysis (0-1) */
  confidence: number;
}

/**
 * Suggested fix for a failure
 */
export interface SuggestedFix {
  /** Description of the fix */
  description: string;
  /** Type of fix */
  type: "retry" | "modify_input" | "skip_task" | "use_alternative" | "manual";
  /** Confidence this will work (0-1) */
  confidence: number;
  /** Any parameters needed for the fix */
  parameters?: Record<string, unknown>;
}

/**
 * Complete failure analysis
 */
export interface FailureAnalysis {
  /** Execution ID */
  executionId: string;
  /** Template ID */
  templateId: string;
  /** Original goal */
  goal: string;
  /** Category of failure */
  category: FailureCategory;
  /** Severity */
  severity: FailureSeverity;
  /** Point where failure occurred */
  failurePoint: FailurePoint;
  /** Root cause analysis */
  rootCause: RootCauseAnalysis;
  /** Suggested fixes */
  suggestedFixes: SuggestedFix[];
  /** Tasks that completed successfully */
  completedTasks: string[];
  /** Tasks that were skipped */
  skippedTasks: string[];
  /** Analysis timestamp */
  analyzedAt: number;
}

// =============================================================================
// RECOVERY TYPES
// =============================================================================

/**
 * Recovery options available to user
 */
export type RecoveryOption =
  | "retry"           // Retry the failed task
  | "retry_all"       // Retry from beginning
  | "create_variant"  // Create a variant template
  | "investigate"     // Get more details
  | "skip"            // Skip failed task and continue
  | "abandon";        // Give up on this execution

/**
 * Recovery context provided to user
 */
export interface RecoveryContext {
  /** The failure analysis */
  analysis: FailureAnalysis;
  /** Available recovery options */
  options: RecoveryOption[];
  /** Recommended option */
  recommended: RecoveryOption;
  /** Reason for recommendation */
  recommendationReason: string;
}

/**
 * User's recovery decision
 */
export interface RecoveryDecision {
  /** Chosen option */
  option: RecoveryOption;
  /** Any user-provided context */
  userContext?: string;
  /** Modifications to make (for variant creation) */
  modifications?: VariantModifications;
}

/**
 * Result of recovery attempt
 */
export interface RecoveryResult {
  /** Whether recovery succeeded */
  success: boolean;
  /** What action was taken */
  action: RecoveryOption;
  /** New execution ID (if retried) */
  newExecutionId?: string;
  /** New template ID (if variant created) */
  newTemplateId?: string;
  /** Error if recovery failed */
  error?: string;
}

// =============================================================================
// VARIANT TYPES
// =============================================================================

/**
 * Modifications for creating a variant
 */
export interface VariantModifications {
  /** Modified task prompts */
  taskPrompts?: Record<string, string>;
  /** Modified validation rules */
  validation?: Record<string, unknown>;
  /** Additional context to inject */
  additionalContext?: string;
  /** Tasks to skip */
  skipTasks?: string[];
  /** Retry configuration changes */
  retryConfig?: {
    maxAttempts?: number;
    strategy?: "simple" | "progressive-context";
  };
}

/**
 * Variant lineage tracking
 */
export interface VariantLineage {
  /** Parent template ID */
  parentId: string;
  /** Generation number (1 = first variant) */
  generation: number;
  /** What caused this variant to be created */
  creationReason: string;
  /** Failure that triggered variant creation */
  sourceFailure?: {
    executionId: string;
    taskId: string;
    error: string;
  };
  /** Modifications applied */
  modifications: VariantModifications;
  /** When variant was created */
  createdAt: number;
}

/**
 * Created variant template with lineage
 */
export interface VariantTemplate {
  /** The variant template */
  template: ActivityTemplate;
  /** Lineage information */
  lineage: VariantLineage;
}

// =============================================================================
// FAILURE PATTERNS
// =============================================================================

/**
 * Recognized failure pattern
 */
export interface FailurePattern {
  /** Pattern ID */
  id: string;
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Error patterns that match this */
  errorPatterns: RegExp[];
  /** Category this pattern belongs to */
  category: FailureCategory;
  /** Default severity */
  defaultSeverity: FailureSeverity;
  /** Suggested recovery options */
  suggestedRecovery: RecoveryOption[];
  /** Fix suggestions */
  fixSuggestions: string[];
}

/**
 * Default failure patterns
 */
export const DEFAULT_FAILURE_PATTERNS: FailurePattern[] = [
  {
    id: "file_not_found",
    name: "File Not Found",
    description: "A required file does not exist",
    errorPatterns: [/ENOENT/, /no such file/, /file not found/i, /does not exist/i],
    category: "resource",
    defaultSeverity: "major",
    suggestedRecovery: ["retry", "create_variant", "investigate"],
    fixSuggestions: [
      "Check if the file path is correct",
      "Create the missing file first",
      "Use an alternative file",
    ],
  },
  {
    id: "permission_denied",
    name: "Permission Denied",
    description: "Insufficient permissions to access resource",
    errorPatterns: [/EACCES/, /permission denied/i, /access denied/i],
    category: "resource",
    defaultSeverity: "critical",
    suggestedRecovery: ["investigate", "abandon"],
    fixSuggestions: [
      "Check file permissions",
      "Run with elevated privileges",
      "Use a different location",
    ],
  },
  {
    id: "syntax_error",
    name: "Syntax Error",
    description: "Code has syntax errors",
    errorPatterns: [/SyntaxError/, /unexpected token/i, /parse error/i],
    category: "logic",
    defaultSeverity: "major",
    suggestedRecovery: ["create_variant", "retry"],
    fixSuggestions: [
      "Review the generated code for syntax issues",
      "Use a different approach",
    ],
  },
  {
    id: "validation_failed",
    name: "Validation Failed",
    description: "Task output did not meet validation criteria",
    errorPatterns: [/validation failed/i, /required pattern not found/i, /missing required/i],
    category: "validation",
    defaultSeverity: "major",
    suggestedRecovery: ["retry", "create_variant", "skip"],
    fixSuggestions: [
      "Review validation requirements",
      "Modify the approach to meet criteria",
      "Relax validation rules in variant",
    ],
  },
  {
    id: "timeout",
    name: "Timeout",
    description: "Operation exceeded time limit",
    errorPatterns: [/timeout/i, /timed out/i, /exceeded.*limit/i],
    category: "timeout",
    defaultSeverity: "major",
    suggestedRecovery: ["retry", "create_variant"],
    fixSuggestions: [
      "Increase timeout limit",
      "Simplify the task",
      "Break into smaller subtasks",
    ],
  },
  {
    id: "command_failed",
    name: "Command Failed",
    description: "A bash command returned non-zero exit code",
    errorPatterns: [/exit code [1-9]/, /command failed/i, /non-zero exit/i],
    category: "tool_error",
    defaultSeverity: "major",
    suggestedRecovery: ["retry", "investigate", "create_variant"],
    fixSuggestions: [
      "Review command output for errors",
      "Check command dependencies",
      "Use an alternative command",
    ],
  },
  {
    id: "network_error",
    name: "Network Error",
    description: "Network request failed",
    errorPatterns: [/ECONNREFUSED/, /network error/i, /connection refused/i, /fetch failed/i],
    category: "external",
    defaultSeverity: "major",
    suggestedRecovery: ["retry", "investigate"],
    fixSuggestions: [
      "Check network connectivity",
      "Verify the service is running",
      "Retry after a delay",
    ],
  },
];
