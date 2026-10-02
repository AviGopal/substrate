"use strict";
/**
 * Decision-record completeness metric (Phase G5.2 / IAL 25.5).
 *
 * Scores how thoroughly an activity execution was annotated with the three
 * accountability pillars required by the stratified harness:
 *   A. Thompson-posterior keys on every task (selection transparency)
 *   B. Producer/binding-rationale keys on tasks that consumed impulses
 *   C. failure_mode annotation on every failure (task or trace-level)
 *
 * Final score = (scoreA + scoreB + scoreC) / 3  ∈ [0, 1].
 * Vacuous cases (no binding tasks, no failures) contribute 1.0 so they
 * don't penalise traces that have nothing to annotate.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BINDING_KEYS = exports.POSTERIOR_KEYS = void 0;
exports.scoreDecisionRecordCompleteness = scoreDecisionRecordCompleteness;
exports.aggregateCompleteness = aggregateCompleteness;
/** Keys written by the ActivityRecommendationResolver / Thompson sampler. */
exports.POSTERIOR_KEYS = new Set([
    "posterior_source",
    "thompson_alpha",
    "alpha",
    "selection_alpha",
    "selection_metadata",
    "score_source",
    "method",
]);
/** Keys written by producer_selection / slot-binding resolvers. */
exports.BINDING_KEYS = new Set([
    "producer_rationale",
    "binding_rationale",
    "selected_producer",
    "binding_producer",
    "producer_id",
    "slot_binding",
]);
/**
 * Compute decision-record completeness for a single execution trace.
 * Returns `null` when `tasks` is empty (nothing to measure).
 */
function scoreDecisionRecordCompleteness(tasks, trace) {
    if (tasks.length === 0)
        return null;
    // Criterion A — Thompson posterior presence
    const withPosterior = tasks.filter((t) => {
        if (!t.decision_record)
            return false;
        return Object.keys(t.decision_record).some((k) => exports.POSTERIOR_KEYS.has(k));
    }).length;
    const score_a = withPosterior / tasks.length;
    // Criterion B — binding rationale presence
    const bindingTasks = tasks.filter((t) => (t.input_impulse_ids?.length ?? 0) > 0);
    let score_b;
    if (bindingTasks.length === 0) {
        score_b = 1.0;
    }
    else {
        const withRationale = bindingTasks.filter((t) => {
            if (!t.decision_record)
                return false;
            return Object.keys(t.decision_record).some((k) => exports.BINDING_KEYS.has(k));
        }).length;
        score_b = withRationale / bindingTasks.length;
    }
    // Criterion C — failure annotation presence
    const failedTasks = tasks.filter((t) => t.status === "failed" || t.status === "error");
    const traceIsFailed = trace.status !== "success" && trace.status !== "completed";
    let score_c;
    if (failedTasks.length === 0 && !traceIsFailed) {
        score_c = 1.0;
    }
    else {
        let annotated = 0;
        let total = 0;
        for (const t of failedTasks) {
            total++;
            if (t.failure_mode != null)
                annotated++;
        }
        if (traceIsFailed) {
            total++;
            if (trace.failure_mode != null)
                annotated++;
        }
        score_c = total > 0 ? annotated / total : 1.0;
    }
    const completeness = (score_a + score_b + score_c) / 3;
    return { score_a, score_b, score_c, completeness };
}
/** Aggregate completeness across multiple traces (null entries skipped). */
function aggregateCompleteness(scores) {
    const values = scores
        .filter((s) => s !== null)
        .map((s) => s.completeness);
    if (values.length === 0)
        return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}
//# sourceMappingURL=decision-record-completeness.js.map