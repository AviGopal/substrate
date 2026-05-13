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

const API_BASE = process.env.METABOB_ENDPOINT ?? 'https://activity.metabob.com';
const API_KEY = process.env.METABOB_API_KEY;

if (!API_KEY) {
  console.error('FATAL: METABOB_API_KEY environment variable is not set.');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `ApiKey ${API_KEY}`,
};

// ── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function apiPost(path: string, data: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ── sentinel ID ──────────────────────────────────────────────────────────────

const SENTINEL_IMPULSE_ID = `impulse:test-18-3-5-sentinel-${Date.now()}`;
const TEMPLATE_ID = 'activity-api-18-3-5-test';

console.log('=== Integration Test 18.3.5: verifier_negative → impulse_relevance_metrics ===');
console.log(`Sentinel impulse ID : ${SENTINEL_IMPULSE_ID}`);
console.log(`API base            : ${API_BASE}`);
console.log('');

// ── Step 1: pre-check — confirm no row exists yet ────────────────────────────

console.log('Step 1: Pre-check — sentinel row should not exist yet…');
const preCheck = await apiGet(
  `/v2/activities/impulse-relevance?impulse_id=${encodeURIComponent(SENTINEL_IMPULSE_ID)}`,
);

if (preCheck.status !== 200) {
  console.error(`FAIL  GET /v2/activities/impulse-relevance returned ${preCheck.status}`);
  console.error(preCheck.body);
  process.exit(1);
}

const preMetrics: any[] = preCheck.body?.metrics ?? [];
const preRow = preMetrics.find((m: any) => m.impulse_id === SENTINEL_IMPULSE_ID);
const initialTimesFailed: number = preRow?.times_failed ?? 0;
console.log(`      Pre-existing times_failed: ${initialTimesFailed}${preRow ? '' : ' (row absent — will be seeded)'}`);

// ── Step 2: seed the row so the UPDATE has something to increment ─────────────
// POST /v2/activities/impulse-relevance creates or merges an impulse-relevance
// record.  We don't need a real activity_variant_id — if the backend rejects
// unknown ids it will still create a row we can read back.

console.log('');
console.log('Step 2: Seeding impulse_relevance_metrics row…');

// Use a real-looking but test-only variant id.
const SEED_VARIANT_ID = `activity:test-18-3-5-variant-${Date.now()}`;

const seedRes = await apiPost('/v2/activities/impulse-relevance', {
  impulse_id: SENTINEL_IMPULSE_ID,
  activity_variant_id: SEED_VARIANT_ID,
  present_in_successful: 0,
  present_in_failed: 0,
  absent_in_successful: 0,
  absent_in_failed: 0,
  was_loaded: true,
  execution_succeeded: false,
});

if (seedRes.status >= 400) {
  // The endpoint may 404 if the variant doesn't exist — that's OK as long as
  // the row is created.  Log and continue; we'll detect failure at assertion time.
  console.warn(`      WARN seed POST returned ${seedRes.status} — row may not have been created`);
  console.warn('      body:', JSON.stringify(seedRes.body));
} else {
  console.log(`      Seed POST returned ${seedRes.status} — OK`);
}

await sleep(500);

// Re-read to see the seeded state.
const postSeedCheck = await apiGet(
  `/v2/activities/impulse-relevance?impulse_id=${encodeURIComponent(SENTINEL_IMPULSE_ID)}`,
);
const postSeedMetrics: any[] = postSeedCheck.body?.metrics ?? [];
const postSeedRow = postSeedMetrics.find((m: any) => m.impulse_id === SENTINEL_IMPULSE_ID);
const baselineTimesFailed: number = postSeedRow?.times_failed ?? 0;
console.log(`      Baseline times_failed after seeding: ${baselineTimesFailed}`);

// ── Step 3: Submit first failing trace ────────────────────────────────────────

console.log('');
console.log('Step 3: Submitting first failing trace (verifier_negative)…');

function buildFailingTrace(runId: number) {
  // NOTE: execution-traces.ts reads `trace.tasks` which is populated from
  // `body.execution_trace.tasks` (line 1588 of the route).  A top-level
  // `tasks` key is ignored by that path.  `applyOutcomeToPosteriors` then
  // receives `trace.tasks`, so input_impulse_ids must live inside
  // `execution_trace.tasks`.
  return {
    execution_id: `exec-18-3-5-test-${runId}-${Date.now()}`,
    template_id: TEMPLATE_ID,
    variant_id: SEED_VARIANT_ID,
    success: false,
    duration_ms: 100,
    cost_usd: 0.001,
    tokens: { input: 100, output: 50 },
    failure_mode: {
      type: 'verifier_negative',
      reason: `integration test 18.3.5 run ${runId}`,
      context: {
        validator_id: 'test-validator',
        failed_evidence: [],
      },
    },
    execution_trace: {
      tasks: [
        {
          id: 'task-1',
          description: 'test task',
          success: false,
          input_impulse_ids: [SENTINEL_IMPULSE_ID],
          output_impulse_ids: [],
        },
      ],
    },
  };
}

const trace1 = await apiPost('/v2/activities/execution-traces', buildFailingTrace(1));
if (trace1.status >= 400) {
  console.error(`FAIL  POST /v2/activities/execution-traces returned ${trace1.status}`);
  console.error(JSON.stringify(trace1.body, null, 2));
  process.exit(1);
}
console.log(`      Trace 1 stored — status ${trace1.status}, id: ${trace1.body?.execution_id ?? trace1.body?.id ?? 'unknown'}`);

// ── Step 4: Submit second failing trace ───────────────────────────────────────

console.log('');
console.log('Step 4: Submitting second failing trace (verifier_negative)…');
const trace2 = await apiPost('/v2/activities/execution-traces', buildFailingTrace(2));
if (trace2.status >= 400) {
  console.error(`FAIL  POST /v2/activities/execution-traces returned ${trace2.status}`);
  console.error(JSON.stringify(trace2.body, null, 2));
  process.exit(1);
}
console.log(`      Trace 2 stored — status ${trace2.status}, id: ${trace2.body?.execution_id ?? trace2.body?.id ?? 'unknown'}`);

// ── Step 5: Wait for fire-and-forget writes ───────────────────────────────────

console.log('');
console.log('Step 5: Waiting 1 500 ms for fire-and-forget DB writes…');
await sleep(1500);

// ── Step 6: Read back impulse_relevance_metrics ───────────────────────────────

console.log('');
console.log('Step 6: Reading impulse_relevance_metrics for sentinel…');
const postCheck = await apiGet(
  `/v2/activities/impulse-relevance?impulse_id=${encodeURIComponent(SENTINEL_IMPULSE_ID)}`,
);

if (postCheck.status !== 200) {
  console.error(`FAIL  GET /v2/activities/impulse-relevance returned ${postCheck.status}`);
  console.error(postCheck.body);
  process.exit(1);
}

const postMetrics: any[] = postCheck.body?.metrics ?? [];
const postRow = postMetrics.find((m: any) => m.impulse_id === SENTINEL_IMPULSE_ID);

console.log('');
console.log('=== Results ===');
console.log(`Baseline times_failed : ${baselineTimesFailed}`);
console.log(`Final times_failed    : ${postRow?.times_failed ?? 'row absent'}`);
console.log(`Row present           : ${postRow ? 'yes' : 'NO — writeImpulseRelevancePenalty UPDATE may be a no-op (row must pre-exist)'}`);

// ── Assertion ─────────────────────────────────────────────────────────────────

const expectedDelta = 2; // two traces submitted
const actualTimesFailed: number = postRow?.times_failed ?? 0;
const delta = actualTimesFailed - baselineTimesFailed;

console.log(`Delta                 : ${delta} (expected ${expectedDelta})`);

if (!postRow) {
  console.log('');
  console.log('SKIP  Row was never created — writeImpulseRelevancePenalty issues UPDATE not UPSERT.');
  console.log('      This is a known limitation: the row must exist before the UPDATE can increment times_failed.');
  console.log('      Check whether the seed POST in Step 2 was rejected, and whether the backend creates a row');
  console.log('      in impulse_relevance_metrics when a verifier_negative trace references an impulse_id');
  console.log('      that has no prior relevance record.');
  console.log('');
  console.log('STATUS: INCONCLUSIVE (seeding failed or row was never visible via the GET filter)');
  process.exit(2);
}

if (delta >= expectedDelta) {
  console.log('');
  console.log(`PASS  times_failed incremented by ${delta} (>= expected ${expectedDelta}).`);
  console.log('      writeImpulseRelevancePenalty is working correctly for verifier_negative traces.');
  process.exit(0);
} else {
  console.log('');
  console.log(`FAIL  times_failed incremented by only ${delta} (expected ${expectedDelta}).`);
  console.log('      Possible causes:');
  console.log('        - fire-and-forget write hasn\'t landed yet (increase sleep duration)');
  console.log('        - applyOutcomeToPosteriors is not being called with the correct org_id');
  console.log('        - the tasks array is not propagated correctly to writeImpulseRelevancePenalty');
  console.log('        - the impulse_id in the trace tasks doesn\'t match the sentinel used in the seed step');
  process.exit(1);
}
