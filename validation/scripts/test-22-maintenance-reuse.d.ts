/**
 * Phase 22.7.8 — Maintenance reuse test
 *
 * Asserts that the existing registry-quality tools (core-activity-audit,
 * replace-activity, vessel metrics) handle a forged vessel's degraded activity
 * exactly like any other degraded activity — zero forge-specific maintenance code.
 *
 * Test strategy (no 20-minute fault injection required):
 *   1. Write a forged-vessel activity template to activity-api (tagged
 *      feature.vessel.forge, output_shapes: ["json_schema_validator"]).
 *   2. Write 10 failure traces for it (failure_mode: verifier_negative)
 *      via POST /v2/activities/execution-traces.
 *   3. Pull activityTemplatesByMetrics and verify the template's Thompson
 *      beta has increased (implying replica failure is tracked).
 *   4. Query templateAuditReport — verify the template appears in the
 *      audit output (no forge exclusion).
 *   5. Query GET /v2/vessels/:id/metrics — verify status is "red" or
 *      "yellow" (degraded), proving the reliability metric works for
 *      forge-vessel-id traces.
 *
 * Usage:
 *   METABOB_API_KEY=mb_... \
 *   bun run validation/scripts/test-22-maintenance-reuse.ts
 */
export {};
//# sourceMappingURL=test-22-maintenance-reuse.d.ts.map