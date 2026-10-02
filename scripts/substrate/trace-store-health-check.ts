#!/usr/bin/env bun
/**
 * trace-store-health-check.ts — periodic trace-store size monitor.
 *
 * Fires the `trace_store_health_observer` resolver on development-vessel, which
 * reads activity-api's GET /metrics/db traceStore block (O(1) counters, never a
 * COUNT over activity_execution_traces) and emits a `substrateGap` (category
 * trace_store_reconciliation) when row_count exceeds the configured cap.
 * Part of openspec change 2026-07-08-substrate-self-managed-db-reconciliation.
 *
 * Read-only + best-effort: logs a one-line verdict, never throws. Wired as the
 * trace-store-health-check.service oneshot on a timer.
 */
const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";

async function main(): Promise<void> {
  try {
    const resp = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "trace_store_health_observer" } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      console.log(JSON.stringify({ ok: false, http: resp.status }));
      return;
    }
    const body = (await resp.json())?.body ?? {};
    console.log(
      JSON.stringify({
        ok: true,
        row_count: body.row_count ?? null,
        cap: body.cap ?? null,
        over_cap: body.over_cap ?? null,
        gap_emitted: body.gap_emitted ?? false,
      }),
    );
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  }
}

await main();
