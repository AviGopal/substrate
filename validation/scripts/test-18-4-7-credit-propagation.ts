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

// ── constants ─────────────────────────────────────────────────────────────────

// Well-known production template that reliably appears in /recommend.
const ANCESTOR_DEPTH1 = 'activity:⟨spec-to-enforcement-activity⟩';
const ANCESTOR_QUERY = 'convert written specification to enforcement activity';

// Leaf template ID — unique per run to avoid polluting real posteriors with executions
const TS = Date.now();
const LEAF_TEMPLATE_ID = `activity:test-18-4-7-leaf-${TS}`;

const CREDIT_GAMMA = 0.5; // CREDIT_PROPAGATION_GAMMA in posterior-update.ts
const LEAF_TRACE_COUNT = 5; // Submit this many leaf traces
const EXPECTED_DELTA = LEAF_TRACE_COUNT * CREDIT_GAMMA; // = 2.5

// Accept ≥ 30% of the expected delta to tolerate concurrent real-traffic writes
// that might have happened between the read and the write.
const PASS_THRESHOLD = EXPECTED_DELTA * 0.30; // ≥ 0.75

const PROPAGATION_WAIT_MS = 3000;

// ── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * Read the current Thompson α for ANCESTOR_DEPTH1 via POST /recommend.
 * Returns the α from the first match, or null if not found.
 */
async function readAncestorAlpha(): Promise<number | null> {
  const res = await apiPost('/v2/activities/recommend', {
    task_description: ANCESTOR_QUERY,
    limit: 50,
  });
  if (res.status !== 200 || !Array.isArray(res.body?.recommendations)) {
    return null;
  }
  // Find the first recommendation matching our ancestor ID
  const match = res.body.recommendations.find(
    (r: any) =>
      r.template_id === ANCESTOR_DEPTH1 ||
      r.activity_id === ANCESTOR_DEPTH1,
  );
  if (!match) return null;
  const alpha = match.selection_metadata?.alpha ?? match.alpha ?? null;
  return typeof alpha === 'number' ? alpha : null;
}

async function submitLeafTrace(index: number): Promise<{ status: number; body: any }> {
  return apiPost('/v2/activities/execution-traces', {
    execution_id: `exec:test-18-4-7-leaf-${TS}-${index}`,
    template_id: LEAF_TEMPLATE_ID,
    variant_id: LEAF_TEMPLATE_ID,
    success: true,
    status: 'completed',
    duration_ms: 400,
    cost_usd: 0.0005,
    tokens: { input: 40, output: 15 },
    composition_chain: [ANCESTOR_DEPTH1],
    execution_trace: {
      tasks: [
        {
          id: 'task-1',
          status: 'completed',
          resolver_id: 'bash',
          resolver_tier: 'deterministic',
          success: true,
          duration_ms: 200,
          cost_usd: 0,
          input_impulse_ids: [],
          output_impulse_ids: [],
        },
      ],
    },
  });
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log('=== Integration Test 18.4.7: credit propagation via composition_chain ===');
console.log(`API base           : ${API_BASE}`);
console.log(`Ancestor (depth-1) : ${ANCESTOR_DEPTH1}`);
console.log(`Leaf template      : ${LEAF_TEMPLATE_ID}`);
console.log(`Leaf traces        : ${LEAF_TRACE_COUNT}`);
console.log(`Expected Δα        : ${EXPECTED_DELTA.toFixed(2)} (gamma=${CREDIT_GAMMA} × ${LEAF_TRACE_COUNT} traces)`);
console.log(`Pass threshold     : Δα ≥ ${PASS_THRESHOLD.toFixed(2)} (≥30% of expected)`);
console.log('');

// ── Step 1: read baseline α ──────────────────────────────────────────────────

console.log('Step 1: Reading baseline α for ancestor via /recommend…');
const baselineAlpha = await readAncestorAlpha();
console.log(`  Ancestor "${ANCESTOR_DEPTH1}" baseline α: ${baselineAlpha ?? 'NOT FOUND'}`);

if (baselineAlpha === null) {
  console.error(
    `INCONCLUSIVE: Ancestor not found in top-50 /recommend results for query "${ANCESTOR_QUERY}".`,
  );
  console.error('  Service may be degraded or template has been pruned.');
  process.exit(2);
}
console.log('');

// ── Step 2: submit leaf traces with composition_chain ─────────────────────────

console.log(`Step 2: Submitting ${LEAF_TRACE_COUNT} leaf traces with composition_chain=[${ANCESTOR_DEPTH1}]…`);

for (let i = 0; i < LEAF_TRACE_COUNT; i++) {
  const res = await submitLeafTrace(i);
  if (res.status < 200 || res.status >= 300) {
    console.error(`  FAIL: Trace ${i} returned ${res.status}:`, res.body);
    process.exit(1);
  }
}
console.log(`  ${LEAF_TRACE_COUNT} traces submitted successfully.`);
console.log('');

// ── Step 3: wait for propagation ─────────────────────────────────────────────

console.log(`Step 3: Waiting ${PROPAGATION_WAIT_MS}ms for credit propagation to land…`);
await sleep(PROPAGATION_WAIT_MS);
console.log('');

// ── Step 4: re-read α and compare ────────────────────────────────────────────

console.log('Step 4: Re-reading ancestor α…');
const afterAlpha = await readAncestorAlpha();
console.log(`  Ancestor α after: ${afterAlpha ?? 'NOT FOUND'}`);

if (afterAlpha === null) {
  console.error('INCONCLUSIVE: Ancestor disappeared from /recommend results after trace submission.');
  process.exit(2);
}

const delta = afterAlpha - baselineAlpha;

console.log('');
console.log('── Results ──────────────────────────────────────────────────────────────────');
console.log(`  Baseline α : ${baselineAlpha}`);
console.log(`  After α    : ${afterAlpha}`);
console.log(`  Δα         : ${delta >= 0 ? '+' : ''}${delta.toFixed(4)}`);
console.log(`  Expected   : ≈ +${EXPECTED_DELTA.toFixed(2)} (${LEAF_TRACE_COUNT} × gamma=${CREDIT_GAMMA})`);
console.log(`  Threshold  : ≥ ${PASS_THRESHOLD.toFixed(2)}`);
console.log(`  Result     : ${delta >= PASS_THRESHOLD ? 'PASS ✓' : 'FAIL ✗'}`);
console.log('─────────────────────────────────────────────────────────────────────────────');

if (delta >= PASS_THRESHOLD) {
  console.log('\nRESULT: PASS ✓ — propagateCreditAlongChain fired; ancestor α increased as expected.');
  process.exit(0);
} else if (delta === 0) {
  console.error('\nRESULT: FAIL ✗ — ancestor α did not change at all (Δα = 0).');
  console.error('  Possible causes:');
  console.error('  1. F-V54 fix not deployed (activity-api < 1.20.3)');
  console.error('  2. F-V55: ancestor row has org_id IS NONE; leaf trace has org-scoped org_id;');
  console.error('     propagateCreditAlongChain UPDATE WHERE org_id = $org_id misses the row.');
  console.error('  3. The /recommend α reflects a different (org-scoped) row than the one being updated.');
  process.exit(1);
} else {
  console.error(
    `\nRESULT: FAIL ✗ — Δα=${delta.toFixed(4)} below threshold ${PASS_THRESHOLD.toFixed(2)}.`,
  );
  console.error(
    '  Credit propagation may be working but at reduced efficiency (concurrent traffic?).',
  );
  process.exit(1);
}
