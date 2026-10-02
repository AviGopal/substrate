/**
 * VERIFY: audit-test-report subscriber fires on test_report emission.
 *
 * audit-test-report.json subscribes lifecycle:execution:succeeded with
 * filter output_shapes_contains:"test_report". Now that task 40 is
 * resolved (subscriber-dispatch seeding works), this script demonstrates
 * the full subscriber chain end-to-end:
 *
 *   1. Parent template emits an impulse with shape="test_report"
 *   2. Engine fires lifecycle:execution:succeeded with outputShapes
 *      including "test_report"
 *   3. audit-test-report subscriber matches, dispatcher runs it nested
 *   4. audit-test-report's task chain executes (or fails gracefully on
 *      missing resolvers — the load-bearing demonstration is that it
 *      FIRES, not that it completes; its tasks use impulse-resolve and
 *      LLM resolvers we haven't ported)
 *
 * Loop discipline: VERIFY iteration confirming task 40 fix unlocks the
 * audit-test-report subscriber chain.
 */
export {};
//# sourceMappingURL=test-audit-on-report.d.ts.map