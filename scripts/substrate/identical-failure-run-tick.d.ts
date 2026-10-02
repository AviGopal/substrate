#!/usr/bin/env bun
/**
 * identical-failure-run-tick — hold the substrate to the operator's standing invariant:
 *
 *     "Identical failures should not be possible."
 *
 * Stated so a machine can test it: NO (activity, failure-class) PAIR SHOULD ACCUMULATE A LONG
 * RUN OF FAILURES WITHOUT SOMETHING CHANGING. A run past the bound with no open gap naming
 * that activity means the system observed the same fact N times and did nothing differently.
 * That — not the counting — is the defect.
 *
 * WHY THIS IS NOT DEDUPLICATION, which was considered and rejected. Collapsing N identical
 * failures into one would make the recurrence arithmetically invisible and would discard real
 * evidence of persistence: an activity failing right now IS less useful right now than one
 * that failed once, whatever the cause. Failures still count as independent samples exactly as
 * decided. What changes is that a RUN of them becomes a reportable condition in its own right.
 *
 * WHY IT IS A SIBLING OF THE REMEDY-LIVELOCK OBSERVER RATHER THAN A WIDENING OF IT. That
 * observer reads the gap-drain log and considers only `action:"dispatched"` entries, so its
 * universe is gap-remedy dispatches. Work driven by a timer or a rhythm never appears there
 * and is structurally invisible to it — which is exactly how a human-surface assist failed
 * every thirty minutes for two days unnoticed. This reads the execution table instead, which
 * every dispatch reaches regardless of who initiated it. The two detectors overlap by design;
 * the drain-log one knows about REMEDIES specifically, this one knows about EVERYTHING.
 *
 * ON "IDENTICAL": grouping is by (activity_id, failure class), where the class is the recorded
 * failure_mode type and `unclassified` when none was recorded. That is deliberately coarse. A
 * finer key would split a genuine run across several buckets and hide it, which is the failure
 * this exists to prevent. Coarse grouping over-reports; fine grouping under-reports; only one
 * of those is self-correcting when a human reads it.
 *
 * READ-ONLY except for gap emission. Never throws into its caller.
 *
 * Env (bootstrap tier only — endpoints and thresholds, no behavioural gating):
 *   IFR_WINDOW_HOURS   lookback window            (default 24)
 *   IFR_MIN_RUN        run length that trips it   (default 25)
 *   DEV_VESSEL_ENDPOINT / SURREALDB_URL           (defaults match the fleet)
 */
export {};
//# sourceMappingURL=identical-failure-run-tick.d.ts.map