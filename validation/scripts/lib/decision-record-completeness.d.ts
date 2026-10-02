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
export interface TaskRecord {
    id?: string;
    status?: string;
    cost_usd?: number;
    activity_id?: string;
    input_impulse_ids?: string[];
    output_impulse_ids?: string[];
    decision_record?: Record<string, unknown>;
    failure_mode?: {
        type?: string;
        reason?: string;
    } | null;
}
export interface TraceRecord {
    status?: string;
    failure_mode?: {
        type?: string;
    } | null;
}
/** Keys written by the ActivityRecommendationResolver / Thompson sampler. */
export declare const POSTERIOR_KEYS: Set<string>;
/** Keys written by producer_selection / slot-binding resolvers. */
export declare const BINDING_KEYS: Set<string>;
export interface DecisionRecordScores {
    /** Fraction of tasks with at least one POSTERIOR_KEY in their decision_record. */
    score_a: number;
    /** Fraction of binding tasks with at least one BINDING_KEY. 1.0 when no binding tasks. */
    score_b: number;
    /** Fraction of failures annotated with failure_mode. 1.0 when no failures. */
    score_c: number;
    /** Mean of the three criteria. */
    completeness: number;
}
/**
 * Compute decision-record completeness for a single execution trace.
 * Returns `null` when `tasks` is empty (nothing to measure).
 */
export declare function scoreDecisionRecordCompleteness(tasks: TaskRecord[], trace: TraceRecord): DecisionRecordScores | null;
/** Aggregate completeness across multiple traces (null entries skipped). */
export declare function aggregateCompleteness(scores: (DecisionRecordScores | null)[]): number | null;
//# sourceMappingURL=decision-record-completeness.d.ts.map