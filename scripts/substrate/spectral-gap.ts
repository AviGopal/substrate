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
// NB: /etc/substrate/env is written by gen-env.sh with the value QUOTED
// (SURREAL_PASS="..."). systemd's EnvironmentFile strips the quotes, but a raw file
// read does not — a bare `(\S+)` capture grabs the literal quotes and the password
// fails to verify (401, non-JSON body → .json() throws, blinding this metric). Strip
// surrounding quotes so the direct-SQL instrumentation survives the convention. (2026-06-26)
const PASS = (await Bun.file("/etc/substrate/env").text()).match(/SURREAL_PASS="?([^"\s]+)"?/)?.[1] ?? "";
const q = async (sql: string): Promise<any[]> =>
  (await (await fetch("http://127.0.0.1:8000/sql", {
    method: "POST",
    headers: { "Content-Type": "text/plain", Accept: "application/json", "surreal-ns": "activity-system", "surreal-db": "learning_loop", Authorization: "Basic " + btoa("root:" + PASS) },
    body: sql,
  })).json());

const rows = (await q("SELECT parent_activity_id, child_activity_id, execution_count, edge_kind, genuine FROM activity_composition_graph;"))[0]?.result ?? [];

// ρ_grow — the MISSING half of the master stability inequality λ₁(L(t)) ≳ ρ_grow
// (SUBSTRATE_AS_DYNAMICS.md §3). λ₁ above is the credit-MIXING rate; ρ_grow is the rate
// at which fresh UNINFORMED Beta(1,1) cells are minted. When growth outruns mixing the
// trajectory falls off the slow manifold into livelock. We only ever measured the LHS,
// so the inequality could be observed but never gated. This computes the RHS. (2026-06-26)
//
// SOURCE: variant_performance_metrics — the canonical per-variant Thompson Beta-cell
// store. Every newly-minted activity creates a vpm cell, initially at the uninformed
// prior (thompson_alpha≈1, thompson_beta≈1). It carries `created_at`, so mint TIME is
// directly queryable (activity_template is empty; the `activity` table also has created_at
// but its scan is ~10x slower — vpm is the faster, equally-authoritative source).
//
// NORMALIZATION (so it is comparable to λ₁): λ₁∈[0,2] is a dimensionless per-step
// FRACTIONAL credit-mixing rate. We make ρ_grow the dimensionless per-HOUR FRACTIONAL
// growth rate of the cell complex: (new uninformed cells in the window) / (total live
// cells) / (window hours). Both are then "fraction of the structure touched per unit
// step", letting `lambda1 - rho_grow` (headroom) and `lambda1 / rho_grow` (ratio) be read
// against the ≳ inequality. The raw mints/hour is also emitted for legibility.
//
// HONESTY (memory lessons): count() returns null on failure / empty window, NOT a false 0;
// an empty `result` array means the windowed count was absent → treat as 0 mints only when
// the population query itself succeeded, else null. created_at is what vpm records for mint
// time (there is no indexed executed_at on this cell table — this is mint time, not trace
// time, so the executed_at rule does not apply here).
const RHO_WINDOW_HOURS = 6;
async function countOrNull(sql: string): Promise<number | null> {
  try {
    const res = (await q(sql))[0];
    if (!res || res.status !== "OK") return null;
    const r = res.result;
    if (!Array.isArray(r)) return null;
    if (r.length === 0) return 0; // valid empty window ⇒ zero rows, not failure
    const c = r[0]?.count;
    return typeof c === "number" ? c : null;
  } catch {
    return null;
  }
}
const vpmTotal = await countOrNull("SELECT count() FROM variant_performance_metrics GROUP ALL;");
const vpmRecent = await countOrNull(
  `SELECT count() FROM variant_performance_metrics WHERE created_at > time::now() - ${RHO_WINDOW_HOURS}h GROUP ALL;`,
);
const vpmUninformed = await countOrNull(
  "SELECT count() FROM variant_performance_metrics WHERE thompson_alpha <= 1.05 AND thompson_beta <= 1.05 GROUP ALL;",
);
// raw mint rate (cells/hour) and dimensionless fractional rate (cells/hour ÷ population).
const rhoMintsPerHour =
  vpmRecent === null ? null : Math.round((vpmRecent / RHO_WINDOW_HOURS) * 1e4) / 1e4;
const rhoGrow =
  vpmRecent === null || vpmTotal === null || vpmTotal === 0
    ? null
    : Math.round((vpmRecent / RHO_WINDOW_HOURS / vpmTotal) * 1e6) / 1e6;

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

// C7: PREFER the durable edge_kind/genuine column written by the composition-edge
// writers (activity-api classifyCompositionEdge + composition-edge-reconcile). A row
// is in the GENUINE capability subgraph iff it is tagged genuine; iff it is tagged
// hub/scaffold it is excluded. ONLY legacy/untagged rows (edge_kind/genuine NONE)
// fall back to the touchesHook node-name heuristic — keeping this backward-compatible
// while the topology re-tags on the next reconcile/write. (2026-06-26)
const isGenuineEdge = (r: any): boolean => {
  if (r && typeof r.genuine === "boolean") return r.genuine;
  if (r && typeof r.edge_kind === "string" && r.edge_kind.length > 0) return r.edge_kind === "genuine";
  // legacy untagged → heuristic: genuine iff neither endpoint is a lifecycle hook.
  return !touchesHook(r.parent_activity_id) && !touchesHook(r.child_activity_id);
};

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
  // GIANT-COMPONENT FIX (2026-07-02): λ₂ of a disconnected graph is 0 by definition,
  // so a single 2-node islet (observed: a repaired-of-repaired artifact pair) zeroed
  // the governor's headroom while 99.5% of the mass was one well-connected component.
  // Compute λ₂ on the GIANT component — the honest mixing rate of where the credit
  // actually lives — and keep `components` / `largest_component_frac` / `islet_nodes`
  // as the (separate, still-visible) disconnection signal.
  const gcId = Number(Object.entries(compSizes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1);
  const gc: number[] = [];
  for (let i = 0; i < n; i++) if (comp[i] === gcId) gc.push(i);
  function fiedler(sub: number[]): number {
    const m = sub.length;
    if (m < 2) return 0;
    const pos = new Map<number, number>(); sub.forEach((g, i) => pos.set(g, i));
    const subDeg = sub.map((g) => sub.reduce((a, h) => a + (A[g][h] || 0), 0));
    const dsqrt = subDeg.map((d) => (d > 0 ? Math.sqrt(d) : 0));
    const w0 = dsqrt.slice();
    const w0n = Math.hypot(...w0); for (let i = 0; i < m; i++) w0[i] /= (w0n || 1);
    const c = 2;
    const mul = (x: number[]): number[] => {
      const y = new Array(m).fill(0);
      for (let ui = 0; ui < m; ui++) {
        let acc = 0; const du = dsqrt[ui] || 1;
        const u = sub[ui];
        for (let vi = 0; vi < m; vi++) { const v = sub[vi]; if (A[u][v]) acc += (A[u][v] / (du * (dsqrt[vi] || 1))) * x[vi]; }
        y[ui] = (c - 1) * x[ui] + acc;
      }
      return y;
    };
    let x = Array.from({ length: m }, (_, i) => Math.sin(i + 1) + 0.3 * Math.cos(2 * i + 1));
    const deflate = (v: number[]): void => { let dot = 0; for (let i = 0; i < m; i++) dot += v[i] * w0[i]; for (let i = 0; i < m; i++) v[i] -= dot * w0[i]; };
    deflate(x); let nx = Math.hypot(...x) || 1; x = x.map((v) => v / nx);
    let lamM = 0;
    for (let it = 0; it < 400; it++) {
      let y = mul(x); deflate(y);
      nx = Math.hypot(...y); if (nx < 1e-12) break;
      y = y.map((v) => v / nx);
      const My = mul(y); let num = 0; for (let i = 0; i < m; i++) num += y[i] * My[i];
      lamM = num; x = y;
    }
    return Math.max(0, Math.min(2, c - lamM));
  }
  const lambda2 = fiedler(gc);
  const maxDeg = Math.max(0, ...A.map((row) => row.filter((w) => w > 0).length));
  const starRatio = n > 1 ? maxDeg / (n - 1) : 0;
  // MULTI-SCALE / SMALL-WORLD metrics (2026-06-19): "credit traversal on DIFFERENT
  // HORIZONS" = high LOCAL clustering (short-horizon, within-domain credit) + short
  // GLOBAL paths (long-horizon, cross-domain). A naturally-modular capability graph is
  // best measured as a SMALL-WORLD (connected + clustered + bridged), NOT by a single
  // global λ₂ a modular graph never maximizes. σ>1 ⇒ small-world.
  const nbr: Array<Set<number>> = Array.from({ length: n }, () => new Set<number>());
  for (const [u, v] of E) { nbr[u].add(v); nbr[v].add(u); }
  const avgDeg = n > 0 ? (2 * E.length) / n : 0;
  let cSum = 0, cCount = 0;
  for (let u = 0; u < n; u++) {
    const ns = [...nbr[u]]; const k = ns.length;
    if (k < 2) continue;
    let links = 0;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (nbr[ns[i]].has(ns[j])) links++;
    cSum += links / ((k * (k - 1)) / 2); cCount++;
  }
  const clustering = cCount ? cSum / cCount : 0;
  const big: number[] = [];
  for (let i = 0; i < n; i++) if (compSizes[comp[i]] === largest) big.push(i);
  let pathSum = 0, pathPairs = 0;
  for (const s of big) {
    const dist = new Array(n).fill(-1); dist[s] = 0; const q = [s];
    for (let qi = 0; qi < q.length; qi++) { const u = q[qi]; for (const v of nbr[u]) if (dist[v] < 0) { dist[v] = dist[u] + 1; q.push(v); } }
    for (const t of big) if (t !== s && dist[t] > 0) { pathSum += dist[t]; pathPairs++; }
  }
  const avgPath = pathPairs ? pathSum / pathPairs : 0;
  const cRand = n > 0 ? avgDeg / n : 0;
  const lRand = avgDeg > 1 ? Math.log(Math.max(2, largest)) / Math.log(avgDeg) : 0;
  const sigma = cRand > 0 && avgPath > 0 && lRand > 0 ? (clustering / cRand) / (avgPath / lRand) : 0;
  return {
    nodes: n, edges: E.length, components: nc,
    largest_component_frac: n > 0 ? Math.round((largest / n) * 1000) / 1000 : 0,
    islet_nodes: n - largest, // nodes outside the giant component (λ₂ now excludes them)
    fiedler_lambda2: Math.round(lambda2 * 1e4) / 1e4,
    star_ratio: Math.round(starRatio * 1e4) / 1e4,
    cheeger_upper: Math.round(Math.sqrt(2 * lambda2) * 1e4) / 1e4,
    headroom: Math.round(lambda2 * (1 - starRatio) * 1e4) / 1e4,
    // multi-scale: avg_degree (density), clustering (short-horizon/local mixing),
    // avg_path_length (long-horizon reach), small_world_sigma (>1 = small-world).
    avg_degree: Math.round(avgDeg * 100) / 100,
    clustering: Math.round(clustering * 1e4) / 1e4,
    avg_path_length: Math.round(avgPath * 100) / 100,
    small_world_sigma: Math.round(sigma * 100) / 100,
  };
}

const full = analyze(rows);
const genuine = analyze(rows.filter((r: any) => isGenuineEdge(r)));
// The master inequality keys on the credit-MIXING rate λ₁. Use the GENUINE (hook-excluded)
// λ₂ as λ₁ — it is the honest capability-graph mixing signal (full-graph λ₂ is inflated by
// the lifecycle hub). stability_headroom = λ₁ - ρ_grow; the inequality λ₁ ≳ ρ_grow HOLDS
// when headroom ≥ 0 (mixing keeps pace with minting). ratio > 1 ⇒ holds. (2026-06-26)
const lambda1 = genuine.fiedler_lambda2;
const stabilityHeadroom = rhoGrow === null ? null : Math.round((lambda1 - rhoGrow) * 1e6) / 1e6;
const stabilityRatio = rhoGrow === null || rhoGrow === 0 ? null : Math.round((lambda1 / rhoGrow) * 1e4) / 1e4;

// LIVE genuine subgraph: restrict the genuine capability graph to activities that
// actually RAN successfully in the recent window (both endpoints carry a recent
// success trace). The all-time genuine graph is inflated by GRAVEYARD fragments —
// dead activities (no success in the window, no live consumer) that disconnect it and
// pin λ₁=0 even though the WORKING capability graph is one connected component. This
// measures the connectivity of the system that is actually operating, reported
// ALONGSIDE all-time genuine (never replacing it) so the graveyard stays visible.
// live_lambda1 is the honest credit-mixing rate of the working substrate. (2026-06-27)
const LIVE_WINDOW_HOURS = 24;
const normId = (s: string) => (s || "").replace(/^activity:/, "").replace(/[⟨⟩`]/g, "").trim();
let liveSet: Set<string> | null = null;
try {
  const liveRows = (await q(
    `SELECT VALUE activity_id FROM v_paradigm_execution_traces WHERE executed_at >= time::now() - ${LIVE_WINDOW_HOURS}h AND success = true LIMIT 60000;`,
  ))[0]?.result ?? [];
  liveSet = new Set((liveRows as string[]).map(normId));
} catch { liveSet = null; }
const bothLive = (r: any) =>
  liveSet !== null && liveSet.has(normId(r.parent_activity_id)) && liveSet.has(normId(r.child_activity_id));
const liveGenuine = liveSet === null ? null : analyze(rows.filter((r: any) => isGenuineEdge(r) && bothLive(r)));
const liveLambda1 = liveGenuine ? liveGenuine.fiedler_lambda2 : null;

const out = {
  at: new Date().toISOString(),
  // FULL graph at top level for backward-compat (hook-dominated, perverse — see note above).
  ...full,
  // GENUINE capability subgraph (hooks excluded) — the HONEST connectivity signal. Headroom
  // here is what the governor should gate on; it is 0 while the capability graph is
  // fragmented (components>1), so BRIDGING components is the highest-value λ₂ move.
  genuine,
  // LIVE genuine subgraph (both endpoints succeeded in the last 24h) — connectivity of
  // the WORKING system, excluding graveyard fragments. live_genuine.components==1 with
  // live_lambda1>0 ⇒ the operating capability graph mixes credit even while all-time
  // genuine λ₁=0 from dead fragments. null ⇒ live query unreachable. (2026-06-27)
  live_genuine: liveGenuine,
  live_lambda1: liveLambda1,
  // ρ_grow — RHS of the master inequality (SUBSTRATE_AS_DYNAMICS.md §3). See block above for
  // source/normalization. rho_grow is the dimensionless per-hour fractional mint rate (vs the
  // dimensionless per-step λ₁); rho_grow_mints_per_hour is the raw rate for legibility;
  // uninformed_cells is the standing count of Beta(1,1) cells. null ⇒ source unreachable.
  rho_grow: rhoGrow,
  rho_grow_mints_per_hour: rhoMintsPerHour,
  rho_grow_window_hours: RHO_WINDOW_HOURS,
  uninformed_cells: vpmUninformed,
  cell_population: vpmTotal,
  // The inequality made observable: λ₁ (genuine mixing) vs ρ_grow (minting).
  lambda1_for_inequality: lambda1,
  stability_headroom: stabilityHeadroom,           // λ₁ - ρ_grow ; ≥0 ⇒ inequality holds
  stability_ratio: stabilityRatio,                 // λ₁ / ρ_grow ; >1 ⇒ inequality holds
  inequality_holds: stabilityHeadroom === null ? null : stabilityHeadroom >= 0,
};
console.log(JSON.stringify(out, null, 2));

// Append to the metrics workspace for trend tracking.
try {
  const f = "/workspace/metrics/spectral-gap.jsonl";
  await Bun.write(Bun.file(f), (await Bun.file(f).exists() ? await Bun.file(f).text() : "") + JSON.stringify(out) + "\n");
} catch { /* tolerant */ }

// PUBLISH AS A SHAPE (law 1). The JSONL above is a file on ONE host: no shape, no
// federation, and — grep-verified across repos/ and scripts/ — no programmatic
// consumer anywhere. So the master inequality of SUBSTRATE_AS_DYNAMICS.md §3 was
// computed correctly every 20 minutes and could not be read by anything that acts,
// while two live governors that call themselves "λ₁ ≥ ρ_grow" compute two DIFFERENT
// quantities. Until these numbers are resolvable through discovery, no claim about
// the convergence rate λ₁·ρ_sample·κ⁻¹ is falsifiable.
//
// Fire-and-forget and non-fatal: this tracker's job is to MEASURE. If the store is
// unreachable the JSONL still holds the reading, and a failed publish must never
// cost the measurement.
try {
  const store = (process.env["ACTIVITY_API_ENDPOINT"] ?? process.env["ACTIVITY_API_URL"] ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
  const key = process.env["METABOB_API_KEY"] ?? process.env["API_KEY"] ?? "";
  const res = await fetch(`${store}/v2/activities/observable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `ApiKey ${key}` } : {}) },
    body: JSON.stringify({ kind: "stability", body: out }),
    signal: AbortSignal.timeout(15_000),
  });
  console.log(`[spectral-gap] published substrateObservable(kind=stability) -> ${res.status}`);
} catch (e) {
  console.warn(`[spectral-gap] observable publish failed (non-fatal): ${(e as Error).message}`);
}
