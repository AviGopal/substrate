#!/usr/bin/env bun
/**
 * stratified-harness.ts — Phase 25.2 coverage matrix driver.
 *
 * Consumes a generated goals file (from goal-generator.ts), runs recommendations
 * and queries matching traces from activity-api, then emits a 24-cell coverage
 * matrix report.
 *
 * Usage:
 *   bun run validation/scripts/stratified-harness.ts \
 *     --goals validation/generated/<seed>-<date>.json \
 *     [--baseline validation/results/<prior>-stratified-report.json] \
 *     [--label "run label"] \
 *     [--detailed]
 *
 * Config: reads METABOB_ENDPOINT / METABOB_API_KEY or ~/.metabob/config.json.
 */
export {};
//# sourceMappingURL=stratified-harness.d.ts.map