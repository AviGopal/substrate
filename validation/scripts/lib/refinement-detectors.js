"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CI_NARROWING_MIN_EXEC_GROWTH = exports.CI_NARROWING_WIDTH_DROP = exports.TIER_DESCENT_THRESHOLD = exports.TIER_DESCENT_MIN_SAMPLES = void 0;
exports.computeOptimalityTrend = computeOptimalityTrend;
exports.extractPriorOptimalityRatio = extractPriorOptimalityRatio;
exports.classifyResolverTier = classifyResolverTier;
exports.computeTierDistribution = computeTierDistribution;
exports.detectTierDescent = detectTierDescent;
exports.computeBetaCiWidth = computeBetaCiWidth;
exports.makeThompsonCiSnapshot = makeThompsonCiSnapshot;
exports.detectCiNarrowing = detectCiNarrowing;
/**
 * Flag per design §D.4: `closing` when the current ratio improved (shrank) by
 * ≥ 5% vs the prior run, `regressing` when it grew by ≥ 5%, `stable` within
 * ±5%. Null when either run lacks a ratio (e.g. first run, no successful
 * traces, or no shortest-path cache entry).
 */
function computeOptimalityTrend(current, prior) {
    if (current === null || prior === null || prior === undefined || prior <= 0)
        return null;
    if (current < prior * 0.95)
        return "closing";
    if (current > prior * 1.05)
        return "regressing";
    return "stable";
}
/**
 * Prior reports stored `optimality_ratios` as a bare number map
 * (harness ≤ 25.6); current reports store `{ optimality_ratio, trend }`
 * objects (the shape compare-reports.ts consumes). Accept both.
 */
function extractPriorOptimalityRatio(prior) {
    if (prior === null || prior === undefined)
        return null;
    if (typeof prior === "number")
        return prior;
    return prior.optimality_ratio ?? null;
}
const VALID_TIERS = new Set(["llm", "pattern", "deterministic"]);
/** resolver_id substrings that indicate the LLM tier. */
const LLM_ID_HINTS = ["llm", "claude", "anthropic", "improvise", "conversation"];
/** resolver_id substrings that indicate the pattern tier. */
const PATTERN_ID_HINTS = ["pattern", "pre_validation", "prevalidation", "pre-validation"];
/**
 * Classify a task's resolver tier. Explicit `resolver_tier` wins when it is a
 * known tier; otherwise derive from `resolver_id` (llm/pattern hints, any
 * other non-empty id is a deterministic resolver — bash, git_status, fs_read,
 * obsidian:write_note, …). Null when neither field is usable.
 */
function classifyResolverTier(resolverTier, resolverId) {
    if (typeof resolverTier === "string" && VALID_TIERS.has(resolverTier)) {
        return { tier: resolverTier, derived: false };
    }
    const id = (resolverId ?? "").toLowerCase();
    if (!id)
        return { tier: null, derived: false };
    if (LLM_ID_HINTS.some((h) => id.includes(h)))
        return { tier: "llm", derived: true };
    if (PATTERN_ID_HINTS.some((h) => id.includes(h)))
        return { tier: "pattern", derived: true };
    return { tier: "deterministic", derived: true };
}
/** Aggregate classified tasks into a per-cell tier distribution. */
function computeTierDistribution(classifications) {
    const classified = classifications.filter((c) => c.tier !== null);
    if (classified.length === 0)
        return null;
    const n = classified.length;
    const count = (t) => classified.filter((c) => c.tier === t).length;
    return {
        llm: count("llm") / n,
        pattern: count("pattern") / n,
        deterministic: count("deterministic") / n,
        sample_count: n,
        derived_fraction: classified.filter((c) => c.derived).length / n,
    };
}
/** Minimum classified tasks per run for the detector to fire. */
exports.TIER_DESCENT_MIN_SAMPLES = 3;
/** llm-share drop threshold (design §E.2: ≥ 30% of tasks descended). */
exports.TIER_DESCENT_THRESHOLD = 0.30;
/**
 * Cell-level tier-descent: fires when the llm share dropped by ≥ threshold
 * between runs (mass moved in the descent direction llm → pattern →
 * deterministic) with adequate samples on both sides.
 */
function detectTierDescent(cellId, prior, current, minSamples = exports.TIER_DESCENT_MIN_SAMPLES, threshold = exports.TIER_DESCENT_THRESHOLD) {
    if (!prior || !current)
        return null;
    if (prior.sample_count < minSamples || current.sample_count < minSamples)
        return null;
    const drop = prior.llm - current.llm;
    if (drop < threshold)
        return null;
    return {
        type: "tier_descent",
        cell_id: cellId,
        description: `llm tier share dropped from ${prior.llm.toFixed(3)} to ${current.llm.toFixed(3)} ` +
            `(pattern+deterministic absorbed ${drop.toFixed(3)})`,
        prior_value: prior.llm,
        current_value: current.llm,
        prior_tier_distribution: { llm: prior.llm, pattern: prior.pattern, deterministic: prior.deterministic },
        current_tier_distribution: { llm: current.llm, pattern: current.pattern, deterministic: current.deterministic },
        low_confidence: true,
    };
}
/** 95% CI width of the Beta(α,β) mean via the normal approximation:
 *  2 · 1.96 · sqrt(αβ / ((α+β)² (α+β+1))). */
function computeBetaCiWidth(alpha, beta) {
    const n = alpha + beta;
    if (n <= 0)
        return 1;
    const variance = (alpha * beta) / (n * n * (n + 1));
    return 2 * 1.96 * Math.sqrt(variance);
}
function makeThompsonCiSnapshot(activityId, alpha, beta) {
    return {
        activity_id: activityId,
        alpha,
        beta,
        ci_width: computeBetaCiWidth(alpha, beta),
        observed_executions: Math.max(0, Math.round(alpha + beta - 2)),
    };
}
/** CI-width shrink threshold (design §E.3). */
exports.CI_NARROWING_WIDTH_DROP = 0.05;
/** Minimum execution growth so narrowing reflects evidence, not noise. */
exports.CI_NARROWING_MIN_EXEC_GROWTH = 5;
/**
 * Fires when the SAME dominant activity's CI width shrank by ≥ 0.05 across
 * consecutive runs while its observed executions grew by ≥ 5.
 */
function detectCiNarrowing(cellId, prior, current, widthDrop = exports.CI_NARROWING_WIDTH_DROP, minExecGrowth = exports.CI_NARROWING_MIN_EXEC_GROWTH) {
    if (!prior || !current)
        return null;
    if (prior.activity_id !== current.activity_id)
        return null;
    const drop = prior.ci_width - current.ci_width;
    const growth = current.observed_executions - prior.observed_executions;
    if (drop < widthDrop || growth < minExecGrowth)
        return null;
    return {
        type: "ci_narrowing",
        cell_id: cellId,
        description: `Beta CI width for ${current.activity_id} narrowed from ` +
            `${prior.ci_width.toFixed(4)} to ${current.ci_width.toFixed(4)} ` +
            `(+${growth} executions)`,
        prior_value: prior.ci_width,
        current_value: current.ci_width,
        activity_id: current.activity_id,
        prior_ci_width: prior.ci_width,
        current_ci_width: current.ci_width,
        execution_growth: growth,
    };
}
//# sourceMappingURL=refinement-detectors.js.map