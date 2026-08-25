// model-reality-audit.ts — verify the substrate's forward/backward models match
// the reality recorded in traces, and emit substrateGaps for divergences.
//
// WHY: the existing per-trace, windowed detectors (trace-outcome-validity-audit,
// posterior-consistency-audit) have structural blind spots — they skip traces
// with no output_impulse_shapes and only scan the last ~200 traces in a 4h
// window. That is exactly why three model-reality mismatches went undetected for
// weeks: (1) the composition_graph edge table was empty (0 edges) despite 24K
// chained traces; (2) validator-dispatch (the dual-arm FORWARD arm) recorded
// 100% failure with NULL errors — a recording artifact poisoning Thompson; (3)
// the recommend selector regressed to null scores. This audit runs AGGREGATE
// checks over the whole store, which those detectors cannot.
//
// Run inside substrate-live:
//   bun /tmp/model-reality-audit.ts            # report only
//   EMIT_GAPS=1 bun /tmp/model-reality-audit.ts  # also emit substrateGaps
//
// Checks (each is a "does the model match reality?" question):
//   C1 forward-model artifact — high-volume activity pinned at ~0% success with
//      no error evidence (phantom_failure) or ~100% success (phantom_success).
//   C2 reference integrity   — orphan parent_execution_id rate (dangling links).
//   C3 composition coverage  — composition_graph edges vs distinct derivable.
//   C4 selector health       — recommend returns non-null Thompson scores.

const PASS = process.env.SURREALDB_PASSWORD!;
const KEY = process.env.METABOB_API_KEY ?? "";
const AUTH = "Basic " + btoa("root:" + PASS);
const SQL_URL = "http://127.0.0.1:8000/sql";
const API = "http://127.0.0.1:8080";
const DEV = "http://127.0.0.1:8090/v2/impulses/resolve";
const EMIT = process.env.EMIT_GAPS === "1";
const MIN_VOL = Number(process.env.MIN_VOL ?? 500);

async function sql<T = any>(q: string): Promise<T[]> {
  const r = await fetch(SQL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "text/plain", Authorization: AUTH },
    body: "USE NS `activity-system` DB learning_loop;\n" + q,
  });
  const j = (await r.json()) as Array<{ status: string; result: T[] }>;
  const last = j[j.length - 1];
  if (!last || last.status !== "OK") throw new Error("SQL: " + JSON.stringify(j).slice(0, 300));
  return last.result;
}

async function emitGap(gap: Record<string, unknown>) {
  if (!EMIT) return;
  try {
    await fetch(DEV, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
      body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) { console.warn("[audit] emit failed:", (e as Error).message); }
}

const findings: Array<{ check: string; severity: string; detail: string }> = [];
function flag(check: string, severity: string, detail: string, gap?: Record<string, unknown>) {
  findings.push({ check, severity, detail });
  console.log(`  [${severity}] ${check}: ${detail}`);
  if (gap) void emitGap(gap);
}

// ── C1: forward-model artifacts ────────────────────────────────────────────
// Rolling window (30d) keyed on the INDEXED `executed_at` column. `created_at`
// is unindexed and an unbounded GROUP BY full-scanned all 160K+ traces every
// hour; `executed_at` rides idx_activity_executions_executed_at. 30d is chosen
// because effectively the entire current corpus falls within it (verified: 81/81
// activities with ≥MIN_VOL traces are inside 30d, identical to all-time), so the
// detection set is unchanged today while the scan stays index-bounded and
// self-pruning as the store ages — which also matches C1's intent (catch forward-
// model artifacts that are CURRENTLY poisoning Thompson, not historical ones).
const C1_CUT = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
console.log("C1 forward-model artifacts (success-rate pinned at extremes, high volume; last 30d)…");
const byActStatus = await sql<{ activity_id: string; status: string; n: number }>(
  `SELECT activity_id, status, count() AS n FROM v_paradigm_execution_traces WHERE executed_at >= type::datetime("${C1_CUT}") GROUP BY activity_id, status;`,
);
const acts = new Map<string, { total: number; succ: number }>();
for (const r of byActStatus) {
  if (!r.activity_id) continue;
  const a = acts.get(r.activity_id) ?? { total: 0, succ: 0 };
  a.total += r.n; if (r.status === "success" || r.status === "completed") a.succ += r.n;
  acts.set(r.activity_id, a);
}
for (const [act, { total, succ }] of [...acts].sort((x, y) => y[1].total - x[1].total)) {
  if (total < MIN_VOL) continue;
  const rate = succ / total;
  if (rate <= 0.02) {
    // phantom_failure? confirm low error evidence (artifact, not real failure)
    const errs = await sql<{ n: number }>(
      `SELECT count() AS n FROM v_paradigm_execution_traces WHERE activity_id = "${act.replace(/"/g, '\\"')}" AND status = "failure" AND error_message != NONE GROUP ALL;`,
    );
    const withErr = errs[0]?.n ?? 0;
    const artifact = withErr === 0;
    flag("C1.phantom_failure", artifact ? "HIGH" : "MED",
      `${act} — ${total} traces, ${(rate * 100).toFixed(1)}% success, ${withErr} carry a real error${artifact ? " (ARTIFACT: 0% success with NO errors → forward model poisoned; Thompson β-penalises a non-failing activity)" : ""}`,
      artifact ? {
        id: `model-reality-phantom-failure-${act.slice(0, 48)}`.replace(/[^a-z0-9-]/gi, "-"),
        category: "forward_model_artifact", source: "substrate_detected",
        summary: `Forward-model artifact: ${act} recorded ${(rate * 100).toFixed(1)}% success over ${total} traces with ZERO real errors. Recording marks correct runs as failure, β-penalising the activity and detaching P(success|activity) from reality.`,
        detected_at: new Date().toISOString(), status: "open",
        classification_metadata: { detector: "model_reality_consistency_audit", signature: "phantom_failure_no_error", activity_id: act, total, success_rate: rate, traces_with_error: withErr, cite_principle: "outcomes_must_reflect_substantive_work" },
      } : undefined);
  } else if (rate >= 0.98 && total >= MIN_VOL * 2) {
    flag("C1.phantom_success", "LOW", `${act} — ${total} traces, ${(rate * 100).toFixed(1)}% success (suspiciously pinned at 100%; verify against substantive output)`);
  }
}

// ── C2: reference integrity (orphan parent links) ──────────────────────────
console.log("C2 reference integrity (orphan parent_execution_id)…");
const childCount = (await sql<{ n: number }>("SELECT count() AS n FROM v_paradigm_execution_traces WHERE parent_execution_id != NONE AND parent_execution_id != '' GROUP ALL;"))[0]?.n ?? 0;
// sample 500 children, measure resolvable rate
const sample = await sql<{ parent_execution_id: string }>("SELECT parent_execution_id FROM v_paradigm_execution_traces WHERE parent_execution_id != NONE LIMIT 500;");
let resolved = 0;
for (const s of sample) {
  const pid = String(s.parent_execution_id).replace(/^activity_execution_traces:/, "");
  const hit = await sql<{ n: number }>(`SELECT count() AS n FROM v_paradigm_execution_traces WHERE execution_id = "${pid.replace(/"/g, '\\"')}" GROUP ALL;`);
  if ((hit[0]?.n ?? 0) > 0) resolved++;
}
const orphanRate = sample.length ? 1 - resolved / sample.length : 0;
if (orphanRate > 0.2) {
  flag("C2.orphan_parent_links", orphanRate > 0.5 ? "HIGH" : "MED",
    `${(orphanRate * 100).toFixed(0)}% of parent_execution_ids dangle (sample ${resolved}/${sample.length} resolved; ${childCount} children total) → composition model cannot reflect reality for these`,
    {
      id: "model-reality-orphan-parent-links", category: "reference_integrity", source: "substrate_detected",
      summary: `${(orphanRate * 100).toFixed(0)}% of parent_execution_id links resolve to no trace (sample-measured). Most composition structure references parents that were never written or were pruned, so the backward/composition model is structurally incomplete.`,
      detected_at: new Date().toISOString(), status: "open",
      classification_metadata: { detector: "model_reality_consistency_audit", signature: "orphan_parent_links", orphan_rate: orphanRate, sample: sample.length, children_total: childCount },
    });
} else {
  console.log(`  [OK] orphan rate ${(orphanRate * 100).toFixed(0)}%`);
}

// ── C3: composition-graph coverage ─────────────────────────────────────────
console.log("C3 composition-graph coverage…");
const edges = (await sql<{ n: number }>("SELECT count() AS n FROM activity_composition_graph GROUP ALL;"))[0]?.n ?? 0;
if (edges === 0 && childCount > 100) {
  flag("C3.composition_graph_empty", "HIGH", `0 edges despite ${childCount} chained traces → discover-by-shapes / bridge-horizon detector blind`,
    { id: "model-reality-composition-graph-empty", category: "model_coverage", source: "substrate_detected", summary: `activity_composition_graph empty (0 edges) despite ${childCount} traces carrying parent links — composition model not materialized from reality.`, detected_at: new Date().toISOString(), status: "open", classification_metadata: { detector: "model_reality_consistency_audit", signature: "composition_graph_empty", edges, children: childCount } });
} else {
  console.log(`  [OK] ${edges} composition edges present`);
}

// ── C4: selector health ────────────────────────────────────────────────────
console.log("C4 selector health (recommend returns scored candidates)…");
try {
  const r = await fetch(`${API}/v2/activities/recommend`, { method: "POST", headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) }, body: JSON.stringify({ task_description: "detect a failing trace and propose a fix" }), signal: AbortSignal.timeout(15000) });
  const j = (await r.json()) as { recommendations?: Array<{ template_id: string; score?: number | null }> };
  const top = j.recommendations?.[0];
  if (!top || top.score === null || top.score === undefined) {
    flag("C4.selector_unscored", "HIGH", `recommend top candidate has null/absent score (top=${top?.template_id ?? "none"}) → forward selector model degraded`,
      { id: "model-reality-selector-unscored", category: "forward_model_artifact", source: "substrate_detected", summary: `recommend returns candidates with null Thompson scores — the selector's forward model P(success|activity,shape) is not producing usable scores, so goal routing falls back to exact-match and misroutes.`, detected_at: new Date().toISOString(), status: "open", classification_metadata: { detector: "model_reality_consistency_audit", signature: "selector_unscored", top_template: top?.template_id ?? null } });
  } else {
    console.log(`  [OK] recommend top score=${top.score}`);
  }
} catch (e) { flag("C4.selector_unreachable", "MED", `recommend unreachable: ${(e as Error).message}`); }

// ── summary ────────────────────────────────────────────────────────────────
const high = findings.filter((f) => f.severity === "HIGH").length;
console.log(`\n[model-reality-audit] DONE — ${findings.length} findings (${high} HIGH). emit_gaps=${EMIT}`);
console.log(JSON.stringify({ findings, emit_gaps: EMIT }, null, 2));
