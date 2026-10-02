#!/usr/bin/env bun
/**
 * failure-mode-harness.ts — lift-validation harness for the 63-mode failure matrix.
 *
 * For each scenario in validation/failure-modes/scenarios/, dispatches the
 * declared goal_text to POST /v2/activities/recommend, then queries
 * activity-api for traces that match the expected emergent activity
 * signature. Scores per-scenario:
 *
 *   - emergence_class: 'reuse' | 'new' | 'gap'
 *   - self_heal_seconds: time from dispatch to matching trace
 *   - detection_signal_present: whether the failure pattern is detectable
 *     from trace data alone, or requires replay / cross-trace witness
 *
 * Usage:
 *   bun run validation/scripts/failure-mode-harness.ts \
 *     [--scenario <file>] \
 *     [--scenarios <dir>] \
 *     [--label "<run label>"] \
 *     [--out <report.json>] \
 *     [--window-seconds <N>]
 *
 * Config: METABOB_ENDPOINT / METABOB_API_KEY env or ~/.metabob/config.json.
 */
export {};
//# sourceMappingURL=failure-mode-harness.d.ts.map