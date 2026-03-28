/**
 * Internal Types
 *
 * Type definitions that mirror minibob's internal types.
 * These are used when minibob doesn't export certain types.
 */

// =============================================================================
// TOOL CALL (mirrors minibob's ToolCall)
// =============================================================================

/**
 * Tool call record
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
  };
}

// =============================================================================
// EXECUTION TRACE (mirrors minibob's ExecutionTrace)
// =============================================================================

/**
 * Executed task record
 */
export interface ExecutedTask {
  /** Task ID from template */
  id: string;
  /** Task description */
  description: string;
  /** Actual prompt sent to LLM */
  actualPrompt: string;
  /** Tools called during task */
  toolCalls: ToolCall[];
  /** LLM response */
  response: string;
  /** Validation results */
  validationResults?: {
    requiredFiles: Array<{ path: string; exists: boolean }>;
    requiredPatterns: Array<{ pattern: string; found: boolean }>;
    forbiddenPatterns: Array<{ pattern: string; found: boolean }>;
  };
  /** Task result */
  result: {
    status: "success" | "failure" | "partial";
    error?: string;
    metadata?: Record<string, unknown>;
  };
  /** Input state captured before task */
  inputState?: {
    filesAvailable: string[];
    environment: Record<string, string>;
    impulses: string[];
    variables: Record<string, unknown>;
  };
  /** Output state captured after task */
  outputState?: {
    filesModified: string[];
    filesCreated: string[];
    filesDeleted: string[];
    exitCode?: number;
    stderr?: string;
  };
}

/**
 * Execution trace
 */
export interface ExecutionTrace {
  /** Tasks executed with full context */
  tasks: ExecutedTask[];
  /** Impulses created during execution */
  impulsesCreated: string[];
  /** Files modified */
  filesModified: string[];
  /** Goal context */
  goalContext?: {
    goal: string;
    intent: string;
    context: Record<string, unknown>;
  };
}

// =============================================================================
// TEMPLATE TYPES (mirrors minibob's template types)
// =============================================================================

/**
 * Task validation configuration (matches minibob's TaskValidation)
 */
export interface TaskValidation {
  /** Files that must exist after task */
  requiredFiles?: string[];
  /** Check patterns in task output (string array) or in specific files (object array) */
  requiredPatterns?: string[] | Array<{ file: string; pattern: string }>;
  /** Patterns that must NOT be present in specific files */
  forbiddenPatterns?: Array<{ file: string; pattern: string }>;
  /** Commands to run for validation */
  commands?: Array<{ command: string; expectedOutput?: string }>;
  /** Require task to produce non-empty output */
  requireOutput?: boolean;
}

/**
 * Variable definition for templates (matches minibob exactly)
 */
export interface VariableDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;  // Required in minibob
  description?: string;
  default?: unknown;
}

/**
 * Impulse shape definition (matches minibob's ImpulseShape)
 */
export interface ImpulseShape {
  /** Shape identifier (e.g., "source_code", "error_log", "execution_trace") */
  shape: string;
  /** Human-readable description of expected content */
  description?: string;
  /** Whether this shape can match multiple files/items */
  collection?: boolean;
}

/**
 * Activity input schema (matches minibob exactly)
 */
export interface ActivityInputSchema {
  /** Required impulse shapes - activity won't match without all of these */
  required: ImpulseShape[];
  /** Optional impulse shapes - can use if provided */
  optional?: ImpulseShape[];
}

/**
 * Activity output schema (matches minibob exactly)
 */
export interface ActivityOutputSchema {
  /** Impulse shapes that will be created by this activity */
  produces: ImpulseShape[];
}

// =============================================================================
// EXTENDED METADATA (microplastic-specific extensions)
// =============================================================================

/**
 * Variant lineage tracking
 */
export interface VariantLineage {
  parentId: string;
  generation: number;
  reason: string;
  modifications: string[];
}

/**
 * Extended template metadata for microplastic
 */
export interface ExtendedTemplateMetadata {
  generatedFrom?: "execution" | "goal-seeking" | "manual";
  sourceExecutionId?: string;
  sourceTemplateId?: string;
  firstExecutionMetrics?: {
    duration?: number;
    cost?: number;
    tokens?: number;
  };
  createdAt?: number;
  author?: string;
  inputSchemaInferredFrom?: {
    variables: string[];
    impulseTypes: string[];
  };
  // Microplastic extensions
  primordial?: boolean;
  level?: number;
  initialAlpha?: number;
  initialBeta?: number;
  variantLineage?: VariantLineage;
}
