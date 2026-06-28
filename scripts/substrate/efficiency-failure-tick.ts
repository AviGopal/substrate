/**
 * efficiency-failure-tick (2026-06-28) — the autonomous DETECTION cadence for
 * self-management + self-improvement. Runs the two emit-gap detectors on a timer so
 * the substrate CONTINUOUSLY surfaces, without operator prompting:
 *   - its own inefficiencies  (efficiency_scan  -> performance_inefficiency gaps)
 *   - its recurring failures  (trace_failure_pattern_report -> systematic_failure gaps)
 * which the existing gap_to_feature -> feature_compose author loop drains.
 *
 * EMIT-ONLY by design: this tick opens gaps; it does NOT apply, restart, or revert
 * anything. The resolution loop (perf_canary_resolve live) restarts running vessels
 * incl. the trace store, so it stays operator-gated — detection is autonomous,
 * irreversible self-modification is supervised.
 */
const DEV = (process.env.DEV_VESSEL_ENDPOINT || "http://127.0.0.1:8090").replace(/\/$/, "");

async function post(impulse: Record<string, unknown>): Promise<any> {
  try {
    const res = await fetch(`${DEV}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse }),
      signal: AbortSignal.timeout(120_000),
    });
    return await res.json().catch(() => ({}));
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function main(): Promise<void> {
  const eff = await post({
    type: "efficiency_scan",
    pointer: { type: "efficiency_scan", emit_gap: true, latency_threshold_ms: 5000 },
  });
  const eb = eff?.body ?? eff;
  console.log(`[efficiency-failure-tick] efficiency_scan: slow=${eb?.slow_probes ?? "?"} gaps_emitted=${eb?.gaps_emitted ?? "?"} ${eb?.error ? "err=" + eb.error : ""}`);

  const fail = await post({
    type: "trace_failure_pattern_report",
    pointer: { type: "trace_failure_pattern_report", limit: 50, min_occurrences: 3, emit_gap: true },
  });
  const fb = fail?.body ?? fail;
  console.log(`[efficiency-failure-tick] failure_patterns: found=${fb?.patterns_found ?? "?"} gaps_emitted=${fb?.gaps_emitted ?? "?"} ${fb?.error ? "err=" + fb.error : ""}`);
}

main().catch((e) => {
  console.error("[efficiency-failure-tick] fatal", e);
  process.exit(1);
});
