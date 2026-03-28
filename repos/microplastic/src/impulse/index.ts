/**
 * Impulse Module
 *
 * Impulse store and types for microplastic.
 * Includes subscription predicates for filtered event handling.
 */

// Types (re-exported from minibob)
export type {
  Impulse,
  ImpulsePointer,
  LocalImpulsePointer,
  BackendImpulsePointer,
  ImpulseMetadata,
  ResolverResult,
  ActivityTemplate,
  ActivityTask,
} from "./types.ts";

// Subscription predicate types
export type {
  ImpulseShape,
  SubscriptionPredicate,
  ExtendedImpulse,
} from "./types.ts";

// Predicate utilities
export { matchesPredicate, PRIORITY_VALUES } from "./types.ts";

// Store
export { ImpulseStore } from "./store.ts";
