#!/usr/bin/env bun
/**
 * gap-compose-tick.ts — autonomous maintenance loop: route an open substrateGap
 * through the feature composer (detect -> spec -> author -> verify -> stage).
 *
 * Fires the `gap_to_feature` resolver on development-vessel, which picks an open
 * gap, builds a feature-spec, and dispatches `feature_compose`. FAVORABLE results
 * are STAGED (typecheck-clean in the /vessels runtime); landing flows through the
 * cutover gate / operator.
 *
 * AUTONOMOUS by default: authors+verifies+stages a fix for an open gap every
 * tick. No human switch. GAP_COMPOSE_TRIAGE=1 opts OUT (plan-only) if ever needed.
 * Self-verification (feature_compose typecheck/rollback) + the self-recovery tick
 * are the substrate-side gates that keep this safe.
 */
const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const APPLY = process.env.GAP_COMPOSE_TRIAGE !== "1"; // autonomous author by default; GAP_COMPOSE_TRIAGE=1 to opt OUT
const CATEGORY = process.env.GAP_COMPOSE_CATEGORY; // optional filter

async function main(): Promise<void> {
  try {
    const resp = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        impulse: { type: "gap_to_feature", dry_run: !APPLY, ...(CATEGORY ? { category: CATEGORY } : {}) },
      }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!resp.ok) { console.log(JSON.stringify({ ok: false, http: resp.status })); return; }
    const b = (await resp.json())?.body ?? {};
    const c = b.compose ?? {};
    console.log(JSON.stringify({
      mode: APPLY ? "apply" : "triage",
      gap_id: b.gap_id ?? null,
      gap_category: b.gap_category ?? null,
      verdict: b.verdict ?? null,
      op_count: c.op_count ?? null,
      touched: c.touched_vessels ?? null,
      note: b.note ?? null,
    }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  }
}

await main();
