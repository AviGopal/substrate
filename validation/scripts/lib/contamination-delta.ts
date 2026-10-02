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

export function computeContaminationDelta(
  rollingMatrix: Record<string, CellLike>,
  heldOutMatrix: Record<string, CellLike>
): ContaminationCheckResult {
  function meanSuccessRate(matrix: Record<string, CellLike>): number | null {
    const rates = Object.values(matrix)
      .filter((c) => c.sample_count >= 3 && c.floor_status !== "gated_on_phase_22" && c.success_rate !== null)
      .map((c) => c.success_rate as number);
    return rates.length > 0 ? rates.reduce((s, v) => s + v, 0) / rates.length : null;
  }
  const rollingMean = meanSuccessRate(rollingMatrix);
  const heldMean = meanSuccessRate(heldOutMatrix);
  if (rollingMean === null || heldMean === null) {
    return { delta: null, contamination_suspected: false };
  }
  const delta = rollingMean - heldMean;
  return { delta, contamination_suspected: delta > 0.15 };
}
