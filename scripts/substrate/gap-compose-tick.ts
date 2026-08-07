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
 *
 * BOUNDED DRAIN, not one-shot. This fired `gap_to_feature` exactly ONCE per service
 * start, and the service starts event-driven with a 60s debounce — so the authoring
 * loop drained at roughly one gap per minute at best against a measured backlog of
 * 465 open gaps (174 edit_intent_route, 58 orphaned_capability, 56 missing_capability).
 *
 * That throughput is why "the system observes its own failures" does not become
 * "grows from them". Observed directly: two `missing-verifier-*` gaps filed by the
 * reach gate were picked up repeatedly by the event trigger and never authored,
 * because each pickup serviced one unrelated gap from the front of a queue two
 * orders of magnitude larger. The loop was wired and firing and starved.
 *
 * Draining a bounded batch per tick raises throughput without removing any gate:
 * every gap still goes through the same feature_compose typecheck/rollback path.
 * The bound and the wall-clock budget exist so a tick cannot run away — this is a
 * maintenance loop, not a queue worker, and an unbounded drain would hold the
 * change window for as long as the backlog lasts.
 */
const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const APPLY = process.env.GAP_COMPOSE_TRIAGE !== "1"; // autonomous author by default; GAP_COMPOSE_TRIAGE=1 to opt OUT
const CATEGORY = process.env.GAP_COMPOSE_CATEGORY; // optional filter
// Bounded so a tick cannot run away: at most BATCH gaps, and never past DEADLINE_MS
// of wall clock. Both are deliberately small — the point is to stop draining at ONE
// per tick, not to turn a maintenance loop into a queue worker.
const BATCH = 5;
const DEADLINE_MS = 12 * 60_000;

/** One gap through the composer. Returns the report body, or null if the call failed. */
async function composeOne(): Promise<Record<string, unknown> | null> {
  const resp = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      impulse: { type: "gap_to_feature", dry_run: !APPLY, ...(CATEGORY ? { category: CATEGORY } : {}) },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!resp.ok) { console.log(JSON.stringify({ ok: false, http: resp.status })); return null; }
  return ((await resp.json())?.body ?? {}) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const seen = new Set<string>();
  for (let i = 0; i < BATCH; i++) {
    if (Date.now() - startedAt > DEADLINE_MS) { console.log(JSON.stringify({ drained: i, stop: "deadline" })); return; }
    let b: Record<string, unknown> | null;
    try {
      b = await composeOne();
    } catch (e) {
      console.log(JSON.stringify({ ok: false, drained: i, error: e instanceof Error ? e.message : String(e) }));
      return;
    }
    if (!b) return;                                    // transport failure: reported by composeOne
    const gapId = (b["gap_id"] as string | null) ?? null;
    if (!gapId) { console.log(JSON.stringify({ drained: i, stop: "no_open_gap" })); return; }
    // The resolver picks the gap; if it hands back one already serviced this tick it is
    // cycling rather than draining, and continuing would just burn the batch on one row.
    if (seen.has(gapId)) { console.log(JSON.stringify({ drained: i, stop: "repeat_gap", gap_id: gapId })); return; }
    seen.add(gapId);
    const c = (b["compose"] ?? {}) as Record<string, unknown>;
    console.log(JSON.stringify({
      mode: APPLY ? "apply" : "triage",
      n: i + 1,
      gap_id: gapId,
      gap_category: b["gap_category"] ?? null,
      verdict: b["verdict"] ?? null,
      op_count: c["op_count"] ?? null,
      touched: c["touched_vessels"] ?? null,
      landed: b["landed"] ?? null,
      landed_commit: b["landed_commit"] ?? null,
      gap_closed: b["gap_closed"] ?? null,
      note: b["note"] ?? null,
    }));
  }
  console.log(JSON.stringify({ drained: BATCH, stop: "batch_full" }));
}

await main();
