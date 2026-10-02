#!/usr/bin/env bun
/**
 * db-contention-check.ts — periodic DB-contention monitor.
 *
 * Fires the `db_contention_observer` resolver on development-vessel, which reads
 * activity-api's GET /metrics/db and emits a `substrateGap` (category
 * db_contention) when query latency / in-flight depth / error-rate exceed
 * thresholds. Closes the blind spot from the 2026-06-20 SurrealDB write-storm
 * that nothing self-detected.
 *
 * Read-only + best-effort: logs a one-line verdict, never throws. Wired as the
 * db-contention-check.service oneshot on a timer.
 */
const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";

async function main(): Promise<void> {
  try {
    const resp = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "db_contention_observer" } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      console.log(JSON.stringify({ ok: false, http: resp.status }));
      return;
    }
    const body = (await resp.json())?.body ?? {};
    console.log(JSON.stringify({
      ok: true,
      contention: body.contention ?? null,
      p95_latency_ms: body.p95_latency_ms ?? null,
      in_flight: body.in_flight ?? null,
      error_rate: body.error_rate ?? null,
      anomalies: body.anomalies ?? [],
      gap_emitted: body.gap_emitted ?? false,
    }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  }
}

await main();
