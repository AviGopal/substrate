/**
 * Integration test 18.4.7 (spec task 19.3.1)
 *
 * Verifies that submitting an execution trace with a non-empty `composition_chain`
 * causes `propagateCreditAlongChain` to fire and increment α for the ancestors.
 *
 * Strategy:
 *  1. Use `activity:⟨spec-to-enforcement-activity⟩` as the depth-1 ancestor — this
 *     template reliably appears in /recommend results for the query below.
 *  2. Read its α before the test via POST /v2/activities/recommend (select first match).
 *  3. Submit N leaf traces (default 5) with composition_chain = [ANCESTOR_DEPTH1].
 *     CREDIT_PROPAGATION_GAMMA = 0.5 → expected total Δα ≈ N * 0.5.
 *  4. Wait 3s for fire-and-forget writes to land.
 *  5. Re-read α via the same /recommend query and assert Δα ≥ PASS_THRESHOLD.
 *
 * The test may be INCONCLUSIVE (exit 2) if:
 *  - The ancestor doesn't appear in /recommend results (service degradation)
 *  - The ancestor's variant_performance_metrics row has org_id IS NONE while the
 *    leaf traces have an org-scoped org_id — in this case propagateCreditAlongChain
 *    UPDATE (WHERE variant_id = $id AND org_id = $org_id) won't match, and
 *    Δα = 0 indicates F-V55 (cross-scoped credit propagation failure), not a
 *    test harness bug.
 *
 * Exit codes:
 *   0 = pass (ancestor saw Δα ≥ threshold)
 *   1 = fail (ancestor α did not change enough)
 *   2 = inconclusive (posterior unreadable before or after)
 *
 * Requires activity-api 1.20.3+ with F-V54 fix.
 *
 * Run with:
 *   METABOB_API_KEY=<key> bun run validation/scripts/test-18-4-7-credit-propagation.ts
 */
export {};
//# sourceMappingURL=test-18-4-7-credit-propagation.d.ts.map