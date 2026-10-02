/**
 * refinement-detectors.ts — G3.3.1 / G4.1.2 / G4.1.3
 *
 * Pure pairwise detectors run between the current run's per-cell aggregates and
 * the prior (baseline) report's aggregates. Complements the E.1 compression
 * detector that lives inline in stratified-harness.ts.
 *
 * - G3.3.1: optimality trend flags — `closing` / `stable` / `regressing`
 *   (ratio moved by more than ±5% vs the prior run; design §D.4).
 * - G4.1.2: tier-descent — per-cell resolver-tier distribution shifted from
 *   llm toward pattern/deterministic (design §E.2, approximated at cell level
 *   because the prior report stores aggregates, not raw traces). Live traces
 *   do NOT populate `resolver_tier` (verified 2026-07-01: null on 100% of
 *   sampled execution_trace_content rows), so tiers are derived from
 *   `resolver_id` when the explicit field is absent and every tier-descent
 *   event is flagged `low_confidence: true` per the Phase-21 gating note in
 *   tasks.md.
 * - G4.1.3: CI-narrowing — Beta-posterior 95% CI width for the cell's dominant
 *   activity shrank by ≥ 0.05 while observed executions grew by ≥ 5
 *   (design §E.3). α/β come from the recommend response's selection_metadata
 *   (the only read path carrying the real variant_performance_metrics
 *   posterior; `thompson_posterior` / `variantMetricsSummary` aggregate the
 *   sparse `execution` table and return the flat prior).
 */
export type OptimalityTrend = "closing" | "stable" | "regressing";
export interface OptimalityCellReport {
    optimality_ratio: number | null;
    trend: OptimalityTrend | null;
}
/**
 * Flag per design §D.4: `closing` when the current ratio improved (shrank) by
 * ≥ 5% vs the prior run, `regressing` when it grew by ≥ 5%, `stable` within
 * ±5%. Null when either run lacks a ratio (e.g. first run, no successful
 * traces, or no shortest-path cache entry).
 */
export declare function computeOptimalityTrend(current: number | null, prior: number | null | undefined): OptimalityTrend | null;
/**
 * Prior reports stored `optimality_ratios` as a bare number map
 * (harness ≤ 25.6); current reports store `{ optimality_ratio, trend }`
 * objects (the shape compare-reports.ts consumes). Accept both.
 */
export declare function extractPriorOptimalityRatio(prior: number | {
    optimality_ratio?: number | null;
} | null | undefined): number | null;
export type ResolverTier = "llm" | "pattern" | "deterministic";
export interface TierDistribution {
    llm: number;
    pattern: number;
    deterministic: number;
    /** Number of tasks that could be tier-classified (explicit or derived). */
    sample_count: number;
    /** Fraction of classified tasks whose tier was derived from resolver_id
     *  rather than an explicit resolver_tier field. */
    derived_fraction: number;
}
export interface TierClassification {
    tier: ResolverTier | null;
    derived: boolean;
}
/**
 * Classify a task's resolver tier. Explicit `resolver_tier` wins when it is a
 * known tier; otherwise derive from `resolver_id` (llm/pattern hints, any
 * other non-empty id is a deterministic resolver — bash, git_status, fs_read,
 * obsidian:write_note, …). Null when neither field is usable.
 */
export declare function classifyResolverTier(resolverTier: string | null | undefined, resolverId: string | null | undefined): TierClassification;
/** Aggregate classified tasks into a per-cell tier distribution. */
export declare function computeTierDistribution(classifications: TierClassification[]): TierDistribution | null;
export interface TierDescentEvent {
    type: "tier_descent";
    cell_id: string;
    description: string;
    prior_value: number | null;
    current_value: number | null;
    prior_tier_distribution: {
        llm: number;
        pattern: number;
        deterministic: number;
    };
    current_tier_distribution: {
        llm: number;
        pattern: number;
        deterministic: number;
    };
    /** Always true until Phase 21's impulse_state_space signature is wired into
     *  trace emission (tasks.md gating note) — and additionally because tiers
     *  are largely derived from resolver_id, not recorded resolver_tier. */
    low_confidence: true;
}
/** Minimum classified tasks per run for the detector to fire. */
export declare const TIER_DESCENT_MIN_SAMPLES = 3;
/** llm-share drop threshold (design §E.2: ≥ 30% of tasks descended). */
export declare const TIER_DESCENT_THRESHOLD = 0.3;
/**
 * Cell-level tier-descent: fires when the llm share dropped by ≥ threshold
 * between runs (mass moved in the descent direction llm → pattern →
 * deterministic) with adequate samples on both sides.
 */
export declare function detectTierDescent(cellId: string, prior: TierDistribution | null | undefined, current: TierDistribution | null | undefined, minSamples?: number, threshold?: number): TierDescentEvent | null;
export interface ThompsonCiSnapshot {
    activity_id: string;
    alpha: number;
    beta: number;
    /** 95% CI width of the Beta(α,β) mean (normal approximation). */
    ci_width: number;
    /** α+β−2 — observed executions under the Beta(1,1) prior. */
    observed_executions: number;
}
/** 95% CI width of the Beta(α,β) mean via the normal approximation:
 *  2 · 1.96 · sqrt(αβ / ((α+β)² (α+β+1))). */
export declare function computeBetaCiWidth(alpha: number, beta: number): number;
export declare function makeThompsonCiSnapshot(activityId: string, alpha: number, beta: number): ThompsonCiSnapshot;
export interface CiNarrowingEvent {
    type: "ci_narrowing";
    cell_id: string;
    description: string;
    prior_value: number | null;
    current_value: number | null;
    activity_id: string;
    prior_ci_width: number;
    current_ci_width: number;
    execution_growth: number;
}
/** CI-width shrink threshold (design §E.3). */
export declare const CI_NARROWING_WIDTH_DROP = 0.05;
/** Minimum execution growth so narrowing reflects evidence, not noise. */
export declare const CI_NARROWING_MIN_EXEC_GROWTH = 5;
/**
 * Fires when the SAME dominant activity's CI width shrank by ≥ 0.05 across
 * consecutive runs while its observed executions grew by ≥ 5.
 */
export declare function detectCiNarrowing(cellId: string, prior: ThompsonCiSnapshot | null | undefined, current: ThompsonCiSnapshot | null | undefined, widthDrop?: number, minExecGrowth?: number): CiNarrowingEvent | null;
//# sourceMappingURL=refinement-detectors.d.ts.map