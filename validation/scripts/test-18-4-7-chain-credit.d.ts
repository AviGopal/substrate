/**
 * Integration test 18.4.7
 *
 * Verifies that composition-chain credit propagation works end-to-end:
 * when a leaf execution succeeds with a 2-deep composition_chain
 * [grandparent_id, parent_id], the grandparent template's α is bumped
 * by γ^2 = 0.25 (CREDIT_PROPAGATION_GAMMA=0.5, depth 2).
 *
 * Approach:
 *  1. Register grandparent activity template (creates variant_performance_metrics row).
 *  2. Submit a successful seed trace for the grandparent (establishes baseline α=2).
 *  3. Read baseline α via activityMetrics impulse resolver (reads variant_performance_metrics
 *     directly — the only path that sees writeAncestorDelta writes).
 *  4. Submit a successful leaf trace with composition_chain=[gp_exec, parent_exec].
 *  5. Wait 2 000 ms for fire-and-forget chain credit propagation.
 *  6. Read updated α via activityMetrics and assert Δα ≈ 0.25 (±0.15 tolerance,
 *     accounting for .toFixed(1) rounding in the markdown format).
 *
 * NOTE: activityMetrics is used (not GET /v2/activities/templates?q=) because the
 * templates endpoint reads from v_activity_score (paradigm execution table), which
 * does NOT reflect writeAncestorDelta writes to variant_performance_metrics. Only
 * activityMetrics reads variant_performance_metrics directly.
 *
 * Grandparent chain depth = 2 from leaf (chain reversed: [parent, gp] → gp at index 1).
 * Expected Δα = γ^2 = 0.5^2 = 0.25.
 *
 * Run with:
 *   METABOB_API_KEY=<key> bun run validation/scripts/test-18-4-7-chain-credit.ts
 */
export {};
//# sourceMappingURL=test-18-4-7-chain-credit.d.ts.map