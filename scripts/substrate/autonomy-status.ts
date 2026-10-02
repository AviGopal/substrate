#!/usr/bin/env bun
/**
 * autonomy-status.ts — READ-ONLY one-shot "is the substrate reaching autonomy?" view.
 *
 * REDESIGN PRINCIPLE (2026-07-03): every metric shown here must track a quantity
 * that is VISIBLE TO THE SYSTEM ITSELF AS A SHAPE — i.e. resolvable through the
 * substrate's own impulse surface (dev-vessel detectors/aggregators, discovery),
 * not an operator-side artifact only the host can see. The view has two tiers:
 *
 *   1. SHAPE-RESOLVED STATUS (primary) — each line resolves a first-class shape
 *      live from development-vessel and renders it with a usefulness verdict.
 *      What the operator sees here is exactly what the substrate's own citizens
 *      (gap-compose, detectors, governors) can see and act on.
 *   2. TRENDS (secondary) — windowed deltas over the collector's JSONL series.
 *      The series is a host-cached HISTORY of shape-visible quantities (shapes
 *      are point-in-time; slopes need history). Every row is annotated with the
 *      shape it derives from; rows with NO shape backing are flagged
 *      "not shape-visible" as closure gaps rather than silently kept.
 *
 * Usefulness annotations come from the measured causal ledger
 * (validation/results/2026-07-03-learning-transfer-causal-ledger.md): SF-coverage
 * and genuine-edge density PREDICT per-goal reached-rate; crystallization does
 * not (bookkeeping dial); stalled-credit is a zero-variance tripwire. A dial
 * that predicts nothing is labelled so.
 *
 * Strictly read-only; fail-soft (unreachable resolver renders "dark", never breaks).
 *
 *   bun scripts/substrate/autonomy-status.ts          # window = last 24 snapshots
 *   N=60 bun scripts/substrate/autonomy-status.ts     # widen the delta window
 *   AUTONOMY_DEEP=1 bun .../autonomy-status.ts        # also resolve slow shapes
 *                                                     # (learned_topology_snapshot,
 *                                                     #  vector_space_orthogonality_audit)
 */
const N = Number(process.env.N ?? 24);
const STALE_MIN = Number(process.env.STALE_MIN ?? 45); // collector runs every 20m; >45m = timer trouble
const DEEP = process.env.AUTONOMY_DEEP === "1";

// ── shape resolution (the system's own view) ────────────────────────────────
// DISCOVERY-FIRST (2026-07-05): each shape is routed to whichever vessel the
// discovery registry says PRODUCES it (vesselCapability → resolve_endpoint),
// instead of assuming development-vessel at a hardcoded port. The static
// candidates below remain only as the fail-soft fallback when discovery is
// dark — the view must never break just because routing is degraded.
const DEV_VESSEL_CANDIDATES = [
  process.env.DEV_VESSEL_ENDPOINT,
  "http://localhost:18090",   // host-mapped port (how `make autonomy-status` runs)
  "http://127.0.0.1:8090",    // in-container fallback
].filter(Boolean) as string[];

const DISCOVERY_CANDIDATES = [
  process.env.DISCOVERY_ENDPOINT,
  "http://localhost:18100",   // host-mapped
  "http://127.0.0.1:8100",    // in-container
].filter(Boolean) as string[];

// Discovery mutations/queries require an API key; reuse the operator's key
// (env first, then ~/.metabob/config.json) — read-only usage.
const API_KEY = process.env.METABOB_API_KEY || await (async () => {
  try {
    const cfg = JSON.parse(await Bun.file(`${process.env.HOME}/.metabob/config.json`).text());
    return cfg?.metabob?.apiKey ?? "";
  } catch { return ""; }
})();

// Registered endpoints advertise in-container ports (e.g. localhost:8090); when
// this script runs on the host those are reachable via the 8xxx→18xxx map. Try
// both — whichever answers first wins.
function hostRemap(ep: string): string | null {
  const m = ep.match(/^(https?:\/\/)(localhost|127\.0\.0\.1):8(\d{3})(\/.*)?$/);
  return m ? `${m[1]}${m[2]}:18${m[3]}${m[4] ?? ""}` : null;
}

const shapeEndpointCache = new Map<string, string[]>();
async function discoverEndpoints(shape: string): Promise<string[]> {
  const hit = shapeEndpointCache.get(shape);
  if (hit) return hit;
  for (const disc of DISCOVERY_CANDIDATES) {
    try {
      const res = await fetch(`${disc}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
        body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as any;
      const vessels: any[] = j?.content?.vessels ?? [];
      if (!vessels.length) break; // registry answered: no producer — fall back, don't retry other discovery eps
      const eps: string[] = [];
      for (const v of vessels) {
        if (!v?.endpoint) continue;
        eps.push(v.endpoint);
        const remapped = hostRemap(v.endpoint);
        if (remapped) eps.push(remapped);
      }
      if (eps.length) { shapeEndpointCache.set(shape, eps); return eps; }
    } catch { /* try next discovery endpoint */ }
  }
  return [];
}

async function resolveShape(type: string, extra: Record<string, unknown> = {}, timeoutMs = 20000): Promise<any | null> {
  // discovery-routed producers first, static dev-vessel candidates as fallback
  const discovered = await discoverEndpoints(type);
  const candidates = [...new Set([...discovered, ...DEV_VESSEL_CANDIDATES])];
  for (const ep of candidates) {
    try {
      const res = await fetch(`${ep}/v2/impulses/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
        body: JSON.stringify({ impulse: { type, ...extra } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as any;
      if (j?.success && j?.body) return j.body;
    } catch { /* try next endpoint */ }
  }
  return null;
}

// discovery-vessel registry stats — fleet size / advertised vocabulary (public endpoint)
async function fleetStats(): Promise<{ totalVessels?: number; totalShapes?: number; healthyCount?: number } | null> {
  for (const ep of [process.env.DISCOVERY_ENDPOINT, "http://localhost:18100", "http://127.0.0.1:8100"].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`${ep}/registry/stats`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return (await res.json()) as any;
    } catch { /* next */ }
  }
  return null;
}

// ── collector series (host-cached HISTORY of shape-visible quantities) ──────
// The AUTHORITATIVE copy is what the collector writes inside the substrate at
// /workspace/metrics/autonomy-metrics.jsonl (a docker volume). Gather every
// reachable source and pick the freshest (re-fixed 2026-06-19: reading only the
// host cache silently froze the view while the collector kept writing).
const HOST_FALLBACK = `${import.meta.dir}/workspace/metrics/autonomy-metrics.jsonl`;
const CONTAINER = process.env.SUBSTRATE_CONTAINER ?? "substrate-live";
const CONTAINER_PATH = "/workspace/metrics/autonomy-metrics.jsonl";

async function readHost(path: string): Promise<string> {
  try { return (await Bun.file(path).exists()) ? await Bun.file(path).text() : ""; } catch { return ""; }
}
async function readSubstrate(path: string): Promise<string> {
  // (a) INSIDE the container (`make autonomy-status` → docker exec): /workspace is
  //     local, docker is NOT installed — direct read first.
  // (b) ON the host: /workspace is a volume — shell in via docker exec.
  const direct = await readHost(path);
  if (direct) return direct;
  try {
    const p = Bun.spawn(["docker", "exec", CONTAINER, "cat", path], { stdout: "pipe", stderr: "ignore" });
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
sources.push({ label: `${CONTAINER}:${CONTAINER_PATH}`, text: await readSubstrate(CONTAINER_PATH) });
sources.push({ label: HOST_FALLBACK, text: await readHost(HOST_FALLBACK) });

let best = sources[0]!;
for (const s of sources) { if (s.text && lastAt(s.text) > lastAt(best.text)) best = s; }
const text = best.text;
const rows = text.split("\n").filter((l) => l.trim())
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
const win = rows.slice(-N);
const last = win.length ? win[win.length - 1] : null;
const first = win.length ? win[0] : null;

// ── kick off ALL shape resolves in parallel up front ────────────────────────
const shapesP = {
  ltr: resolveShape("learning_transfer_report", {}, 60000),
  gapLifecycle: resolveShape("gap_lifecycle_scan", {}, 15000),
  funnel: resolveShape("self_alteration_funnel_scan", {}, 15000),
  yieldRep: resolveShape("detector_yield_registry", {}, 30000),
  selfInt: resolveShape("self_interference_scan", {}, 30000),
  entropy: resolveShape("selectionEntropy", {}, 15000),
  refused: resolveShape("interventionRefused", {}, 15000),
  sysLoad: resolveShape("system_load_report", {}, 10000),
  fleet: fleetStats(),
  topo: DEEP ? resolveShape("learned_topology_snapshot", {}, 90000) : Promise.resolve(undefined),
  ortho: DEEP ? resolveShape("vector_space_orthogonality_audit", {}, 90000) : Promise.resolve(undefined),
};

// ── header ──────────────────────────────────────────────────────────────────
const nowIso = new Date().toISOString().replace("T", " ").slice(0, 16);
const ageMin = last ? (Date.now() - Date.parse(last.at)) / 60000 : null;
const freshFlag = ageMin != null && ageMin > STALE_MIN ? `  ⚠ series STALE (${ageMin.toFixed(0)}m old; collector may be down)` : "";
console.log(`\n  substrate autonomy  ·  ${nowIso}  ·  series window ${win.length} snaps${freshFlag}`);

const fleet = await shapesP.fleet;
if (fleet) {
  const sick = (fleet.totalVessels ?? 0) - (fleet.healthyCount ?? 0);
  console.log(`  FLEET            ${fleet.healthyCount}/${fleet.totalVessels} vessels healthy · ${fleet.totalShapes} advertised shapes${sick > 0 ? `  ⚠ ${sick} unhealthy` : ""}   [shape: vesselRegistry]`);
} else {
  console.log(`  FLEET            dark — discovery-vessel unreachable ⚠ (nothing below can be trusted as live)`);
}

// ── LIFT GATE (windowed over the series; shape: substrate_health_tick) ──────
// The gate FLAPS tick-to-tick; a single-point headline is a coin flip (2026-06-19).
// The series rows are the collector's ingest of substrateHealthReport emissions,
// so this is a HISTORY of a shape-visible quantity — resolve substrate_health_tick
// for the live value (slow; it recomputes the full gate, so not done here).
if (last) {
  const liftMeasured = win.filter((r) => typeof r.lift?.overall_passing === "boolean");
  const liftPass = liftMeasured.filter((r) => r.lift.overall_passing === true).length;
  const liftFrac = liftMeasured.length ? liftPass / liftMeasured.length : null;
  const lift = last.lift?.overall_passing;
  const liftNow = lift === true ? "PASSING" : lift === false ? "FAILING" : "unknown";
  const flapping = liftFrac != null && liftFrac > 0.15 && liftFrac < 0.85;
  const liftVerdict = liftFrac == null ? "UNMEASURED"
    : liftFrac >= 0.85 ? "PASSING"
    : liftFrac <= 0.15 ? "FAILING"
    : "FLAPPING";
  const liftWin = liftFrac == null ? "" : `  ${liftPass}/${liftMeasured.length} ticks pass (now ${liftNow})`;
  console.log(`  LIFT GATE        ${liftVerdict}${liftWin}   templates ${last.lift?.template_count ?? "?"}   vessels_down ${last.lift?.vessels_down ?? "?"}   [shape: substrate_health_tick]`);
  if (flapping) {
    const fc = last.lift?.flap_context;
    // Stability gates on TEMPLATE-authoring burst only (2026-06-19); edges are
    // governed growth, shown separately — matches the authoritative gate (6f1546e).
    const ctx = fc
      ? `evidence ${fc.above_floor_1h}/${fc.distinct_run_1h} run-activities ≥8 execs (conc ${fc.concentration_ratio}; gate wants ≥0.25) · authoring ${fc.new_templates_1h ?? 0} templates/hr (gate wants ≤10) · +${fc.new_edges_1h ?? 0} edges/hr (healthy growth, not gated)`
      : "(flap_context not yet recorded)";
    console.log(`  ⚠ LIFT FLAPPING  gate unstable across window — driven by: ${ctx}`);
  }
} else {
  console.log(`  LIFT GATE        no series yet — is the autonomy-metrics.timer active?   [shape: substrate_health_tick]`);
}

// ════════════════════════════════════════════════════════════════════════════
// SHAPE-RESOLVED STATUS — first-hand, live, exactly what substrate citizens see
// ════════════════════════════════════════════════════════════════════════════
console.log(`  ${"═".repeat(64)}`);
console.log(`  SHAPE-RESOLVED STATUS (live resolves from the substrate's own impulse surface):`);
const dline = (label: string, body: string) => console.log(`    ${label.padEnd(16)} ${body}`);

// — learning transfer (learningTransferReport) —
{
  const ltr = await shapesP.ltr;
  if (ltr?.scanned) {
    const sf = ltr.sf_coverage, ed = ltr.genuine_edge_density, cc = ltr.crystallized_cells, st = ltr.stalled_credit_chains;
    const sfPct = sf ? (sf.coverage * 100).toFixed(1) : "·";
    dline("transfer ψ", `sf_coverage ${sfPct}% (${sf?.sf_cells}/${sf?.variant_cells}) — PREDICTIVE: SF-covered paths reach +6–8pp (ledger 2026-07-03); growth beyond ~18.5% needs live re-execution (retention sweep destroyed old ψ evidence)`);
    const ineqOk = ed?.inequality_ok === true;
    const margin = ed ? (ed.density - ed.uninformed_fraction).toFixed(3) : "·";
    dline("λ₁ ≳ ρ_grow", `${ineqOk ? "✓ holds" : "✗ VIOLATED"}  density ${ed?.density?.toFixed(3)} vs uninformed ${ed?.uninformed_fraction?.toFixed(3)} (margin ${margin}; ${ed?.genuine_edges} genuine edges) — edge participation is the STRONGEST reached-rate predictor (+26–35pp)`);
    const stalled = st?.stalled_count ?? null;
    dline("stalled credit", `${stalled === 0 ? "✓ 0" : `⚠ ${stalled}`} of ${st?.chains_examined ?? "·"} chains — tripwire (alarm on nonzero); zero variance, NOT an optimization dial`);
    dline("crystallized", `${cc ? (cc.fraction * 100).toFixed(1) : "·"}% uninformed cells (${cc?.uninformed}/${cc?.total}) — bookkeeping only; measured NON-predictive of reached/cost/speed, do not optimize`);
  } else {
    dline("transfer ψ", `dark — learning_transfer_report unreachable${ltr?.error ? ` (${ltr.error})` : ""} ⚠ (this detector regressed to skeleton once on 2026-07-03; check the resolver is the implemented version)`);
  }
}

// — gap lifecycle (gapLifecycleReport) — replaces the raw substrateGap top-500 pull:
//   the lifecycle scan is itself a substrate citizen, so its numbers are the ones
//   gap-compose actually acts on (open/stale/churn), with no client-side capping.
{
  const gl = await shapesP.gapLifecycle;
  if (gl?.total_gaps != null) {
    const staleCats = Object.entries(gl.top_stale_categories ?? {}).slice(0, 3).map(([c, n]) => `${c} ${n}`).join(" · ");
    const staleFrac = gl.open ? (gl.stale_open / gl.open) : null;
    const staleWarn = staleFrac != null && staleFrac > 0.5 ? " ⚠ majority of the queue is stale — detectors outpace the loop's consumption" : "";
    dline("gap lifecycle", `${gl.open} open of ${gl.total_gaps} (${gl.stale_open} stale >${gl.stale_hours}h · churned ${gl.churned} · auto-closed ${gl.auto_closed})${staleWarn}`);
    if (staleCats) dline("", `stale top: ${staleCats} — should FALL without operator fixes`);
  } else {
    dline("gap lifecycle", "dark — gap_lifecycle_scan unreachable");
  }
}

// — self-alteration funnel (selfAlterationFunnelReport) — authored→staged→landed→pushed
{
  const fu = await shapesP.funnel;
  if (fu?.funnel) {
    const f = fu.funnel;
    const conv = fu.conversion ?? {};
    dline("self-alteration", `${f.authored} authored → ${f.staged} staged → ${f.landed} landed → ${f.pushed} pushed (${fu.window_hours}h) · staged→landed ${(conv.staged_to_landed ?? 0).toFixed(2)}`);
    if (fu.backlog_size != null) dline("", `proposal backlog ${fu.backlog_size} (${fu.stale_backlog} stale, ${((fu.stale_fraction ?? 0) * 100).toFixed(0)}%) — note: landed may include operator cutovers (see caveat field)`);
  } else {
    dline("self-alteration", "dark — self_alteration_funnel_scan unreachable");
  }
}

// — detector fleet (detectorYieldReport) —
{
  const yieldRep = await shapesP.yieldRep;
  if (yieldRep?.detectors) {
    const ds = yieldRep.detectors as any[];
    const byStatus = new Map<string, number>();
    for (const d of ds) byStatus.set(d.status ?? "?", (byStatus.get(d.status ?? "?") ?? 0) + 1);
    const landed = ds.reduce((a, d) => a + (d.gaps_landed ?? 0), 0);
    const emitted = ds.reduce((a, d) => a + (d.gaps_emitted ?? 0), 0);
    const dormant = ds.filter((d) => d.status === "DORMANT").map((d) => d.detector_id);
    const statusStr = [...byStatus.entries()].map(([s, n]) => `${n} ${s}`).join(" / ");
    const landRate = emitted > 0 ? ((landed / emitted) * 100).toFixed(0) : "·";
    dline("detector fleet", `${ds.length} detectors: ${statusStr} · gap→land ${landed}/${emitted} (${landRate}%)${dormant.length ? `  ⚠ dormant: ${dormant.slice(0, 3).join(", ")}` : ""} — low land-rate = detectors filing work the loop can't consume`);
  } else {
    dline("detector fleet", "dark — detector_yield_registry unreachable");
  }
}

// — selection entropy (selectionEntropy) — exploration health of the selector
{
  const en = await shapesP.entropy;
  if (en?.overall_entropy != null) {
    dline("selection entropy", `${en.overall_entropy.toFixed(3)} over ${en.template_count} templates (floor ${en.entropy_floor}) ${en.collapsed ? "⚠ COLLAPSED — selection has stopped exploring" : "✓ exploring"}`);
  } else {
    dline("selection entropy", "dark — selectionEntropy unreachable");
  }
}

// — self-interference (selfInterferenceReport) —
{
  const selfInt = await shapesP.selfInt;
  if (selfInt) {
    const inter = selfInt.interrupted_dispatches ?? 0, busy = selfInt.compose_busy_refusals ?? 0;
    dline("self-interfere", `${inter === 0 ? "✓" : "⚠"} ${inter} interrupted dispatches · ${busy} BUSY refusals — cutover-vs-inflight collisions; rising = the dev-loop stepping on its own work`);
  } else {
    dline("self-interfere", "dark — self_interference_scan unreachable");
  }
}

// — S3 push-away (interventionRefused) — refusals WITH evidence, first-hand
{
  const ref = await shapesP.refused;
  const list = ref?.refusals;
  if (Array.isArray(list)) {
    const latest = list[list.length - 1];
    const basis = latest?.refusal_basis ? String(latest.refusal_basis).slice(0, 90) : null;
    dline("S3 push-away", `${list.length} interventionRefused on record${basis ? ` · latest: "${basis}…"` : ""} — active refusal w/ cited evidence is the S3 signal (not intervention-absence)`);
  } else {
    dline("S3 push-away", "dark — interventionRefused unreachable");
  }
}

// — system load (systemLoadReport) — is the substrate resource-healthy right now
{
  const sl = await shapesP.sysLoad;
  if (sl?.load_avg_1m != null) {
    const anom = (sl.anomaly_count ?? 0) > 0;
    dline("system load", `${anom ? "⚠" : "✓"} load ${sl.load_avg_1m}/${sl.cpu_cores} cores · mem ${sl.mem_used_pct}%${sl.load_anomaly ? " · LOAD ANOMALY" : ""}${sl.memory_anomaly ? " · MEMORY ANOMALY" : ""} — the substrate's own resource self-observation`);
  } else {
    dline("system load", "dark — system_load_report unreachable");
  }
}

// — DEEP-only slow shapes —
if (DEEP) {
  const topo = await shapesP.topo;
  if (topo?.advertised_shapes) {
    dline("topology snap", `${topo.advertised_shapes.length} advertised shapes with producers (1h window) [learned_topology_snapshot]`);
  } else {
    dline("topology snap", "dark — learned_topology_snapshot unreachable/slow");
  }
  const ortho = await shapesP.ortho;
  if (ortho?.mean_coherence != null) {
    dline("orthogonality", `mean_coherence ${ortho.mean_coherence.toFixed(3)} — live vector_space_orthogonality_audit`);
  } else {
    dline("orthogonality", "dark — vector_space_orthogonality_audit timed out (known-slow; series coherence below is the fallback)");
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TRENDS — windowed deltas over the collector series (history of shape-visible
// quantities; each row names its shape provenance)
// ════════════════════════════════════════════════════════════════════════════
if (!last) {
  console.log(`  ${"═".repeat(64)}`);
  console.log("  no collector series yet — trends unavailable (shape-resolved status above is live)");
  process.exit(0);
}

// a probe reading null persistently = dark instrument (single-point nulls FLAP; 2026-06-19)
const PERSIST = Math.min(3, win.length);
const recent = win.slice(-PERSIST);
const persistentlyNull = (path: string) =>
  recent.every((r) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), r) == null);
const dark: string[] = [];
if (persistentlyNull("gaps.model_reality_open")) dark.push("gaps");
if (persistentlyNull("dec_limiters.rho_sample_traces_per_hour")) dark.push("ρ_sample");
if (persistentlyNull("backward_model.composition_edges")) dark.push("λ₁/edges");
if (persistentlyNull("forward_model.selector_scored_fraction")) dark.push("selector");

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

console.log(`  ${"═".repeat(64)}`);
console.log(`  TRENDS (Δ over ${win.length}-snap window of the collector series; [shape] = system-visible source):`);
if (dark.length) console.log(`  ⚠ BLIND PROBES   ${dark.join(", ")} reading null — restore before trusting green`);

const fmt = (label: string, cur: any, d: string, mark: string, note: string) =>
  `  ${label.padEnd(16)} ${String(cur ?? "·").padStart(7)}   Δ${d.padStart(6)}  ${mark}  ${note}`;

console.log(fmt("self-alteration", last.self_alteration?.landed, delta("self_alteration.landed"),
  arrow("self_alteration.landed", "up"), "landed proposals [self_alteration_funnel_scan]"));
console.log(fmt("model-reality gaps", last.gaps?.model_reality_open, delta("gaps.model_reality_open"),
  arrow("gaps.model_reality_open", "down"), "open gaps — should fall without operator fixes [substrateGap / gap_lifecycle_scan]"));
console.log(fmt("backward model", last.backward_model?.composition_edges, delta("backward_model.composition_edges"),
  arrow("backward_model.composition_edges", "up"), "composition edges [learning_transfer_report.genuine_edge_density / compositionSuccess]"));
console.log(fmt("  └ orphan RECENT", last.backward_model?.recent_orphan_rate, delta("backward_model.recent_orphan_rate"),
  arrow("backward_model.recent_orphan_rate", "down"), `60m dangling-parent rate (${last.backward_model?.recent_composition_count ?? "·"} compositions) [trace_outcome_validity_audit]`));
console.log(fmt("learn-speed MGD", last.posterior_convergence?.managed_converged_frac, delta("posterior_convergence.managed_converged_frac"),
  arrow("posterior_convergence.managed_converged_frac", "up"), `converged ÷ Thompson-managed (${last.posterior_convergence?.converged ?? "·"}c/${last.posterior_convergence?.learning ?? "·"}l) [posterior_consistency_audit / variantMetricsSummary]`));
console.log(fmt("#6 uncertainty", last.posterior_uncertainty?.mean_variance, delta("posterior_uncertainty.mean_variance"),
  arrow("posterior_uncertainty.mean_variance", "down"), `mean Beta variance, ${last.posterior_uncertainty?.managed_cells ?? "·"} managed cells — DOWN = learning [variantMetricsSummary]`));
console.log(fmt("explore breadth", last.capability?.exploration_breadth, delta("capability.exploration_breadth"),
  arrow("capability.exploration_breadth", "up"), `distinct activities 24h ÷ total (${last.capability?.distinct_exercised_24h ?? "·"}/${last.capability?.total_activities ?? "·"}) [selectionEntropy / executionTraces]`));
console.log(fmt("cross-vessel comp", last.capability?.cross_vessel_frac, delta("capability.cross_vessel_frac"),
  arrow("capability.cross_vessel_frac", "up"), `edges spanning vessels (${last.capability?.cross_vessel_edges ?? "·"}/${last.capability?.total_edges ?? "·"}) [compositionSuccess]`));
console.log(fmt("shape closure", last.capability?.real_closure, delta("capability.real_closure"),
  arrow("capability.real_closure", "up"), `composed ÷ produced over REAL shapes (genuine orphans: ${last.capability?.orphan_genuine ?? "·"}) [composition_coverage_report]`));
console.log(fmt("#12 info (concepts)", last.substrate_self?.concepts, delta("substrate_self.concepts"),
  arrow("substrate_self.concepts", "up"), `concept-db size — accumulated information [conceptUsageStats]`));
console.log(fmt("#12 resource-eff", last.substrate_self?.llm_task_fraction, delta("substrate_self.llm_task_fraction"),
  arrow("substrate_self.llm_task_fraction", "down"), `LLM-task fraction (${last.substrate_self?.sampled_tasks ?? "·"} sampled) — LOW = efficient [resolverCostAnalysis]`));

// ── DEC convergence limiters (R ~ λ₁·ρ_sample·κ⁻¹; slowest term sets the rate) ──
console.log(`  ${"─".repeat(64)}`);
const tph = last.dec_limiters?.rho_sample_traces_per_hour;
const edges = last.backward_model?.composition_edges;
const ksp = kspread(last);
// Real spectral gap (Fiedler λ₂): prefer the collector-folded snapshot (fresh);
// fall back to the container's spectral-gap.jsonl, then the host mirror (stale
// by hours on 2026-06-19 — mis-ranked the scarcest limiter).
// ⚠ NOT SHAPE-VISIBLE: spectral-gap.jsonl is a host/collector artifact with no
// resolver shape; the system itself cannot see λ₂. Closure gap — the system-visible
// alternates are signature_cluster_scan / vector_space_orthogonality_audit.
let sg: { fiedler_lambda2?: number; star_ratio?: number; components?: number; nodes?: number } = {};
const parseLastJsonl = (t: string): any => {
  const lines = t.split("\n").filter((l) => l.trim());
  try { return lines.length ? JSON.parse(lines[lines.length - 1]!) : {}; } catch { return {}; }
};
if (last.spectral?.fiedler_lambda2 != null) {
  sg = last.spectral;
} else {
  sg = parseLastJsonl(await readSubstrate("/workspace/metrics/spectral-gap.jsonl"));
  if (sg.fiedler_lambda2 == null) {
    sg = parseLastJsonl(await readHost(`${import.meta.dir}/workspace/metrics/spectral-gap.jsonl`));
  }
}
const lam2 = sg.fiedler_lambda2;
const terms = [
  { name: "ρ_sample (throughput)", val: tph, unit: "tr/hr", score: tph == null ? null : Math.min(1, tph / 800), lever: "horizontal dispatch / trace-store hygiene" },
  { name: "κ⁻¹ (metric spread)", val: ksp, unit: "", score: ksp, lever: "graded-yield reward (avoid posterior saturation)" },
  lam2 != null
    ? { name: "λ₁ (spectral gap λ₂)", val: lam2, unit: "", score: Math.min(1, lam2), lever: "WITHIN-block credit-mixing only; do NOT chase GLOBAL λ₂ (mixing=anti-orthogonal). Keep cells ORTHOGONAL — see coherence." }
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
  const fragFlag = (sg.components ?? 1) > 1 ? `  ⚠ ${sg.components} COMPONENTS (credit can't mix → λ₂ collapses)` : "";
  console.log(`  topology: ${sg.nodes ?? "·"} nodes · ${sg.components ?? "·"} component(s) · star_ratio ${(sg.star_ratio ?? 0).toFixed(2)}${fragFlag}   ⚠ not shape-visible (host artifact) — closure gap`);
  console.log(`    NOTE: low global λ₂ is EXPECTED — orthogonality (sparse, modular) is the moat, not mixing`);
}
// ORTHOGONALITY / dictionary coherence (the honest learning-health signal, MDP §12.7)
const coh = last.coherence;
if (coh && coh.mean_coherence != null) {
  const eroding = (coh.mean_coherence ?? 0) > 0.35 || (coh.high_coherence_frac ?? 0) > 0.05;
  console.log(`  ORTHOGONALITY  mean_coherence ${(coh.mean_coherence ?? 0).toFixed(3)} · near-dup-frac ${(coh.high_coherence_frac ?? 0).toFixed(3)} · n=${coh.total_activities ?? "·"}  ${eroding ? "⚠ coherence high — moat eroding (action-space redundancy)" : "✓"}   [vector_space_orthogonality_audit]`);
}

// ── GROWTH RATE + ACCELERATION ───────────────────────────────────────────────
console.log(`  ${"─".repeat(64)}`);
console.log(`  GROWTH RATE (least-squares /hr; older-half → newer-half; ⤴ accelerating):`);
const series = win.map((r) => ({
  t: Date.parse(r.at),
  edges: r.backward_model?.composition_edges,
  genuine_edges: r.capability?.genuine_edges,
  landed: r.self_alteration?.landed,
  proposed: r.capability?.proposed_templates,
  concepts_total: r.forward_model?.total_activities,
}));
const slopePerHr = (pts: any[], k: string): number | null => {
  const xs = pts.map((p) => p.t / 3.6e6), ys = pts.map((p) => p[k]);
  const n = xs.length; if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : null;
};
const growth = (k: string, label: string, shape: string) => {
  const pts = series.filter((s) => s[k as keyof typeof s] != null);
  if (pts.length < 4) { console.log(`    ${label.padEnd(16)} (insufficient points)`); return; }
  const half = Math.floor(pts.length / 2);
  const overall = slopePerHr(pts, k);
  const s1 = slopePerHr(pts.slice(0, half + 1), k), s2 = slopePerHr(pts.slice(half), k);
  if (overall == null) { console.log(`    ${label.padEnd(16)} (gaps)`); return; }
  let mark = "→ steady";
  if (s1 != null && s2 != null) mark = s2 > s1 + 0.05 ? "⤴ accelerating" : s2 < s1 - 0.05 ? "⤵ decelerating" : "→ steady";
  console.log(`    ${label.padEnd(16)} ${overall.toFixed(2).padStart(7)}/hr trend   (${(s1 ?? 0).toFixed(2)}→${(s2 ?? 0).toFixed(2)})  ${mark}   [${shape}]`);
};
growth("genuine_edges", "genuine λ₁", "learning_transfer_report");
growth("landed", "self-alteration", "self_alteration_funnel_scan");
growth("proposed", "proposed tmpl", "templateAuditReport");
growth("concepts_total", "activity cells", "activityTemplate");

// ── SPECTRAL-GAP GOVERNOR (λ₁ ≳ ρ_grow — gates capability minting) ───────────
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
  console.log(`  SPECTRAL-GAP GOVERNOR (λ₁ ≳ ρ_grow — the same inequality learning_transfer_report checks statically):`);
  console.log(`    ρ_grow ${rhoGrow == null ? "·" : (rhoGrow >= 0 ? "+" : "") + rhoGrow.toFixed(2)}/hr (cells)   λ₁ ${lam1 == null ? "·" : (lam1 >= 0 ? "+" : "") + lam1.toFixed(2)}/hr (genuine edges, now ${genNow ?? "·"})`);
  console.log(`    headroom ratio ${ratio == null ? "·" : ratio === Infinity ? "∞" : ratio.toFixed(2)}   structural: star_ratio ${(sg.star_ratio ?? 0).toFixed(2)} ${starOk ? "✓" : "✗"} · ${sg.components ?? "·"} component(s) ${fragOk ? "✓" : "✗"}`);
  console.log(`    ⟶ ${verdict}`);
}
console.log("");
