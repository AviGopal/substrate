/**
 * Failure Module
 *
 * Failure analysis, recovery, and variant creation.
 */

// Types
export type {
  FailureCategory,
  FailureSeverity,
  FailurePoint,
  RootCauseAnalysis,
  SuggestedFix,
  FailureAnalysis,
  RecoveryOption,
  RecoveryContext,
  RecoveryDecision,
  RecoveryResult,
  VariantModifications,
  VariantLineage,
  VariantTemplate,
  FailurePattern,
} from "./types.ts";

export { DEFAULT_FAILURE_PATTERNS } from "./types.ts";

// Analyzer
export {
  FailureAnalyzer,
  type FailureContext,
} from "./analyzer.ts";

// Recovery
export {
  RecoveryManager,
  type RecoveryEvent,
  type RecoveryCallbacks,
  type RecoveryManagerOptions,
} from "./recovery.ts";

// Variant
export {
  VariantCreator,
  type VariantCreationOptions,
} from "./variant.ts";
