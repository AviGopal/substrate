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
const N = Number(process.env.N ?? 24);
const STALE_MIN = Number(process.env.STALE_MIN ?? 45); // collector runs every 20m; >45m = timer trouble

// Resolve the metrics series. The AUTHORITATIVE copy is the one the collector
// writes inside the substrate, at /workspace/metrics/autonomy-metrics.jsonl —
// but /workspace is a docker VOLUME (substrate-workspace), not the repo
// bind-mount, so the host cannot see it via the filesystem. Reading only the
// host-side path silently showed a stale series (last snapshot frozen while the
// collector kept writing into the volume) — an operator-blinding defect
// (re-fixed 2026-06-19: prefer the live substrate copy, fall back to host cache).
//
// Strategy: gather every reachable source (explicit override, the substrate
// volume via `docker exec`, the host bind-mount cache), then pick whichever has
// the FRESHEST last snapshot. That way the view tracks the live substrate when
// the container is up and degrades to the host cache when it is not.
const HOST_FALLBACK = `${import.meta.dir}/workspace/metrics/autonomy-metrics.jsonl`;
const CONTAINER = process.env.SUBSTRATE_CONTAINER ?? "substrate-live";
const CONTAINER_PATH = "/workspace/metrics/autonomy-metrics.jsonl";

async function readHost(path: string): Promise<string> {
  try { return (await Bun.file(path).exists()) ? await Bun.file(path).text() : ""; } catch { return ""; }
}
async function readSubstrate(): Promise<string> {
  try {
    const p = Bun.spawn(["docker", "exec", CONTAINER, "cat", CONTAINER_PATH], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(p.stdout).text();
    return (await p.exited) === 0 ? out : "";
  } catch { return ""; }
}
function lastAt(text: string): number {
  const lines = text.split("\n").filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    try { const t = Date.parse(JSON.parse(lines[i]!).at); if (!Number.isNaN(t)) return t; } catch { /* skip */ }
  }
  return -Infinity;
}

const sources: Array<{ label: string; text: string }> = [];
if (process.env.METRICS_OUT) sources.push({ label: process.env.METRICS_OUT, text: await readHost(process.env.METRICS_OUT) });
sources.push({ label: `${CONTAINER}:${CONTAINER_PATH}`, text: await readSubstrate() });
sources.push({ label: HOST_FALLBACK, text: await readHost(HOST_FALLBACK) });

let best = sources[0]!;
for (const s of sources) { if (s.text && lastAt(s.text) > lastAt(best.text)) best = s; }
const FILE = best.label;
const text = best.text;
const rows = text.split("\n").filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
if (rows.length === 0) { console.log("no autonomy metrics recorded yet — is the autonomy-metrics.timer active?"); process.exit(0); }

const win = rows.slice(-N);
const last = win[win.length - 1];
const first = win[0];

// ── freshness / instrument-health guard ───────────────────────────────────
const ageMin = (Date.now() - Date.parse(last.at)) / 60000;
const freshFlag = ageMin > STALE_MIN ? `  ⚠ STALE (${ageMin.toFixed(0)}m old; collector may be down)` : "";
// a metric reading null = that probe is dark (a blind instrument, not a healthy
// zero). But several probes FLAP — e.g. the recommend selector occasionally
// times out under trace load and records null, then scores fine again next
// tick. Flagging BLIND off a single null point cried wolf every few snapshots
// (2026-06-19). A probe is genuinely dark only if it is null PERSISTENTLY, so
// require the last 3 snapshots (or the whole window if shorter) to all be null.
const PERSIST = Math.min(3, win.length);
const recent = win.slice(-PERSIST);
const persistentlyNull = (path: string) =>
  recent.every((r) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), r) == null);
const dark: string[] = [];
if (persistentlyNull("gaps.model_reality_open")) dark.push("gaps");
if (persistentlyNull("dec_limiters.rho_sample_traces_per_hour")) dark.push("ρ_sample");
if (persistentlyNull("backward_model.composition_edges")) dark.push("λ₁/edges");
if (persistentlyNull("forward_model.selector_scored_fraction")) dark.push("selector");

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

// The lift gate FLAPS: it flips passing↔failing every 20-40 min, partly from
// genuine confidence/stability swings and partly from partial-corpus ticks that
// read overall_passing=null. A single-point headline over a flapping signal is a
// coin flip (2026-06-19). Report it as a WINDOWED verdict — the pass fraction
// over measured ticks — and call out flapping so green ≠ "stably lifted".
const liftMeasured = win.filter((r) => typeof r.lift?.overall_passing === "boolean");
const liftPass = liftMeasured.filter((r) => r.lift.overall_passing === true).length;
const liftFrac = liftMeasured.length ? liftPass / liftMeasured.length : null;
const lift = last.lift?.overall_passing;
const liftNow = lift === true ? "PASSING" : lift === false ? "FAILING" : "unknown";
// flapping = both states appear in the window and neither dominates strongly
const flapping = liftFrac != null && liftFrac > 0.15 && liftFrac < 0.85;
const liftVerdict = liftFrac == null ? "UNMEASURED"
  : liftFrac >= 0.85 ? "PASSING"
  : liftFrac <= 0.15 ? "FAILING"
  : "FLAPPING";
const liftWin = liftFrac == null ? "" : `  ${liftPass}/${liftMeasured.length} ticks pass (now ${liftNow})`;

console.log(`\n  substrate autonomy  ·  ${last.at.replace("T", " ").slice(0, 16)}  ·  window ${win.length} snaps${freshFlag}`);
console.log(`  ${"─".repeat(64)}`);
console.log(`  LIFT GATE        ${liftVerdict}${liftWin}   templates ${last.lift?.template_count ?? "?"}   vessels_down ${last.lift?.vessels_down ?? "?"}`);
if (flapping) {
  const fc = last.lift?.flap_context;
  // Stability gates on TEMPLATE-authoring burst only (2026-06-19, see
  // substrate-health-tick.ts). Edges are desirable convergence (governed by the
  // spectral-gap governor), so they are shown separately as growth, NOT as the
  // stability driver — matching the authoritative gate after commit 6f1546e.
  const ctx = fc
    ? `evidence ${fc.above_floor_1h}/${fc.distinct_run_1h} run-activities ≥8 execs (conc ${fc.concentration_ratio}; gate wants ≥0.25) · authoring ${fc.new_templates_1h ?? 0} templates/hr (gate wants ≤10) · +${fc.new_edges_1h ?? 0} edges/hr (healthy growth, not gated)`
    : "(flap_context not yet recorded)";
  console.log(`  ⚠ LIFT FLAPPING  gate unstable across window — driven by: ${ctx}`);
}
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
  arrow("capability.shape_closure", "up"), `composed ÷ produced — activity closure for topology discovery`));
console.log(fmt("  └ real closure", last.capability?.real_closure, delta("capability.real_closure"),
  arrow("capability.real_closure", "up"), `effective over REAL shapes (excl. ${last.capability?.orphan_auto_artifact ?? "·"} legacy LLM-artifacts); genuine orphans: ${last.capability?.orphan_genuine ?? "·"}`));
console.log(fmt("#11 self-manip", last.substrate_self?.manipulation_activities, delta("substrate_self.manipulation_activities"),
  arrow("substrate_self.manipulation_activities", "up"), `activities that manipulate the substrate (vessels/units/mitosis/scaffold)`));
console.log(fmt("#12 info (concepts)", last.substrate_self?.concepts, delta("substrate_self.concepts"),
  arrow("substrate_self.concepts", "up"), `concept-db size — accumulated information`));
console.log(fmt("#12 resource-eff", last.substrate_self?.llm_task_fraction, delta("substrate_self.llm_task_fraction"),
  arrow("substrate_self.llm_task_fraction", "down"), `LLM-task fraction (${last.substrate_self?.sampled_tasks ?? "·"} sampled) — LOW = efficient (most tasks cheap/deterministic)`));

// ── scarcest DEC limiter (R_conv ~ λ₁ · ρ_sample · κ⁻¹) ──────────────────────
console.log(`  ${"─".repeat(64)}`);
const tph = last.dec_limiters?.rho_sample_traces_per_hour;
const edges = last.backward_model?.composition_edges;
const ksp = kspread(last);
// Real spectral gap (Fiedler λ₂) from spectral-gap.jsonl — replaces the crude
// edge-COUNT proxy for λ₁. λ₂ ∈ [0,2]; normalize by /2 for the 0..1 health score.
// star_ratio (max_degree/(n-1)) flags hub-and-spoke degeneracy the count hides.
// Prefer the spectral snapshot FOLDED INTO the series by the collector (in-container,
// fresh). The host spectral-gap.jsonl is a stale mirror (it was ~11.5h behind on
// 2026-06-19, reading λ₂=0.94 while live was 0.54 — which mis-ranked the scarcest
// DEC limiter). Fall back to the host file only for snapshots predating the ingest.
let sg: { fiedler_lambda2?: number; star_ratio?: number; components?: number; nodes?: number } = {};
const parseLastJsonl = (text: string): any => {
  const lines = text.split("\n").filter((l) => l.trim());
  try { return lines.length ? JSON.parse(lines[lines.length - 1]!) : {}; } catch { return {}; }
};
if (last.spectral?.fiedler_lambda2 != null) {
  sg = last.spectral;                                   // folded into the series by the collector (freshest)
} else {
  // The collector ingest may not have landed yet (host→container bind can lag), so
  // read the LIVE container spectral-gap.jsonl directly via docker exec before
  // falling back to the host mirror (which can be hours stale).
  let containerText = "";
  try {
    const p = Bun.spawn(["docker", "exec", CONTAINER, "cat", "/workspace/metrics/spectral-gap.jsonl"], { stdout: "pipe", stderr: "ignore" });
    containerText = await new Response(p.stdout).text();
    if ((await p.exited) !== 0) containerText = "";
  } catch { /* docker unavailable */ }
  sg = parseLastJsonl(containerText);
  if (sg.fiedler_lambda2 == null) {
    sg = parseLastJsonl(await readHost(`${import.meta.dir}/workspace/metrics/spectral-gap.jsonl`));
  }
}
const lam2 = sg.fiedler_lambda2;
// normalize each term to a 0..1 health score (thresholds are heuristic, documented):
//   ρ_sample healthy by ~800 traces/hr · κ non-degeneracy is already 0..1 ·
//   λ₁ = REAL spectral gap (Fiedler λ₂)/2 when available, else edge-count proxy /30
const terms = [
  { name: "ρ_sample (throughput)", val: tph, unit: "tr/hr", score: tph == null ? null : Math.min(1, tph / 800), lever: "horizontal dispatch / trace-store hygiene" },
  { name: "κ⁻¹ (metric spread)", val: ksp, unit: "", score: ksp, lever: "graded-yield reward (avoid posterior saturation)" },
  // Health = min(1, λ₂): the normalized-Laplacian λ₂ sits near 1.0 for a well-mixed
  // (or star) graph and →0 for a fragmented/bottlenecked one, so λ₂≈1 IS healthy.
  // The spectral gap being high is necessary-not-sufficient — star_ratio (below)
  // flags the structural degeneracy a high λ₂ alone cannot.
  lam2 != null
    ? { name: "λ₁ (spectral gap λ₂)", val: lam2, unit: "", score: Math.min(1, lam2), lever: "keep λ₂ high as graph grows (stay connected); escape star via real A→B→C edges" }
    : { name: "λ₁ (credit mixing)", val: edges, unit: "edges", score: edges == null ? null : Math.min(1, edges / 30), lever: "composition-edge population / chain-credit" },
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
if (sg.fiedler_lambda2 != null) {
  const starFlag = (sg.star_ratio ?? 0) > 0.8 ? "  ⚠ near-pure STAR (hub-and-spoke; depth stays shallow)" : "";
  const fragFlag = (sg.components ?? 1) > 1 ? `  ⚠ ${sg.components} COMPONENTS (credit can't mix → λ₂ collapses)` : "";
  console.log(`  topology: ${sg.nodes ?? "·"} nodes · ${sg.components ?? "·"} component(s) · star_ratio ${(sg.star_ratio ?? 0).toFixed(2)}${starFlag}${fragFlag}`);
  console.log(`    keep λ₂ high AS the graph grows: new activities must CONNECT (no fragmentation) + escape the star (non-hub A→B→C edges)`);
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
  genuine_edges: r.capability?.genuine_edges,   // honest λ₁ (non-hub capability edges)
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
growth("edges", "edges (raw)");
growth("genuine_edges", "genuine λ₁");
growth("landed", "self-alteration");
growth("proposed", "proposed tmpl");
console.log("");

// ── SPECTRAL-GAP GOVERNOR (the master inequality λ₁ ≳ ρ_grow) ────────────────
// Coherent self-expansion requires credit-mixing (λ₁) to keep pace with capability
// minting (ρ_grow); otherwise new cells pile up as isolated leaves and the system
// drifts off the slow manifold into livelock (SUBSTRATE_AS_DYNAMICS.md §3-4). The
// GENERATIVE source (Seam ①) and any capability-minting work must gate on this:
//   ρ_grow      = slope(total_activities)/hr   — cells minted per hour
//   λ₁          = slope(GENUINE non-hub edges)/hr — credit-mixing edges gained per hour
//   structural  = star_ratio < 0.8 AND components == 1   (λ₂ alone lies for a star)
// governor_ok ⇔ headroom_ratio ≥ 1 AND structural. When NOT ok: do not raise ρ_grow.
{
  const rhoGrow = slopePerHr(series.filter((s) => s.concepts_total != null), "concepts_total");
  const lam1 = slopePerHr(series.filter((s) => s.genuine_edges != null), "genuine_edges");
  const genNow = (last.capability && (last.capability as any).genuine_edges);
  const starOk = (sg.star_ratio ?? 1) < 0.8;
  const fragOk = (sg.components ?? 1) === 1;
  const ratio = (rhoGrow != null && lam1 != null && rhoGrow > 0) ? lam1 / rhoGrow : (lam1 != null && (rhoGrow ?? 0) <= 0 ? Infinity : null);
  const magOk = ratio != null && ratio >= 1;
  const ok = magOk && starOk && fragOk;
  const verdict = ok ? "✓ headroom — safe to mint" : "✗ NEGATIVE — do NOT raise ρ_grow (mint capability)";
  console.log(`  ${"─".repeat(64)}`);
  console.log(`  SPECTRAL-GAP GOVERNOR (λ₁ ≳ ρ_grow — gates capability minting):`);
  console.log(`    ρ_grow ${rhoGrow == null ? "·" : (rhoGrow >= 0 ? "+" : "") + rhoGrow.toFixed(2)}/hr (cells)   λ₁ ${lam1 == null ? "·" : (lam1 >= 0 ? "+" : "") + lam1.toFixed(2)}/hr (genuine edges, now ${genNow ?? "·"})`);
  console.log(`    headroom ratio ${ratio == null ? "·" : ratio === Infinity ? "∞" : ratio.toFixed(2)}   structural: star_ratio ${(sg.star_ratio ?? 0).toFixed(2)} ${starOk ? "✓" : "✗"} · ${sg.components ?? "·"} component(s) ${fragOk ? "✓" : "✗"}`);
  console.log(`    ⟶ ${verdict}`);
}
