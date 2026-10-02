#!/usr/bin/env bun
/**
 * progression-driver.ts — Bootstrap the autonomous gap-closing loop.
 *
 * The failure-mode harness measures how many failure-mode scenarios end as
 * `gap` (no matching activity, no emergent trace). The autonomous mechanism
 * that should close those gaps — boredom-operation make-activity cycles —
 * doesn't run yet. This driver fills in for it MANUALLY, one cycle at a
 * time, until the system can carry the loop on its own.
 *
 * Per cycle, the driver:
 *
 *   1. Reads the latest failure-mode-report.json from validation/results/
 *   2. Identifies scenarios with emergence_class='gap'
 *   3. For each gap, records what intervention was required (subagent
 *      dispatch, manual template authoring, operator registration)
 *   4. Writes a cycle-summary JSON tracking `manual_intervention_debt`
 *
 * The KPI is `manual_intervention_debt` strictly decreasing toward zero.
 * Lift = three consecutive cycles where manual_intervention_debt = 0 and
 * the harness-reported gap count still strictly decreases (i.e. the system
 * is closing new gaps without us).
 *
 * Usage:
 *   bun run validation/scripts/progression-driver.ts \
 *     --report validation/results/<date>-failure-mode-baseline.json \
 *     --cycle <N> \
 *     --proposals validation/failure-modes/proposals/ \
 *     [--out validation/failure-modes/cycles/cycle-<N>.json]
 *
 * The driver does NOT itself dispatch subagents — that's done from the
 * conversation. It reads the proposal files (if present), counts them
 * against the gap set, and computes intervention debt.
 */
export {};
//# sourceMappingURL=progression-driver.d.ts.map