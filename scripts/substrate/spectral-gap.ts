#!/usr/bin/env bun
/**
 * spectral-gap.ts — compute the REAL spectral gap of the activity composition graph,
 * not the edge-count proxy.
 *
 * WHY (2026-06-19): the DEC convergence rate is R ~ λ₁·ρ_sample·κ⁻¹, where λ₁ is the
 * spectral gap (credit-mixing speed) of the composition graph. autonomy-metrics tracked
 * λ₁ as raw edge COUNT (28) — which hides topology degeneracy. The live graph is a STAR:
 * one hub (validator-dispatch) at degree ~27, 26 leaves at degree 1. Edge-count says
 * "healthy"; the structure says "hub-and-spoke on a lifecycle hook". As the topology
 * grows, the thing to optimize against (per the operator directive) is keeping the
 * spectral gap HIGH — i.e. a well-MIXED graph with no fragmentation/bottlenecks, so
 * credit propagates across activities rather than dead-ending.
 *
 * Computes, over the (symmetrized, weighted) composition graph:
 *   - components            — # connected components (≥2 ⇒ credit cannot mix ⇒ λ₂=0)
 *   - largest_component_frac — fraction of nodes in the giant component
 *   - fiedler_lambda2        — λ₂ of the normalized Laplacian (the spectral gap; 0..2).
 *                              The real credit-mixing rate. 0 ⇒ disconnected.
 *   - star_ratio             — max_degree / (n-1). 1.0 ⇒ pure star (single hub).
 *   - cheeger_upper          — sqrt(2·λ₂): Cheeger's inequality upper bound on conductance.
 *
 * Pure JS power iteration (graph is small); no eigensolver dep. Deterministic start
 * vector (no Math.random, which is unavailable in some substrate runtimes).
 */
const PASS = (await Bun.file("/etc/substrate/env").text()).match(/SURREAL_PASS=(\S+)/)?.[1] ?? "";
const q = async (sql: string): Promise<any[]> =>
  (await (await fetch("http://127.0.0.1:8000/sql", {
    method: "POST",
    headers: { "Content-Type": "text/plain", Accept: "application/json", "surreal-ns": "activity-system", "surreal-db": "learning_loop", Authorization: "Basic " + btoa("root:" + PASS) },
    body: sql,
  })).json());

const rows = (await q("SELECT parent_activity_id, child_activity_id, execution_count FROM activity_composition_graph;"))[0]?.result ?? [];

// analyze(rowsIn) → spectral metrics over the (symmetrized, weighted) graph built from
// the given edge rows. Factored so we can compute it on TWO graphs:
//   - FULL: every composition edge, INCLUDING lifecycle hooks (validator-dispatch,
//     slot-binding). These hooks nest as a child of EVERY execution, so the hub grows
//     with activity → star_ratio rises and headroom FALLS as the substrate does more
//     work. The full-graph headroom is therefore PERVERSE (more composition → lower
//     headroom) and hides real progress. Kept for continuity/observability.
//   - GENUINE: hooks EXCLUDED — the actual capability→capability topology. This is the
//     HONEST connectivity signal (the governor / headroom should key on THIS). (2026-06-19)
const HOOKS = ["validator-dispatch", "slot-binding"];
const touchesHook = (s: string) => HOOKS.some((h) => (s || "").includes(h));

function analyze(rowsIn: any[]) {
  const idx = new Map<string, number>();
  const id = (s: string): number => { if (!idx.has(s)) idx.set(s, idx.size); return idx.get(s)!; };
  const E: Array<[number, number, number]> = [];
  for (const r of rowsIn) {
    if (!r.parent_activity_id || !r.child_activity_id) continue;
    if (r.parent_activity_id === r.child_activity_id) continue;
    E.push([id(r.parent_activity_id), id(r.child_activity_id), Math.max(1, Number(r.execution_count) || 1)]);
  }
  const n = idx.size;
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [u, v, w] of E) { A[u][v] += w; A[v][u] += w; }
  const deg = A.map((row) => row.reduce((a, b) => a + b, 0));
  const comp = new Array(n).fill(-1);
  let nc = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    nc++; const stack = [s]; comp[s] = nc;
    while (stack.length) { const u = stack.pop()!; for (let v = 0; v < n; v++) if (A[u][v] > 0 && comp[v] === -1) { comp[v] = nc; stack.push(v); } }
  }
  const compSizes: Record<number, number> = {};
  for (const c of comp) compSizes[c] = (compSizes[c] ?? 0) + 1;
  const largest = Math.max(0, ...Object.values(compSizes));
  // Fiedler λ₂ of the normalized Laplacian via deflated power iteration on M=cI-L.
  function fiedler(): number {
    if (n < 2 || nc > 1) return 0; // disconnected ⇒ λ₂ = 0
    const dsqrt = deg.map((d) => (d > 0 ? Math.sqrt(d) : 0));
    const w0 = dsqrt.slice();
    const w0n = Math.hypot(...w0); for (let i = 0; i < n; i++) w0[i] /= (w0n || 1);
    const c = 2;
    const mul = (x: number[]): number[] => {
      const y = new Array(n).fill(0);
      for (let u = 0; u < n; u++) {
        let acc = 0; const du = dsqrt[u] || 1;
        for (let v = 0; v < n; v++) if (A[u][v]) acc += (A[u][v] / (du * (dsqrt[v] || 1))) * x[v];
        y[u] = (c - 1) * x[u] + acc;
      }
      return y;
    };
    let x = Array.from({ length: n }, (_, i) => Math.sin(i + 1) + 0.3 * Math.cos(2 * i + 1));
    const deflate = (v: number[]): void => { let dot = 0; for (let i = 0; i < n; i++) dot += v[i] * w0[i]; for (let i = 0; i < n; i++) v[i] -= dot * w0[i]; };
    deflate(x); let nx = Math.hypot(...x) || 1; x = x.map((v) => v / nx);
    let lamM = 0;
    for (let it = 0; it < 400; it++) {
      let y = mul(x); deflate(y);
      nx = Math.hypot(...y); if (nx < 1e-12) break;
      y = y.map((v) => v / nx);
      const My = mul(y); let num = 0; for (let i = 0; i < n; i++) num += y[i] * My[i];
      lamM = num; x = y;
    }
    return Math.max(0, Math.min(2, c - lamM));
  }
  const lambda2 = fiedler();
  const maxDeg = Math.max(0, ...A.map((row) => row.filter((w) => w > 0).length));
  const starRatio = n > 1 ? maxDeg / (n - 1) : 0;
  return {
    nodes: n, edges: E.length, components: nc,
    largest_component_frac: n > 0 ? Math.round((largest / n) * 1000) / 1000 : 0,
    fiedler_lambda2: Math.round(lambda2 * 1e4) / 1e4,
    star_ratio: Math.round(starRatio * 1e4) / 1e4,
    cheeger_upper: Math.round(Math.sqrt(2 * lambda2) * 1e4) / 1e4,
    headroom: Math.round(lambda2 * (1 - starRatio) * 1e4) / 1e4,
  };
}

const full = analyze(rows);
const genuine = analyze(rows.filter((r: any) => !touchesHook(r.parent_activity_id) && !touchesHook(r.child_activity_id)));
const out = {
  at: new Date().toISOString(),
  // FULL graph at top level for backward-compat (hook-dominated, perverse — see note above).
  ...full,
  // GENUINE capability subgraph (hooks excluded) — the HONEST connectivity signal. Headroom
  // here is what the governor should gate on; it is 0 while the capability graph is
  // fragmented (components>1), so BRIDGING components is the highest-value λ₂ move.
  genuine,
};
console.log(JSON.stringify(out, null, 2));

// Append to the metrics workspace for trend tracking.
try {
  const f = "/workspace/metrics/spectral-gap.jsonl";
  await Bun.write(Bun.file(f), (await Bun.file(f).exists() ? await Bun.file(f).text() : "") + JSON.stringify(out) + "\n");
} catch { /* tolerant */ }
