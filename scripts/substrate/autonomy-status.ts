#!/usr/bin/env bun
/**
 * autonomy-status.ts — READ-ONLY one-shot "is the substrate reaching autonomy?"
 * summary over the autonomy-metrics JSONL series. Where autonomy-metrics-view.ts
 * prints the full time-series table, this prints a GLANCEABLE verdict:
 *
 *   - the headline (lift gate) + collector freshness/instrument-health guard
 *   - one line per metric GROUP with current value, window delta, and a verdict
 *   - which DEC convergence limiter is currently SCARCEST
 *     (R_conv ~ λ₁ · ρ_sample · κ(⋆)⁻¹ — the slowest term sets the rate;
 *      SUBSTRATE_AS_DEC.md §4.1)
 *
 * Strictly read-only — it only reads the JSONL the collector already wrote.
 *
 *   bun scripts/substrate/autonomy-status.ts          # window = last 24 snapshots
 *   N=60 bun scripts/substrate/autonomy-status.ts      # widen the delta window
 */
const FILE = process.env.METRICS_OUT || "/workspace/metrics/autonomy-metrics.jsonl";
const N = Number(process.env.N ?? 24);
const STALE_MIN = Number(process.env.STALE_MIN ?? 45); // collector runs every 20m; >45m = timer trouble

const text = await Bun.file(FILE).exists() ? await Bun.file(FILE).text() : "";
const rows = text.split("\n").filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
if (rows.length === 0) { console.log("no autonomy metrics recorded yet — is the autonomy-metrics.timer active?"); process.exit(0); }

const win = rows.slice(-N);
const last = win[win.length - 1];
const first = win[0];

// ── freshness / instrument-health guard ───────────────────────────────────
const ageMin = (Date.now() - Date.parse(last.at)) / 60000;
const freshFlag = ageMin > STALE_MIN ? `  ⚠ STALE (${ageMin.toFixed(0)}m old; collector may be down)` : "";
// a metric reading null at the latest snapshot = that probe is dark (a blind
// instrument, not a healthy zero) — call it out so green ≠ "we can't see".
const dark: string[] = [];
if (last.gaps?.model_reality_open == null) dark.push("gaps");
if (last.dec_limiters?.rho_sample_traces_per_hour == null) dark.push("ρ_sample");
if (last.backward_model?.composition_edges == null) dark.push("λ₁/edges");
if (last.forward_model?.selector_scored_fraction == null) dark.push("selector");

// ── helpers ────────────────────────────────────────────────────────────────
const g = (r: any, path: string) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), r);
const delta = (path: string): string => {
  const a = g(first, path), b = g(last, path);
  if (typeof a !== "number" || typeof b !== "number") return "·";
  const d = +(b - a).toFixed(2);
  return d === 0 ? "±0" : (d > 0 ? `+${d}` : `${d}`);
};
const kspread = (r: any) => {
  const k = r?.dec_limiters?.kappa_posterior_spread;
  return (k && k.max != null && k.min != null) ? +(k.max - k.min).toFixed(2) : null;
};
const arrow = (path: string, good: "up" | "down"): string => {
  const a = g(first, path), b = g(last, path);
  if (typeof a !== "number" || typeof b !== "number") return " ";
  if (b === a) return "→";
  const rising = b > a;
  const isGood = good === "up" ? rising : !rising;
  return isGood ? "✓" : "✗";
};

const lift = last.lift?.overall_passing;
const liftStr = lift === true ? "PASSING" : lift === false ? "FAILING" : "unknown";

console.log(`\n  substrate autonomy  ·  ${last.at.replace("T", " ").slice(0, 16)}  ·  window ${win.length} snaps${freshFlag}`);
console.log(`  ${"─".repeat(64)}`);
console.log(`  LIFT GATE        ${liftStr}   templates ${last.lift?.template_count ?? "?"}   vessels_down ${last.lift?.vessels_down ?? "?"}`);
if (dark.length) console.log(`  ⚠ BLIND PROBES   ${dark.join(", ")} reading null — restore before trusting green`);
console.log(`  ${"─".repeat(64)}`);

// ── metric groups (the autonomy test: do these move WITHOUT operator fixes) ──
const fmt = (label: string, cur: any, d: string, mark: string, note: string) =>
  `  ${label.padEnd(16)} ${String(cur ?? "·").padStart(7)}   Δ${d.padStart(6)}  ${mark}  ${note}`;

console.log(fmt("self-alteration", last.self_alteration?.landed, delta("self_alteration.landed"),
  arrow("self_alteration.landed", "up"), "landed proposals — loop authoring+landing its own changes"));
console.log(fmt("model-reality gaps", last.gaps?.model_reality_open, delta("gaps.model_reality_open"),
  arrow("gaps.model_reality_open", "down"), "open gaps — should fall as the loop self-corrects"));
console.log(fmt("  └ fwd artifacts", g(last, "gaps.by_category.forward_model_artifact"), delta("gaps.by_category.forward_model_artifact"),
  arrow("gaps.by_category.forward_model_artifact", "down"), "forward-model phantoms — self-closing?"));
console.log(fmt("backward model", last.backward_model?.composition_edges, delta("backward_model.composition_edges"),
  arrow("backward_model.composition_edges", "up"), "composition edges — converging on trace reality"));
console.log(fmt("  └ orphan parents", last.backward_model?.orphan_parent_rate, delta("backward_model.orphan_parent_rate"),
  arrow("backward_model.orphan_parent_rate", "down"), "dangling parent links (broad) — should fall"));
console.log(fmt("  └ orphan RECENT", last.backward_model?.recent_orphan_rate, delta("backward_model.recent_orphan_rate"),
  arrow("backward_model.recent_orphan_rate", "down"), `60m window (${last.backward_model?.recent_composition_count ?? "·"} compositions) — leading indicator of trace-sink fix`));
console.log(fmt("S3 push-away", last.push_away?.intervention_refused, delta("push_away.intervention_refused"),
  arrow("push_away.intervention_refused", "up"), "interventionRefused — substrate refusing nudges w/ evidence"));
console.log(`  ${"·".repeat(64)}`);
console.log(fmt("learn-speed MGD", last.posterior_convergence?.managed_converged_frac, delta("posterior_convergence.managed_converged_frac"),
  arrow("posterior_convergence.managed_converged_frac", "up"), `converged ÷ Thompson-managed (${last.posterior_convergence?.converged ?? "·"}c/${last.posterior_convergence?.learning ?? "·"}l) — HONEST learning speed`));
console.log(fmt("  └ conv (all)", last.posterior_convergence?.converged_frac, delta("posterior_convergence.converged_frac"),
  arrow("posterior_convergence.converged_frac", "up"), `over ALL variants (${last.posterior_convergence?.cold ?? "·"} cold, mostly deterministic-by-design)`));
console.log(fmt("topology depth2", last.topology?.depth2, delta("topology.depth2"),
  arrow("topology.depth2", "up"), `depth-2 compositions (${last.topology?.depth3plus ?? "·"} deeper) — deeper = richer topology`));
console.log(fmt("topology visible", last.topology?.edge_visibility, delta("topology.edge_visibility"),
  arrow("topology.edge_visibility", "up"), "edges ÷ nested-execs — fraction of run topology that's learnable"));
console.log(fmt("#6 uncertainty", last.posterior_uncertainty?.mean_variance, delta("posterior_uncertainty.mean_variance"),
  arrow("posterior_uncertainty.mean_variance", "down"), `mean Beta variance over ${last.posterior_uncertainty?.managed_cells ?? "·"} managed cells — DOWN = uncertainty decreasing`));
console.log(fmt("#5 vessel-attrib", last.vessel_population?.attribution_coverage, delta("vessel_population.attribution_coverage"),
  arrow("vessel_population.attribution_coverage", "up"), `traces w/ vessel_id (${last.vessel_population?.active_vessels ?? "·"} active vessels) — per-vessel learning data`));
console.log(fmt("explore breadth", last.capability?.exploration_breadth, delta("capability.exploration_breadth"),
  arrow("capability.exploration_breadth", "up"), `distinct activities run 24h ÷ total (${last.capability?.distinct_exercised_24h ?? "·"}/${last.capability?.total_activities ?? "·"}, ${last.capability?.proposed_templates ?? "·"} proposed)`));
console.log(fmt("cross-vessel comp", last.capability?.cross_vessel_frac, delta("capability.cross_vessel_frac"),
  arrow("capability.cross_vessel_frac", "up"), `edges spanning vessels ÷ total (${last.capability?.cross_vessel_edges ?? "·"}/${last.capability?.total_edges ?? "·"}) — activities spanning vessels`));
console.log(fmt("shape closure", last.capability?.shape_closure, delta("capability.shape_closure"),
  arrow("capability.shape_closure", "up"), `produced shapes w/ a consumer ÷ produced (${last.capability?.orphaned_shapes ?? "·"} orphaned/divergent) — activity closure for topology discovery`));

// ── scarcest DEC limiter (R_conv ~ λ₁ · ρ_sample · κ⁻¹) ──────────────────────
console.log(`  ${"─".repeat(64)}`);
const tph = last.dec_limiters?.rho_sample_traces_per_hour;
const edges = last.backward_model?.composition_edges;
const ksp = kspread(last);
// normalize each term to a 0..1 health score (thresholds are heuristic, documented):
//   ρ_sample healthy by ~800 traces/hr · κ non-degeneracy is already 0..1 ·
//   λ₁ proxied by edge count, healthy by ~30 (a well-connected capability graph)
const terms = [
  { name: "ρ_sample (throughput)", val: tph, unit: "tr/hr", score: tph == null ? null : Math.min(1, tph / 800), lever: "horizontal dispatch / trace-store hygiene" },
  { name: "κ⁻¹ (metric spread)", val: ksp, unit: "", score: ksp, lever: "graded-yield reward (avoid posterior saturation)" },
  { name: "λ₁ (credit mixing)", val: edges, unit: "edges", score: edges == null ? null : Math.min(1, edges / 30), lever: "composition-edge population / chain-credit" },
];
const scored = terms.filter((t) => t.score != null) as Array<typeof terms[0] & { score: number }>;
console.log(`  DEC convergence limiters (R ~ λ₁·ρ_sample·κ⁻¹ — slowest term sets the rate):`);
for (const t of scored.sort((a, b) => a.score - b.score)) {
  const bar = "█".repeat(Math.round(t.score * 10)).padEnd(10, "░");
  console.log(`    ${bar} ${(t.score).toFixed(2)}  ${t.name.padEnd(22)} ${String(t.val).padStart(5)} ${t.unit}`);
}
if (scored.length) {
  const scarce = scored.sort((a, b) => a.score - b.score)[0];
  console.log(`  ⟶ scarcest: ${scarce.name}  (lever: ${scarce.lever})`);
}

// ── GROWTH RATE + ACCELERATION (is the pace increasing?) ────────────────────
// Per the standing goal "the rate the system is growing is measurable and
// increasing": compute the per-hour growth of cumulative quantities across the
// window, split first-half vs second-half. ⤴ = accelerating, ⤵ = decelerating.
console.log(`  ${"─".repeat(64)}`);
console.log(`  GROWTH RATE (first-half → second-half per hour; ⤴ accelerating):`);
const series = win.map((r) => ({
  t: Date.parse(r.at),
  edges: r.backward_model?.composition_edges,
  landed: r.self_alteration?.landed,
  proposed: r.capability?.proposed_templates,
  concepts_total: r.forward_model?.total_activities,
}));
// Least-squares slope (units/hr) over a set of {t(ms), value} points — robust to
// the single-point noise that a first/last endpoint diff suffers on BURSTY
// cumulative signals (e.g. self-alteration lands ~1/40min, so an endpoint split
// can read 0 even while the trend is clearly positive).
const slopePerHr = (pts: any[], k: string): number | null => {
  const xs = pts.map((p) => p.t / 3.6e6), ys = pts.map((p) => p[k]);
  const n = xs.length; if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : null;
};
const growth = (k: string, label: string) => {
  const pts = series.filter((s) => s[k as keyof typeof s] != null);
  if (pts.length < 4) { console.log(`    ${label.padEnd(16)} (insufficient points)`); return; }
  // Robust trend over the whole window, plus older-half vs newer-half slope for
  // acceleration (regression on each half — far less jittery than endpoint diff).
  const half = Math.floor(pts.length / 2);
  const overall = slopePerHr(pts, k);
  const s1 = slopePerHr(pts.slice(0, half + 1), k), s2 = slopePerHr(pts.slice(half), k);
  if (overall == null) { console.log(`    ${label.padEnd(16)} (gaps)`); return; }
  let mark = "→ steady";
  if (s1 != null && s2 != null) mark = s2 > s1 + 0.05 ? "⤴ accelerating" : s2 < s1 - 0.05 ? "⤵ decelerating" : "→ steady";
  console.log(`    ${label.padEnd(16)} ${overall.toFixed(2).padStart(7)}/hr trend   (${(s1 ?? 0).toFixed(2)}→${(s2 ?? 0).toFixed(2)})  ${mark}`);
};
growth("edges", "edges (λ₁)");
growth("landed", "self-alteration");
growth("proposed", "proposed tmpl");
console.log("");
