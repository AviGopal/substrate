/**
 * Impulse Types
 *
 * Re-exports impulse types from minibob for use in microplastic.
 * Extends with subscription predicate types for ImpulseStateSpace.
 */

// Re-export core impulse types from minibob
export type {
  Impulse,
  ImpulsePointer,
  LocalImpulsePointer,
  BackendImpulsePointer,
  ImpulseMetadata,
  ResolverResult,
} from "@metabob/minibob";

// Re-export activity types
export type {
  ActivityTemplate,
  ActivityTask,
} from "@metabob/minibob";

// =============================================================================
// IMPULSE SHAPES
// =============================================================================

/**
 * Well-known impulse shapes for semantic categorization.
 * Shapes describe WHAT the impulse represents, independent of pointer type.
 */
export type ImpulseShape =
  | "goal"              // User intent/request
  | "source_code"       // Code content
  | "error"             // Error information
  | "trace"             // Execution trace
  | "activity"          // Activity execution status
  | "task"              // Task execution status
  | "tool_call"         // Tool invocation
  | "summary"           // Completion summary
  | "code"              // Generated code
  | "diff"              // File diff
  | "notification"      // General notification
  | "improvement_suggestion"  // Cross-pollination suggestion
  | string;             // Extensible

// =============================================================================
// SUBSCRIPTION PREDICATES
// =============================================================================

/**
 * Predicate for filtering impulse subscriptions.
 * All conditions are ANDed together.
 */
export interface SubscriptionPredicate {
  /**
   * Match impulses by pointer type(s).
   * Single string or array of types to match.
   */
  type?: string | string[];

  /**
   * Match impulses by shape(s).
   * Single string or array of shapes to match.
   */
  shape?: ImpulseShape | ImpulseShape[];

  /**
   * Match impulses with priority at or above this level.
   * Priority is encoded as: critical=1000, high=750, medium=500, low=250
   */
  minPriority?: number;

  /**
   * Custom predicate function for complex matching.
   * Called after type/shape/priority checks pass.
   */
  custom?: (impulse: ExtendedImpulse) => boolean;
}

/**
 * Extended impulse type with shape field.
 * Used within microplastic's ImpulseStateSpace.
 */
export interface ExtendedImpulse {
  /** From base Impulse */
  id: string;
  pointer: import("@metabob/minibob").ImpulsePointer;
  budget: number;
  priority: "critical" | "high" | "medium" | "low";
  loaded: boolean;
  content?: string;
  tokenCount?: number;
  metadata?: import("@metabob/minibob").ImpulseMetadata;
  createdAt: number;
  tags?: string[];

  /**
   * Semantic shape of the impulse.
   * Describes WHAT the data represents.
   */
  shape?: ImpulseShape;
}

/**
 * Priority values for numeric comparison.
 */
export const PRIORITY_VALUES: Record<string, number> = {
  critical: 1000,
  high: 750,
  medium: 500,
  low: 250,
};

/**
 * Check if an impulse matches a subscription predicate.
 */
export function matchesPredicate(
  impulse: ExtendedImpulse,
  predicate: SubscriptionPredicate
): boolean {
  // Type check
  if (predicate.type !== undefined) {
    const types = Array.isArray(predicate.type) ? predicate.type : [predicate.type];
    if (!types.includes(impulse.pointer.type)) {
      return false;
    }
  }

  // Shape check
  if (predicate.shape !== undefined) {
    const shapes = Array.isArray(predicate.shape) ? predicate.shape : [predicate.shape];
    if (!impulse.shape || !shapes.includes(impulse.shape)) {
      return false;
    }
  }

  // Priority check
  if (predicate.minPriority !== undefined) {
    const priorityValue = PRIORITY_VALUES[impulse.priority] ?? 0;
    if (priorityValue < predicate.minPriority) {
      return false;
    }
  }

  // Custom predicate
  if (predicate.custom !== undefined) {
    if (!predicate.custom(impulse)) {
      return false;
    }
  }

  return true;
}
