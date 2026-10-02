/**
 * contamination-delta.ts — G7.2.1
 *
 * Computes contamination_delta between a rolling-pool run and a held-out run:
 *
 *   delta = mean(success_rate over rolling-pool cells)
 *           - mean(success_rate over held-out cells)
 *
 * Only cells with sample_count >= 3 and not gated_on_phase_22 contribute.
 * delta > 0.15 → contamination_suspected (G7.2.2).
 */
export interface ContaminationCheckResult {
    delta: number | null;
    contamination_suspected: boolean;
}
interface CellLike {
    sample_count: number;
    success_rate: number | null;
    floor_status?: string;
}
export declare function computeContaminationDelta(rollingMatrix: Record<string, CellLike>, heldOutMatrix: Record<string, CellLike>): ContaminationCheckResult;
export {};
//# sourceMappingURL=contamination-delta.d.ts.map