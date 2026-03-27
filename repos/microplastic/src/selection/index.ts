/**
 * Selection Module
 *
 * Thompson Sampling-based template selection.
 */

// Types
export type {
  BetaParams,
  TemplateStats,
  TemplateRecommendation,
  SelectionResult,
  GoalContext,
  ExecutionOutcome,
} from "./types.ts";

// Thompson Sampling
export { ThompsonState, sampleBeta } from "./thompson.ts";

// API Client
export {
  ActivityAPIClient,
  type ActivityAPIClientOptions,
  type ClientState,
} from "./client.ts";

// Offline Cache
export {
  OfflineCache,
  type OfflineCacheOptions,
} from "./offline.ts";

// Selector
export {
  TemplateSelector,
  type TemplateSelectorOptions,
  type SelectorState,
} from "./selector.ts";
