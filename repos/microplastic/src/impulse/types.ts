/**
 * Impulse Types
 *
 * Re-exports impulse types from minibob for use in microplastic.
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
