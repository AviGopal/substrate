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

import { ensureTestRegistration, installExitHandler } from "./_test-audit-loop";

const API_BASE = process.env.METABOB_ENDPOINT ?? 'https://activity.metabob.com';
const API_KEY = process.env.METABOB_API_KEY;

if (!API_KEY) {
  console.error('FATAL: METABOB_API_KEY environment variable is not set.');
  process.exit(1);
}

// Test-audit loop instrumentation (OpenSpec 2026-05-18-test-audit-loop Phase F).
// Empty perturbation_schedule marks this as grandfathered; the audit machinery
// will tag missing_sensitivity_history until perturbations are filled in.
const __testAuditRunStart = Date.now();
const __testAuditRunId = `t1847cc-${__testAuditRunStart}`;
void ensureTestRegistration({
  test_id: "validation/scripts/test-18-4-7-chain-credit",
  inputs_schema: { credit_gamma: "number=0.5", chain_depth: "int=2" },
  perturbation_schedule: [],
  goal_alignment: [{
    criterion: "#4-improved-activities",
    discrimination_claim:
      "Validates that composition-chain credit propagation writes γ^depth Δα to ancestor variant_performance_metrics — the mechanism by which Thompson Sampling learns over chains, not just leaves.",
  }],
  discrimination_claim:
    "Discriminates a working chain-credit path from regressions where writeAncestorDelta silently no-ops (the F-V56/F-V57 bug class).",
  witness_types: ["validator_consensus"],
});
installExitHandler(__testAuditRunStart, () => ({
  test_id: "validation/scripts/test-18-4-7-chain-credit",
  run_id: __testAuditRunId,
  passed: (process.exitCode ?? 0) === 0,
  caveats: [],
}));

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `ApiKey ${API_KEY}`,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

/**
 * Read thompson_alpha for a template from variant_performance_metrics via
 * the activityMetrics impulse resolver.  This is the only read path that
 * directly reflects writeAncestorDelta writes (v_activity_score does not).
 *
 * Returns the parsed float α, or null if the template is not found / parse fails.
 */
async function readAlphaFromMetrics(templateId: string): Promise<number | null> {
  const normalizedId = templateId.replace(/^activity:/, '');
  const res = await apiPost('/v2/impulses/resolve', {
    pointer: {
      type: 'activityMetrics',
      activityId: normalizedId,
    },
  });

  if (res.status !== 200 || !res.body?.content) {
    console.log(`      activityMetrics returned ${res.status}: ${JSON.stringify(res.body)}`);
    return null;
  }

  const content: string = res.body.content;
  // Markdown format: "| variant_id | pct | execs | duration | cost | α/β |"
  // Extract the last α/β column: "| 2.0/1.0 |"
  const match = content.match(/\|\s*([\d.]+)\/([\d.]+)\s*\|\s*$/m);
  if (!match) {
    console.log(`      Could not parse α from activityMetrics content:\n${content}`);
    return null;
  }
  return parseFloat(match[1]);
}

const TS = Date.now();
const GP_TEMPLATE_ID = `activity:test-18-4-7-grandparent-${TS}`;
const PARENT_TEMPLATE_ID = `activity:test-18-4-7-parent-${TS}`;
const LEAF_TEMPLATE_ID = `activity:test-18-4-7-leaf-${TS}`;
// Execution IDs stored in composition_chain.  The backend resolves
// exec_id → variant_id via activity_execution_traces before writing to
// variant_performance_metrics.
const GP_EXEC_ID = `test-18-4-7-gp-${TS}`;
const PARENT_EXEC_ID = `test-18-4-7-parent-${TS}`;
const LEAF_EXEC_ID = `test-18-4-7-leaf-${TS}`;

console.log('=== Integration Test 18.4.7: composition-chain credit propagation ===');
console.log(`Grandparent template : ${GP_TEMPLATE_ID}`);
console.log(`API base             : ${API_BASE}`);
console.log('');

// ── Step 0: Register grandparent as an activity_template ─────────────────────
// Must exist in activity_template AND have a variant_performance_metrics row
// before the chain credit write can UPDATE (not INSERT) the α.

console.log('Step 0: Registering grandparent activity template…');

const gpTemplateReg = await apiPost('/v2/activities/templates', {
  id: GP_TEMPLATE_ID,
  name: `test-18-4-7-grandparent-${TS}`,
  description: 'Integration test grandparent template (18.4.7)',
  tags: ['test.integration'],
  tasks: [],
  output_shapes: ['test18ChainCreditOutput'],
});

if (gpTemplateReg.status >= 400) {
  console.error(`FAIL  Grandparent template registration returned ${gpTemplateReg.status}`);
  console.error(JSON.stringify(gpTemplateReg.body, null, 2));
  process.exit(1);
}
console.log(`      Template registered — status ${gpTemplateReg.status}`);

await sleep(500);

// ── Step 1: Seed the grandparent via a direct trace ───────────────────────────
// Establishes baseline α = 2 (prior 1 + 1 success) in variant_performance_metrics.
// Use GP_EXEC_ID as the execution_id — the leaf's composition_chain references
// this execution, and the backend joins back to GP_TEMPLATE_ID as the variant.

console.log('');
console.log('Step 1: Submitting grandparent seed trace (execution_id = GP_EXEC_ID)…');

const gpSeedTrace = await apiPost('/v2/activities/execution-traces', {
  execution_id: GP_EXEC_ID,
  template_id: GP_TEMPLATE_ID,
  variant_id: GP_TEMPLATE_ID,
  success: true,
  duration_ms: 100,
  cost_usd: 0.001,
  tokens: { input: 50, output: 20 },
  execution_trace: { tasks: [] },
});

if (gpSeedTrace.status >= 400) {
  console.error(`FAIL  Grandparent seed trace returned ${gpSeedTrace.status}`);
  console.error(JSON.stringify(gpSeedTrace.body, null, 2));
  process.exit(1);
}
console.log(`      Seed trace stored — status ${gpSeedTrace.status}`);

await sleep(1000);

// ── Step 2: Capture baseline α via activityMetrics ────────────────────────────
// activityMetrics reads variant_performance_metrics directly (the table that
// writeAncestorDelta writes to).  Expected: α = 2.0 (prior 1 + 1 seed success).

console.log('');
console.log('Step 2: Capturing baseline Thompson α via activityMetrics…');

const baselineAlpha = await readAlphaFromMetrics(GP_TEMPLATE_ID);

if (baselineAlpha === null) {
  console.error(`FAIL  Could not read baseline α from activityMetrics`);
  console.error('      Check: is the grandparent template registered? Is the API key valid?');
  process.exit(1);
}
console.log(`      Baseline α: ${baselineAlpha}`);

// ── Step 3: Submit leaf trace with 2-deep composition_chain ───────────────────

console.log('');
console.log('Step 3: Submitting successful leaf trace with composition_chain=[gp, parent]…');

const leafTrace = await apiPost('/v2/activities/execution-traces', {
  execution_id: LEAF_EXEC_ID,
  template_id: LEAF_TEMPLATE_ID,
  variant_id: LEAF_TEMPLATE_ID,
  success: true,
  duration_ms: 500,
  cost_usd: 0.005,
  tokens: { input: 200, output: 100 },
  parent_execution_id: PARENT_EXEC_ID,
  // root-first: grandparent at index 0, parent at index 1
  composition_chain: [GP_EXEC_ID, PARENT_EXEC_ID],
  execution_trace: { tasks: [] },
});

if (leafTrace.status >= 400) {
  console.error(`FAIL  Leaf trace POST returned ${leafTrace.status}`);
  console.error(JSON.stringify(leafTrace.body, null, 2));
  process.exit(1);
}
console.log(`      Leaf trace stored — status ${leafTrace.status}`);

// ── Step 4: Wait for fire-and-forget credit propagation ───────────────────────

console.log('');
console.log('Step 4: Waiting 3 000 ms for credit propagation writes…');
await sleep(3000);

// ── Step 5: Read updated α via activityMetrics ────────────────────────────────

console.log('');
console.log('Step 5: Reading updated α for grandparent template…');

const updatedAlpha = await readAlphaFromMetrics(GP_TEMPLATE_ID);

if (updatedAlpha === null) {
  console.error(`FAIL  Could not read updated α from activityMetrics`);
  process.exit(1);
}
console.log(`      Updated α: ${updatedAlpha}`);

const alphaDelta = updatedAlpha - baselineAlpha;
console.log(`      Δα: ${alphaDelta.toFixed(4)}`);

// ── Step 6: Assert ────────────────────────────────────────────────────────────

console.log('');
console.log('── Assertion ────────────────────────────────────────────────────────────');

// Grandparent is at depth 2 from leaf (chain reversed: [parent, gp] → gp at index 1).
// Expected delta = γ^2 = 0.5^2 = 0.25.
// activityMetrics uses toFixed(1) formatting, so raw 0.25 appears as 0.3 after parse;
// tolerance of 0.15 covers the full rounding band.
const EXPECTED_DELTA = 0.25;
const TOLERANCE = 0.15;

const passed = Math.abs(alphaDelta - EXPECTED_DELTA) <= TOLERANCE;

if (passed) {
  console.log(`PASS: Δα = ${alphaDelta.toFixed(4)}, expected ≈ ${EXPECTED_DELTA} (±${TOLERANCE}) ✓`);
  console.log('');
  console.log('RESULT: PASS — composition-chain credit propagation confirmed end-to-end.');
  process.exit(0);
} else {
  if (alphaDelta === 0) {
    console.error(`FAIL: Δα = 0 — credit propagation did not write to the grandparent template.`);
    console.error('      Check: is propagateCreditAlongChain resolving exec IDs to template IDs?');
    console.error('      The chain entries are execution IDs; the handler must join back to template.');
    console.error(`      Deployment running: ${(await (await fetch(`${API_BASE}/health`)).json())?.version}`);
  } else {
    console.error(`FAIL: Δα = ${alphaDelta.toFixed(4)}, expected ≈ ${EXPECTED_DELTA} (±${TOLERANCE})`);
  }
  process.exit(1);
}
