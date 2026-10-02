/**
 * Integration test 18.3.5
 *
 * Verifies that when an execution trace with `failure_mode.type = 'verifier_negative'`
 * is submitted, `impulse_relevance_metrics` shows `times_failed` incremented for
 * each input impulse ID listed in the trace's tasks.
 *
 * Approach:
 *  1. Generate a unique sentinel impulse ID (so we start from a known baseline).
 *  2. Pre-check: GET /v2/activities/impulse-relevance?impulse_id=<sentinel>
 *     (expect zero rows or times_failed=0).
 *  3. POST /v2/activities/execution-traces with failure_mode.type=verifier_negative
 *     and the sentinel ID in tasks[0].input_impulse_ids.
 *  4. Wait 1 000 ms for the fire-and-forget write to land.
 *  5. Post a second identical trace so we can verify the counter increments twice.
 *  6. Wait 1 000 ms again.
 *  7. GET impulse-relevance for the sentinel ID and assert times_failed === 2.
 *
 * NOTE: writeImpulseRelevancePenalty issues an UPDATE (not UPSERT), so the row
 * must already exist in impulse_relevance_metrics for the counter to change.
 * If the row doesn't pre-exist the UPDATE is a no-op in SurrealDB.  The test
 * therefore first seeds the row via POST /v2/activities/impulse-relevance, then
 * proceeds with the two failing traces.
 *
 * Run with:
 *   METABOB_API_KEY=<key> bun run validation/scripts/test-18-3-5-verifier-relevance.ts
 */
export {};
//# sourceMappingURL=test-18-3-5-verifier-relevance.d.ts.map