#!/usr/bin/env bun
/**
 * autonomy-metrics.ts — READ-ONLY autonomy metrics collector.
 *
 * Snapshots the KPIs that say whether the substrate is reaching autonomous
 * operation, and appends one JSONL line per run to a metrics log so we get a
 * time series. STRICTLY read-only: only SELECT / GET / read-resolves — no
 * writes, no gap emission, no fixes. The point is to OBSERVE whether the
 * substrate self-corrects without operator nudging.
 *
 * Run inside substrate-live (reads creds from /etc/substrate/env):
 *   bun scripts/substrate/autonomy-metrics.ts
 * Appends to: /workspace/metrics/autonomy-metrics.jsonl
 *
 * Metric groups (each is "is it getting more autonomous on its own?"):
 *   lift            — IAL lift gate (overall_passing, template_count) from heartbeat
 *   forward_model   — recommend selector scored-fraction, embedding coverage
 *   backward_model  — composition graph edges, orphan-parent rate
 *   self_alteration — authored/staged/landed funnel (filesystem-derived)
 *   gaps            — open gaps by category (does the loop CLOSE model-reality gaps?)
 *   dec_limiters    — ρ_sample (traces/hr), κ (posterior-mean spread), λ₁ proxy (edges)
 *   push_away       — interventionRefused count (S3 readiness)
 */
const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREALDB_PASSWORD || process.env.SURREAL_PASS || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const API = process.env.METABOB_ENDPOINT || "http://127.0.0.1:8080";
const DEV = process.env.DEV_VESSEL_ENDPOINT || "http://127.0.0.1:8090";
const KEY = process.env.METABOB_API_KEY || "";
const OUT = process.env.METRICS_OUT || "/workspace/metrics/autonomy-metrics.jsonl";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

async function sql<T = any>(q: string): Promise<T[]> {
  const r = await fetch(SQL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Surreal-NS": NS, "Surreal-DB": DB, Authorization: sqlAuth, "Content-Type": "text/plain" },
    body: q,
  });
  const j = (await r.json()) as Array<{ status: string; result: T[] }>;
  const last = j[j.length - 1];
  if (!last || last.status !== "OK") throw new Error(JSON.stringify(j).slice(0, 200));
  return last.result;
}
async function tryNum(fn: () => Promise<number | null>): Promise<number | null> {
  try { const v = await fn(); return v; } catch { return null; }
}
async function apiGet(path: string): Promise<any> {
  const r = await fetch(`${API}${path}`, { headers: KEY ? { Authorization: `ApiKey ${KEY}` } : {}, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
  return r.json();
}
async function devResolve(impulse: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
    body: JSON.stringify({ impulse }), signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`resolve ${impulse.type} ${r.status}`);
  return r.json();
}
const count = async (q: string): Promise<number | null> => {
  const r = await sql<{ count: number }>(q);
  return (r && r[0] && typeof r[0].count === "number") ? r[0].count : 0;
};

// ── lift gate (from heartbeat — written by substrate-health-tick) ──
let lift: any = { overall_passing: null, template_count: null, vessels_down: null, heartbeat_age_s: null };
try {
  const hb = JSON.parse(await Bun.file("/workspace/substrate-heartbeat.json").text());
  lift = {
    overall_passing: hb.overall_passing ?? null,
    template_count: hb.template_count ?? null,
    vessels_down: Array.isArray(hb.vessels_down) ? hb.vessels_down.length : null,
  };
} catch { /* heartbeat absent */ }

// Lift-gate flap CONTEXT: the heartbeat records only overall_passing, not which
// dimension drove a flap. We record the raw trailing-1h inputs that the two
// flapping dimensions key on, READ-ONLY, so the series can SHOW the dynamics
// (2026-06-19). These are OBSERVATIONAL — not the authoritative verdict. We do
// NOT recompute confidence_passing/stability_passing here: the resolver filters
// to active (non-proposed) templates and uses its own windows, so a naive
// recompute drifts pessimistic (it once read fail while the gate read pass).
// overall_passing from the heartbeat stays the single source of truth.
//   confidence dynamics: of templates run this hour, how many have ≥8 execs
//                        (evidence concentration; thin spread keeps the gate low)
//   stability dynamics:  new templates + edges created this hour (authoring burst)
try {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const runRows = await sql<{ c: number }>(
    `SELECT activity_id, count() AS c FROM activity_execution_traces WHERE created_at >= type::datetime("${since}") GROUP BY activity_id;`);
  const distinctRun = runRows.length;
  const aboveFloor = runRows.filter((r) => (r.c ?? 0) >= 8).length;
  const newTemplates = await tryNum(() => count(
    `SELECT count() FROM activity WHERE created_at >= type::datetime("${since}") GROUP ALL;`));
  const newEdges = await tryNum(() => count(
    `SELECT count() FROM activity_composition_graph WHERE created_at >= type::datetime("${since}") GROUP ALL;`));
  lift.flap_context = {
    distinct_run_1h: distinctRun,                 // breadth of exploration this hour
    above_floor_1h: aboveFloor,                   // of those, how many have ≥8 execs
    concentration_ratio: distinctRun ? Math.round((aboveFloor / distinctRun) * 1000) / 1000 : null,
    new_templates_1h: newTemplates,               // authoring burst (stability input)
    new_edges_1h: newEdges,
  };
} catch { /* flap-context probe failed — leave undefined */ }

// ── forward model ──
const totalActivities = await tryNum(() => count("SELECT count() FROM activity GROUP ALL;"));
const embedded = await tryNum(() => count("SELECT count() FROM activity WHERE name_embedding != NONE GROUP ALL;"));
let selector_scored_fraction: number | null = null;
// The recommend selector probe flaps under trace load (transient timeouts), and
// a single null reads as a "blind instrument" downstream. Retry once before
// giving up so a transient miss does not masquerade as a dark probe (2026-06-19).
for (let attempt = 0; attempt < 2 && selector_scored_fraction == null; attempt++) {
  try {
    const rec = await (await fetch(`${API}/v2/activities/recommend`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
      body: JSON.stringify({ task_description: "audit activity templates and report quality", limit: 20 }), signal: AbortSignal.timeout(20_000),
    })).json();
    const recs = rec.recommendations ?? [];
    const scored = recs.filter((x: any) => typeof (x.selection_metadata?.score) === "number").length;
    selector_scored_fraction = recs.length ? Math.round((scored / recs.length) * 1000) / 1000 : null;
  } catch { /* recommend unreachable — retry once, then record null */ }
}
const forward_model = {
  total_activities: totalActivities,
  embedding_coverage: totalActivities && embedded != null ? Math.round((embedded / totalActivities) * 1000) / 1000 : null,
  selector_scored_fraction,
};

// ── backward model (composition graph) ──
const comp_edges = await tryNum(() => count("SELECT count() FROM activity_composition_graph GROUP ALL;"));
let orphan_parent_rate: number | null = null;
try {
  // sample 500 children, resolve parent activity_id presence
  const kids = await sql<{ parent_execution_id: string }>("SELECT parent_execution_id FROM activity_execution_traces WHERE parent_execution_id != NONE LIMIT 500;");
  if (kids.length) {
    let resolved = 0;
    for (const k of kids) {
      const p = await sql<{ c: number }>(`SELECT count() AS c FROM activity_execution_traces WHERE execution_id = ${JSON.stringify(k.parent_execution_id)} GROUP ALL;`);
      if (p[0]?.c) resolved++;
    }
    orphan_parent_rate = Math.round((1 - resolved / kids.length) * 1000) / 1000;
  }
} catch { /* leave null */ }
// LEADING INDICATOR for the trace-sink retry fix (ias-executor-ts 09c32a0):
// orphan rate restricted to recently-created children. The broad rate above is
// dominated by legacy orphans and moves slowly; this window shows whether NEW
// compositions are persisting their parents (should fall toward 0 post-fix).
// recent_composition_count also surfaces whether composition traffic is even
// flowing — if 0, the metric is n/a (the loop is on single-resolver ticks).
let recent_orphan_rate: number | null = null;
let recent_composition_count: number | null = null;
try {
  const rk = await sql<{ parent_execution_id: string }>(
    "SELECT parent_execution_id FROM activity_execution_traces WHERE parent_execution_id != NONE AND created_at > type::datetime(time::now() - 60m) LIMIT 400;",
  );
  recent_composition_count = rk.length;
  if (rk.length) {
    let resolved = 0;
    for (const k of rk) {
      const p = await sql<{ c: number }>(`SELECT count() AS c FROM activity_execution_traces WHERE execution_id = ${JSON.stringify(k.parent_execution_id)} GROUP ALL;`);
      if (p[0]?.c) resolved++;
    }
    recent_orphan_rate = Math.round((1 - resolved / rk.length) * 1000) / 1000;
  }
} catch { /* leave null */ }
const backward_model = { composition_edges: comp_edges, orphan_parent_rate, recent_orphan_rate, recent_composition_count };

// ── self-alteration funnel (filesystem) ──
let self_alteration: any = { landed: null, open_proposals: null };
try {
  const { readdirSync } = await import("node:fs");
  // Applied (landed) proposals are per-file reports under proposals/.applied/.
  self_alteration.landed = readdirSync("/workspace/proposals/.applied").filter((f) => f.endsWith(".json")).length;
} catch { /* */ }
try {
  const { readdirSync } = await import("node:fs");
  self_alteration.open_proposals = readdirSync("/workspace/proposals").filter((f) => f.endsWith(".json")).length;
} catch { /* */ }
// HONEST landing signal (2026-06-18): the `.applied/` count above conflates
// apply-ATTEMPTS (written on every outcome, success or failure) with real landings
// and freezes when apply finds "no eligible proposals". The ground truth for a
// self-development LANDING is a substrate-authored mitosis-cutover commit pushed to
// dev. Count those across the self-editable vessel repos (git, host-side) — total +
// 24h rate so "is the rate increasing?" is answerable. mitosis-applied.jsonl
// undercounts (host-sync cutovers bypass that resolver's appendFile).
try {
  const repoRoot = `${import.meta.dir}/../../repos`;
  const VESSELS = [
    "development-vessel", "goal-host-vessel", "llm-resolver-vessel", "ribosome-vessel",
    "local-tools-vessel", "light-dispatch-vessel", "discovery-vessel", "boredom-vessel",
    "ias-executor-ts", "concept-db", "metabob-activity-api", "analysis-vessel",
    "stateful-ui-vessel", "obsidian-vessel", "identity-vessel",
  ];
  const gitCount = async (repo: string, sinceArgs: string[]): Promise<number> => {
    try {
      const p = Bun.spawn(["git", "-C", `${repoRoot}/${repo}`, "log", "--all", "--grep=substrate-authored: apply", "--oneline", ...sinceArgs], { stdout: "pipe", stderr: "pipe" });
      const out = (await new Response(p.stdout).text()).trim();
      await p.exited;
      return out ? out.split("\n").length : 0;
    } catch { return 0; }
  };
  let total = 0, last24h = 0;
  for (const v of VESSELS) {
    total += await gitCount(v, []);
    last24h += await gitCount(v, ["--since=24.hours.ago"]);
  }
  self_alteration.landed_cutovers_total = total;
  self_alteration.landed_cutovers_24h = last24h;
} catch { /* git unavailable */ }

// ── gaps by category (does the loop close model-reality gaps autonomously?) ──
let gaps: any = { total: null, by_category: {}, model_reality_open: null };
try {
  const g = await devResolve({ type: "substrateGap", limit: 200 });
  const list = g?.body?.gaps ?? [];
  const by: Record<string, number> = {};
  for (const x of list) by[x.category ?? "unknown"] = (by[x.category ?? "unknown"] ?? 0) + 1;
  const mrCats = ["forward_model_artifact", "reference_integrity", "detector_value_sanity_violation", "auto_draft_fallback_recommend", "posterior_consistency_drift", "composition_coverage"];
  gaps = {
    total: g?.body?.total ?? list.length,
    by_category: by,
    model_reality_open: mrCats.reduce((s, c) => s + (by[c] ?? 0), 0),
  };
} catch { /* */ }

// ── DEC rate-limiters ──
const traces_per_hour = await tryNum(() => count("SELECT count() FROM activity_execution_traces WHERE created_at > (time::now() - 1h) GROUP ALL;"));
let kappa_posterior_spread: any = { min: null, max: null, mean: null, n: null };
try {
  const tpl = await apiGet("/v2/activities/templates?limit=100&offset=0");
  const means = (tpl.templates ?? [])
    .map((t: any) => { const a = t.metrics?.thompson_alpha ?? t.thompson_alpha; const b = t.metrics?.thompson_beta ?? t.thompson_beta; return (typeof a === "number" && typeof b === "number" && a + b > 0) ? a / (a + b) : null; })
    .filter((x: number | null): x is number => x != null);
  if (means.length) kappa_posterior_spread = {
    min: Math.round(Math.min(...means) * 1000) / 1000, max: Math.round(Math.max(...means) * 1000) / 1000,
    mean: Math.round((means.reduce((s, x) => s + x, 0) / means.length) * 1000) / 1000, n: means.length,
  };
} catch { /* */ }
const dec_limiters = {
  rho_sample_traces_per_hour: traces_per_hour,
  kappa_posterior_spread,              // flat (min≈max) = degenerate metric = reward saturation
  lambda1_composition_edges: comp_edges, // 0 edges = no graph to propagate credit over
};

// ── push-away (S3) ──
// Count refusals from the dev-vessel interventionRefused store (where
// intervention_evaluate actually persists them), symmetric with how `gaps`
// reads substrateGap above. The previous query counted activity-api's `impulse`
// table, where interventionRefused rows are never written — so push_away read 0
// even when the substrate had refused operator interventions with evidence.
const intervention_refused = await (async () => {
  try {
    const r = await devResolve({ type: "interventionRefused", limit: 500 });
    const list = r?.body?.refusals ?? [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return null;
  }
})();

// ── LEARNING-SPEED KPI: posterior convergence ──
// Fraction of variant cells whose Beta posterior has accumulated enough evidence
// to be informative. n = α+β (prior is Beta(1,1) → n=2). converged ≥22 (~20 samples),
// learning 7-21, cold ≤6. Rising converged-fraction over windows = learning speeding up.
// (DEC §9.4 per-cell observable: Var[Beta] shrinks as α+β grows.)
let posterior_convergence: any = { converged: null, learning: null, cold: null, converged_frac: null };
try {
  const rows = await sql<{ bucket: string; n: number }>(
    `SELECT (IF (thompson_alpha + thompson_beta) >= 22 THEN "converged" ELSE (IF (thompson_alpha + thompson_beta) >= 7 THEN "learning" ELSE "cold" END) END) AS bucket, count() AS n FROM variant_performance_metrics WHERE thompson_alpha != NONE GROUP BY bucket;`,
  );
  const by: Record<string, number> = {};
  for (const r of rows) by[r.bucket] = r.n;
  const conv = by.converged ?? 0, learn = by.learning ?? 0, cold = by.cold ?? 0;
  const tot = conv + learn + cold;
  // managed_converged_frac is the HONEST learning-speed signal: fraction converged
  // among Thompson-MANAGED variants (α+β≥7, i.e. those actually accumulating
  // posterior). The cold bucket is dominated by all-deterministic templates whose
  // variant_performance_metrics UPDATE is SKIPPED BY DESIGN (M4 tier-restricted
  // bandit, posterior-update.ts:554-589) — counting them as "not converged" understates
  // learning. converged_frac (over ALL variants) is kept for continuity but is
  // deflated by deterministic variants that never converge by design.
  const managed = conv + learn;
  posterior_convergence = {
    converged: conv, learning: learn, cold,
    converged_frac: tot ? Math.round((conv / tot) * 1000) / 1000 : null,
    managed_converged_frac: managed ? Math.round((conv / managed) * 1000) / 1000 : null,
  };
} catch { /* leave null */ }

// ── TOPOLOGY-BUILDOUT KPI: composition depth + edge visibility ──
// nested = traces carrying a composition_chain; depth distribution shows whether
// the substrate composes DEEPER over time. edge_visibility = recorded distinct
// edges / nested executions — how much of the topology it actually RUNS is
// captured in the learnable graph (currently ~0 due to the parent-trace write gap).
let topology: any = { nested: null, depth1: null, depth2: null, depth3plus: null, edge_visibility: null };
try {
  const d = await sql<{ depth: number; n: number }>(
    `SELECT array::len(composition_chain) AS depth, count() AS n FROM activity_execution_traces WHERE composition_chain != NONE GROUP BY depth;`,
  );
  let d1 = 0, d2 = 0, d3 = 0, nested = 0;
  for (const r of d) { nested += r.n; if (r.depth <= 1) d1 += r.n; else if (r.depth === 2) d2 += r.n; else d3 += r.n; }
  topology = { nested, depth1: d1, depth2: d2, depth3plus: d3,
    edge_visibility: (nested && comp_edges != null) ? Math.round((comp_edges / nested) * 100000) / 100000 : null };
} catch { /* leave null */ }

// ── #6 UNCERTAINTY REDUCTION: mean Beta posterior variance over managed cells ──
// Var[Beta(α,β)] = αβ / ((α+β)²(α+β+1)) is the per-cell uncertainty; its mean over
// Thompson-managed variants is the substrate's aggregate epistemic uncertainty. It
// should DECREASE as evidence accumulates (DEC §9.4) — the direct "we decrease
// uncertainty" signal. Independent verification of state changes is the
// model-reality-audit (it checks the forward/backward model against trace reality
// and emits gaps); model_reality_open in `gaps` is its closing-rate signal.
let posterior_uncertainty: any = { mean_variance: null, managed_cells: null };
try {
  const r = await sql<{ mv: number; n: number }>(
    `SELECT math::mean((thompson_alpha * thompson_beta) / ((thompson_alpha+thompson_beta) * (thompson_alpha+thompson_beta) * (thompson_alpha+thompson_beta+1))) AS mv, count() AS n FROM variant_performance_metrics WHERE (thompson_alpha+thompson_beta) >= 7 GROUP ALL;`,
  );
  if (r[0]) posterior_uncertainty = { mean_variance: r[0].mv != null ? Math.round(r[0].mv * 1e6) / 1e6 : null, managed_cells: r[0].n ?? null };
} catch { /* leave null */ }

// ── #5 VESSEL-POPULATION LEARNING: attribution coverage + active-vessel count ──
// The substrate learns per-vessel/per-resolver-tier performance only if traces carry
// vessel_id + resolver_tier. attribution_coverage = fraction of recent traces with both
// → if low, per-vessel learning is starved (a real gap, distinct from the loop running).
// active_vessels = distinct vessels resolving recently (vessel-population breadth).
let vessel_population: any = { active_vessels: null, attribution_coverage: null, recent_traces: null };
try {
  // vessel_id is trace-level (fixed in ias-executor-ts 4aa6ec4: the sink now stamps it
  // from VESSEL_ID). resolver_tier is per-TASK (tasks[].resolver_tier), not trace-level,
  // so attribution_coverage measures vessel_id presence — the per-vessel learning signal.
  const tot = await tryNum(() => count("SELECT count() AS count FROM activity_execution_traces WHERE created_at > type::datetime(time::now() - 2h) GROUP ALL;"));
  const attributed = await tryNum(() => count("SELECT count() AS count FROM activity_execution_traces WHERE created_at > type::datetime(time::now() - 2h) AND vessel_id != NONE GROUP ALL;"));
  const vrows = await sql<{ vessel_id: string }>("SELECT vessel_id FROM activity_execution_traces WHERE created_at > type::datetime(time::now() - 2h) AND vessel_id != NONE GROUP BY vessel_id;");
  vessel_population = {
    active_vessels: vrows.length,
    attribution_coverage: (tot && attributed != null) ? Math.round((attributed / tot) * 1000) / 1000 : null,
    recent_traces: tot,
  };
} catch { /* leave null */ }

// ── CAPABILITY EXPLORATION + CROSS-VESSEL SPANNING ──
// "Is the system exploring/developing uses of its capabilities, and do activities
// span vessels?" exploration_breadth = distinct activities exercised (24h) ÷ total
// (are we using the catalogue or stuck on a few?). cross_vessel_frac = composition
// edges whose parent and child activities belong to DIFFERENT vessels ÷ total edges
// (real cross-vessel capability composition vs single-vessel chains + lifecycle hooks).
const vesselOf = (id: string): string => {
  let a = String(id ?? "");
  const m = a.match(/^activity:⟨?(.+?)⟩?$/);
  if (m) a = m[1];
  return a.includes(":") ? a.split(":")[0] : "core"; // bare = shared/lifecycle (validator-dispatch, slot-binding, goal_execution)
};
let capability: any = { distinct_exercised_24h: null, total_activities: totalActivities, exploration_breadth: null, cross_vessel_edges: null, total_edges: comp_edges, cross_vessel_frac: null, proposed_templates: null };
try {
  const distinct = await tryNum(() => count("SELECT count() AS count FROM (SELECT activity_id FROM activity_execution_traces WHERE created_at > type::datetime(time::now() - 24h) GROUP BY activity_id) GROUP ALL;"));
  const proposed = await tryNum(() => count("SELECT count() AS count FROM activity WHERE proposed = true GROUP ALL;"));
  const edges = await sql<{ parent_activity_id: string; child_activity_id: string }>("SELECT parent_activity_id, child_activity_id FROM activity_composition_graph LIMIT 500;");
  const xv = edges.filter((e) => vesselOf(e.parent_activity_id) !== vesselOf(e.child_activity_id)).length;
  // GENUINE edges = the HONEST λ₁ (credit-mixing in capability space). The lifecycle
  // hooks validator-dispatch / slot-binding nest under EVERY activity, so total_edges is
  // dominated by activity→hook parentage carrying no capability→capability credit. A
  // genuine edge touches NEITHER hook on either endpoint — one capability's output fed
  // another's. genuine_edges ≈ 0 (near-pure star) ⇒ λ₁ ≈ 0 regardless of total_edges, so
  // this is the number that gates raising ρ_grow (λ₁ ≳ ρ_grow). See SUBSTRATE_AS_DYNAMICS §3-4.
  const _hub = ["validator-dispatch", "slot-binding"];
  const _touchesHub = (s: string) => _hub.some((h) => (s || "").includes(h));
  const genuine_edges = edges.filter((e) => !_touchesHub(e.parent_activity_id) && !_touchesHub(e.child_activity_id)).length;
  // SHAPE CLOSURE: fraction of PRODUCED output shapes that some activity CONSUMES as
  // input. Closed shapes form producer→consumer edges the substrate can traverse to
  // discover topology; orphaned shapes (produced, no consumer) are divergence points
  // (DEC §1.4) — activities WITHOUT closure. Rising closure = the substrate authoring
  // activities that feed the discovery loop, not dead-ends. Low closure explains a
  // sparse composition graph (few shape-flow edges).
  let shape_closure: number | null = null, orphaned_shapes: number | null = null, produced_shapes: number | null = null;
  let orphan_terminal: number | null = null, orphan_auto_artifact: number | null = null, orphan_genuine: number | null = null, effective_closure: number | null = null, real_closure: number | null = null;
  try {
    const shp = await sql<{ output_shapes: string[]; input_shapes: string[] }>("SELECT output_shapes, input_shapes FROM activity WHERE output_shapes != NONE OR input_shapes != NONE LIMIT 3000;");
    const produced = new Set<string>(), consumed = new Set<string>();
    for (const r of shp) {
      for (const s of (r.output_shapes ?? [])) produced.add(s);
      for (const s of (r.input_shapes ?? [])) consumed.add(s);
    }
    const closed = [...produced].filter((s) => consumed.has(s)).length;
    produced_shapes = produced.size;
    orphaned_shapes = produced.size - closed;
    shape_closure = produced.size ? Math.round((closed / produced.size) * 1000) / 1000 : null;
    // Honest breakdown of the orphans: terminal-by-design (reports/audits consumed by
    // OBSERVERS, not input_shapes) + LLM auto-artifacts (autoDraftedOutput_* wrapper keys,
    // structurally uncomposable) are NOT genuine closure failures. The remaining
    // "genuine composition orphans" are the real lever. genuine_closure treats terminal
    // shapes as consumed-by-observation.
    const orphans = [...produced].filter((s) => !consumed.has(s));
    const termRe = /report|audit|health|sentinel|metric|finding|verdict|result|summary|log|observ|status|gap|score|stats|snapshot|diagnos|recorded|State$/i;
    orphan_terminal = orphans.filter((s) => termRe.test(s)).length;
    orphan_auto_artifact = orphans.filter((s) => s.startsWith("autoDraftedOutput")).length;
    orphan_genuine = orphans.length - orphan_terminal - orphan_auto_artifact;
    // effective closure = composed (input_shapes) + terminal (observer-consumed) ÷ produced
    effective_closure = produced.size ? Math.round(((closed + orphan_terminal) / produced.size) * 1000) / 1000 : null;
    // real closure = effective over the REAL shape space, excluding autoDraftedOutput_*
    // LLM wrapper-key artifacts (454 legacy gap-closing:auto-* activities from early
    // drafter runs, before shape conventions). They are dead cruft, not capabilities,
    // and structurally uncomposable — counting them in the denominator deflates the
    // signal. real_closure reflects the closure of the substrate's actual capabilities.
    const realProduced = produced.size - (orphan_auto_artifact ?? 0);
    real_closure = realProduced > 0 ? Math.round(((closed + orphan_terminal) / realProduced) * 1000) / 1000 : null;
  } catch { /* leave null */ }
  capability = {
    distinct_exercised_24h: distinct,
    total_activities: totalActivities,
    exploration_breadth: (distinct != null && totalActivities) ? Math.round((distinct / totalActivities) * 1000) / 1000 : null,
    cross_vessel_edges: xv,
    total_edges: edges.length,
    genuine_edges,  // honest λ₁ — non-lifecycle-hub capability→capability edges (gates ρ_grow)
    cross_vessel_frac: edges.length ? Math.round((xv / edges.length) * 1000) / 1000 : null,
    proposed_templates: proposed,
    shape_closure, orphaned_shapes, produced_shapes,
    effective_closure, real_closure, orphan_terminal, orphan_auto_artifact, orphan_genuine,
  };
} catch { /* leave null */ }

// ── #10/#11/#12: self-maintenance, substrate self-manipulation, info growth ──
// #11 substrate_manipulation_activities: activities that act ON the substrate itself
//   (scaffold/restart/mitosis vessels, units) — the substrate's ability to manipulate
//   its own running form via activities. #12 concepts: the substrate's accumulated
//   information (concept-db) — track its growth. Resource-efficiency (resolver-tier mix,
//   cost) is BLOCKED by the same trace-attribution gap as #5 (detector-tick traces carry
//   no tasks[].resolver_tier / cost_usd) — flagged, not silently null.
let substrate_self: any = { manipulation_activities: null, concepts: null, scripts_sync_mechanism: true, llm_task_fraction: null, sampled_tasks: null };
try {
  substrate_self.manipulation_activities = await tryNum(() => count("SELECT count() AS count FROM activity WHERE string::contains(type::string(id),'vessel') OR string::contains(type::string(id),'mitosis') OR string::contains(type::string(id),'scaffold') OR string::contains(type::string(id),'substrate') GROUP ALL;"));
  substrate_self.concepts = await tryNum(() => count("SELECT count() AS count FROM concept GROUP ALL;"));
  // #12 RESOURCE EFFICIENCY: per-task data lives in execution_trace_content (NOT
  // activity_execution_traces). resolver_tier is null there (engine only stamps tier
  // for local-registry resolvers), but resolver_id IS recorded — classify it read-side.
  // llm_task_fraction LOW = efficient (substrate reserves costly LLM for few tasks,
  // uses deterministic/pattern resolvers for the rest).
  const tc = await sql<{ tasks: Array<{ resolver_id?: string }> }>("SELECT tasks FROM execution_trace_content WHERE array::len(tasks ?? []) > 0 LIMIT 500;");
  let llm = 0, ntasks = 0;
  for (const r of tc) for (const t of (r.tasks ?? [])) { ntasks++; if (/llm/i.test(t.resolver_id ?? "")) llm++; }
  substrate_self.sampled_tasks = ntasks;
  substrate_self.llm_task_fraction = ntasks ? Math.round((llm / ntasks) * 1000) / 1000 : null;
} catch { /* */ }

const record = {
  at: new Date().toISOString(),
  lift, forward_model, backward_model, self_alteration, gaps, dec_limiters,
  push_away: { intervention_refused },
  posterior_convergence, topology, posterior_uncertainty, vessel_population, capability, substrate_self,
};

try { const { mkdirSync } = await import("node:fs"); mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true }); } catch { /* */ }
await Bun.write(Bun.file(OUT), (await Bun.file(OUT).exists() ? await Bun.file(OUT).text() : "") + JSON.stringify(record) + "\n");
console.log(JSON.stringify(record, null, 2));
