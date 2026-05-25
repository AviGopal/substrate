/**
 * Integration test Phase 4.6 — Cross-vessel composition-chain credit propagation
 *
 * Ports 18.4.7 to a 3-vessel topology:
 *   goal-host-vessel (orchestrator)
 *     → llm-resolver-vessel (parent resolver)
 *       → local-tools-vessel (leaf)
 *
 * Each trace carries a distinct vessel_id. The test asserts that:
 *   1. Cross-vessel composition_chain credit propagation reaches the grandparent
 *      template even when traces originate from different vessels.
 *   2. Δα at the grandparent matches γ^2 = 0.25 (CREDIT_PROPAGATION_GAMMA=0.5, depth 2).
 *
 * This validates that vessel_id is not used as a credit-propagation guard —
 * chain credit flows across the vessel boundary.
 *
 * Run:
 *   METABOB_API_KEY=<key> bun run validation/scripts/test-4-6-cross-vessel-chain-credit.ts
 */

const API_BASE = process.env.METABOB_ENDPOINT ?? 'http://localhost:18080';
const API_KEY = process.env.METABOB_API_KEY;

if (!API_KEY) {
  console.error('FATAL: METABOB_API_KEY is required');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `ApiKey ${API_KEY}`,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
 * Read thompson_alpha for a template from variant_performance_metrics via
 * the activityMetrics impulse resolver. This is the ONLY path that reflects
 * writeAncestorDelta writes (chain credit). v_activity_score is execution-count
 * based and never shows chain credit deltas.
 *
 * Requires the /v2/impulses/resolve endpoint to be accessible (i.e. jwtAuth
 * must be set). Use a local-substrate key issued by seed-identity.ts, not the
 * legacy canary keys (which fail JWT generation silently — see CLAUDE.md).
 */
async function readAlpha(templateId: string): Promise<number | null> {
  const normalizedId = templateId.replace(/^activity:/, '');
  const res = await fetch(`${API_BASE}/v2/impulses/resolve`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      impulse: { pointer: { type: 'activityMetrics', activityId: normalizedId } },
    }),
  });
  if (!res.ok) {
    console.log(`      activityMetrics → ${res.status}: ${JSON.stringify(await res.json().catch(() => null))}`);
    return null;
  }
  const body = await res.json() as { success?: boolean; content?: string };
  if (!body.content) return null;
  // Markdown table: "| 2.0/1.0 |" — last α/β column
  const match = body.content.match(/\|\s*([\d.]+)\/([\d.]+)\s*\|\s*$/m);
  if (!match) return null;
  return parseFloat(match[1]);
}

const TS = Date.now();
const GP_TEMPLATE_ID   = `activity:t46-gp-${TS}`;
const PAR_TEMPLATE_ID  = `activity:t46-par-${TS}`;
const LEAF_TEMPLATE_ID = `activity:t46-leaf-${TS}`;
const GP_EXEC_ID       = `t46-gp-exec-${TS}`;
const PAR_EXEC_ID      = `t46-par-exec-${TS}`;
const LEAF_EXEC_ID     = `t46-leaf-exec-${TS}`;

console.log('=== Phase 4.6: Cross-vessel composition-chain credit propagation ===');
console.log(`API:               ${API_BASE}`);
console.log(`Grandparent tmpl:  ${GP_TEMPLATE_ID}`);
console.log('');

// ── Step 0: Register all three templates ─────────────────────────────────────

console.log('Step 0: Registering 3 templates (gp / parent / leaf)…');
for (const [id, name] of [
  [GP_TEMPLATE_ID, 't46-gp'],
  [PAR_TEMPLATE_ID, 't46-par'],
  [LEAF_TEMPLATE_ID, 't46-leaf'],
]) {
  const r = await apiPost('/v2/activities/templates', {
    id,
    name,
    description: `Phase 4.6 cross-vessel test — ${name}`,
    tags: ['test.integration', 'test.crossvessel'],
    tasks: [],
    output_shapes: ['t46TestOutput'],
  });
  if (r.status >= 400) {
    console.error(`FAIL  Template ${name} registration: ${r.status}`);
    console.error(JSON.stringify(r.body, null, 2));
    process.exit(1);
  }
  console.log(`      ${name}: status ${r.status}`);
}

await sleep(500);

// ── Step 1: Seed grandparent trace (goal-host-vessel) ────────────────────────
// Establishes baseline α=2 for the grandparent.

console.log('\nStep 1: Grandparent seed trace (vessel_id=goal-host-vessel)…');
const gpSeed = await apiPost('/v2/activities/execution-traces', {
  execution_id: GP_EXEC_ID,
  template_id: GP_TEMPLATE_ID,
  variant_id: GP_TEMPLATE_ID,
  success: true,
  duration_ms: 200,
  cost_usd: 0.001,
  vessel_id: 'goal-host-vessel',
  execution_trace: { tasks: [] },
});
if (gpSeed.status >= 400) {
  console.error(`FAIL  GP seed trace: ${gpSeed.status}`);
  process.exit(1);
}
console.log(`      GP seed stored — status ${gpSeed.status}`);

await sleep(2000);

// ── Step 2: Capture baseline α ───────────────────────────────────────────────

console.log('\nStep 2: Baseline α for grandparent…');
const baselineAlpha = await readAlpha(GP_TEMPLATE_ID);
if (baselineAlpha === null) {
  console.error('FAIL  Could not read baseline α — check template registration and API key');
  process.exit(1);
}
console.log(`      Baseline α = ${baselineAlpha}`);

// ── Step 3: Parent trace (llm-resolver-vessel), root-first chain=[gp] ────────

console.log('\nStep 3: Parent trace (vessel_id=llm-resolver-vessel, chain=[gp])…');
const parTrace = await apiPost('/v2/activities/execution-traces', {
  execution_id: PAR_EXEC_ID,
  template_id: PAR_TEMPLATE_ID,
  variant_id: PAR_TEMPLATE_ID,
  success: true,
  duration_ms: 500,
  cost_usd: 0.005,
  vessel_id: 'llm-resolver-vessel',
  parent_execution_id: GP_EXEC_ID,
  composition_chain: [GP_EXEC_ID],
  execution_trace: { tasks: [] },
});
if (parTrace.status >= 400) {
  console.error(`FAIL  Parent trace: ${parTrace.status}`);
  process.exit(1);
}
console.log(`      Parent trace stored — status ${parTrace.status}`);

// ── Step 4: Leaf trace (local-tools-vessel), chain=[gp, parent] ──────────────

console.log('\nStep 4: Leaf trace (vessel_id=local-tools-vessel, chain=[gp, parent])…');
const leafTrace = await apiPost('/v2/activities/execution-traces', {
  execution_id: LEAF_EXEC_ID,
  template_id: LEAF_TEMPLATE_ID,
  variant_id: LEAF_TEMPLATE_ID,
  success: true,
  duration_ms: 300,
  cost_usd: 0.002,
  vessel_id: 'local-tools-vessel',
  parent_execution_id: PAR_EXEC_ID,
  // root-first: grandparent at index 0, parent at index 1
  composition_chain: [GP_EXEC_ID, PAR_EXEC_ID],
  execution_trace: { tasks: [] },
});
if (leafTrace.status >= 400) {
  console.error(`FAIL  Leaf trace: ${leafTrace.status}`);
  process.exit(1);
}
console.log(`      Leaf trace stored — status ${leafTrace.status}`);

// ── Step 5: Wait for fire-and-forget credit propagation ──────────────────────

console.log('\nStep 5: Waiting 4 000 ms for chain-credit propagation…');
await sleep(4000);

// ── Step 6: Read updated α for grandparent ───────────────────────────────────

console.log('\nStep 6: Reading updated α for grandparent template…');
const updatedAlpha = await readAlpha(GP_TEMPLATE_ID);
if (updatedAlpha === null) {
  console.error('FAIL  Could not read updated α');
  process.exit(1);
}
console.log(`      Updated α = ${updatedAlpha}`);

const alphaDelta = updatedAlpha - baselineAlpha;
console.log(`      Δα         = ${alphaDelta.toFixed(4)}`);

// ── Step 7: Assert ───────────────────────────────────────────────────────────

console.log('\n── Assertion ─────────────────────────────────────────────────────────────');
// Expected: γ^2 = 0.5^2 = 0.25.  Tolerance ±0.15 (accounts for .toFixed(1) rounding).
const EXPECTED = 0.25;
const TOLERANCE = 0.15;
const PASSED = Math.abs(alphaDelta - EXPECTED) <= TOLERANCE;

if (PASSED) {
  console.log(`PASS  Δα = ${alphaDelta.toFixed(4)} ≈ ${EXPECTED} (γ^2=0.25). Cross-vessel chain credit propagated correctly.`);
  process.exit(0);
} else {
  console.error(`FAIL  Δα = ${alphaDelta.toFixed(4)}, expected ${EXPECTED} ± ${TOLERANCE}.`);
  console.error('      Hypothesis: chain credit is not propagating across vessel boundaries.');
  console.error('      Check: propagateCreditAlongChain in activity-api traces route — is vessel_id filtered?');
  process.exit(1);
}
