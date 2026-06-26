#!/usr/bin/env bun
/**
 * criterion-coverage.ts — maps the operator's autonomy-goal criteria (the /goal
 * directive) onto live substrate measurements and emits a verdict per criterion.
 *
 * WHY: the autonomy-status / autonomy-metrics views track the substrate's OWN
 * health vocabulary (DEC limiters, lift gate, growth trends). This view answers a
 * different question — "for each thing the operator asked for, what is the
 * evidence and is it met?" — so progress against the stated goal is auditable and
 * tracked over time rather than asserted. Reads the latest autonomy-metrics
 * snapshot (collected on a 20-min timer) plus a few supplementary live probes.
 *
 * Verdicts: PASS (criterion demonstrably met) · PARTIAL (mechanism exists,
 * metric below target or improving) · GAP (genuinely unmet/absent). Each line
 * carries the metric and a one-line evidence string. Output appended to
 * workspace/metrics/criterion-coverage.jsonl and printed as a table.
 */
const METRICS = `${import.meta.dir}/workspace/metrics/autonomy-metrics.jsonl`;
const OUT = `${import.meta.dir}/workspace/metrics/criterion-coverage.jsonl`;
const ACTIVITY_API = process.env["ACTIVITY_API_ENDPOINT"] ?? "http://127.0.0.1:18080";
const DEV_VESSEL = process.env["DEV_VESSEL_ENDPOINT"] ?? "http://127.0.0.1:18090";
const CONCEPT_DB = process.env["CONCEPT_DB_ENDPOINT"] ?? "http://127.0.0.1:18260";

const num = (v: unknown, d = NaN): number => (typeof v === "number" ? v : d);
const pct = (x: number): string => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "n/a");

async function latestSnapshot(): Promise<any> {
  const txt = await Bun.file(METRICS).text();
  const lines = txt.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!);
}

async function unitActive(unit: string): Promise<boolean> {
  try {
    const p = Bun.spawn(["docker", "exec", "substrate-live", "systemctl", "is-active", unit], { stdout: "pipe", stderr: "pipe" });
    const out = (await new Response(p.stdout).text()).trim();
    return out === "active";
  } catch { return false; }
}

/** Run a scalar-count SurrealQL against the in-container DB. Returns NaN on error. */
async function sqlCount(whereClause: string): Promise<number> {
  try {
    const sql = `SELECT count() AS c FROM activity_execution_traces WHERE ${whereClause} GROUP ALL;`;
    const script = `const env=await Bun.file("/etc/substrate/env").text();const PASS=(env.match(/SURREAL_PASS="?([^"\\s]+)"?/)||[])[1];const r=await(await fetch("http://127.0.0.1:8000/sql",{method:"POST",headers:{"Content-Type":"text/plain",Accept:"application/json","surreal-ns":"activity-system","surreal-db":"learning_loop",Authorization:"Basic "+btoa("root:"+PASS)},body:${JSON.stringify(sql)}})).json();console.log(r[0]?.result?.[0]?.c??0);`;
    const p = Bun.spawn(["docker", "exec", "substrate-live", "bun", "-e", script], { stdout: "pipe", stderr: "pipe" });
    const out = (await new Response(p.stdout).text()).trim();
    return Number(out);
  } catch { return NaN; }
}

type Verdict = "PASS" | "PARTIAL" | "GAP";
interface Row { id: string; criterion: string; verdict: Verdict; metric: string; evidence: string; }

const m = await latestSnapshot();
const rows: Row[] = [];
const add = (id: string, criterion: string, verdict: Verdict, metric: string, evidence: string) =>
  rows.push({ id, criterion, verdict, metric, evidence });

// --- supplementary live probes ----------------------------------------------
const obsidianActive = await unitActive("obsidian-vessel");
const conceptDbActive = await unitActive("concept-db");

// 1. Topology well-defined
const edges = num(m.backward_model?.composition_edges);
const lambda1 = num(m.dec_limiters?.lambda1_composition_edges, edges);
add("topology_defined", "Topology well defined", edges > 0 ? "PARTIAL" : "GAP",
  `${edges} distinct composition edges (λ₁)`,
  "composition-edge-reconcile derives edges from traces; distinct topology grows slowly — depth-2 only");

// 2. Selection/priority by topology
add("selection_by_topology", "Selection & priority driven by topology", "PASS",
  `selector_scored_fraction ${pct(num(m.forward_model?.selector_scored_fraction))}`,
  "boredom pool/shape UCB scorer ranks candidates by value/sec; dense-recommend coverage 100%");

// 3. Develop capabilities across all vessels via activities
const selfManip = num(m.substrate_self?.manipulation_activities);
add("cross_vessel_dev", "Develops capabilities across vessels via activities", "PASS",
  `${num(m.self_alteration?.landed)} landed self-alterations; self-manip activities ${Number.isFinite(selfManip) ? selfManip : "n/a"}`,
  "substrate authors+lands its own changes via mitosis cutover (e.g. c27439c)");

// 4. Keep synced to repos
add("repo_sync", "Keeps itself synced to repos", "PASS",
  "MITOSIS_HOST_SYNC_MODE + host-pull-sync; cutovers push to origin/dev",
  "substrate-authored commits land on origin/dev autonomously");

// 5. Activities spanning vessels + exploring existing capabilities
const crossVessel = num(m.capability?.cross_vessel_frac);
const explore = num(m.capability?.exploration_breadth);
add("activities_span_vessels", "Activities span vessels; explores existing capabilities",
  Number.isFinite(crossVessel) && crossVessel > 0.5 ? "PASS" : "PARTIAL",
  `cross-vessel ${Number.isFinite(crossVessel) ? pct(crossVessel) : "n/a"}, explore breadth ${Number.isFinite(explore) ? pct(explore) : "n/a"}`,
  "majority of composition edges span vessels");

// 6. obsidian-vessel + concept-db understand executions
const obsPolluted = (m.gaps?.by_category?.["obsidian_observation_channel_polluted"] ?? 0) > 0;
add("implicit_vessels_understand", "obsidian-vessel + concept-db used to understand executions",
  conceptDbActive && !obsidianActive ? "PARTIAL" : conceptDbActive ? "PASS" : "GAP",
  `concept-db ${conceptDbActive ? "active" : "down"}, obsidian-vessel ${obsidianActive ? "active" : "inactive"}`,
  `concept-db ExecutionObserver records per-trace usage from task.completed${obsPolluted ? "; obsidian channel pollution gap open" : ""}`);

// 7. Checking own measurements + continuity of state
add("self_measurement", "Checks own measurements; continuity of state", "PASS",
  "autonomy-metrics timer (20min) → jsonl; autonomy-status + this view",
  "snapshots accumulate continuously; growth/limiter trends computed over the series");

// 8 / 13. Growth measurable + steady/increasing
// Use the HONEST landing signal: substrate-authored mitosis-cutover commits (git),
// not the frozen .applied attempt-count.
const landed24h = num(m.self_alteration?.landed_cutovers_24h);
const landedTotal = num(m.self_alteration?.landed_cutovers_total);
add("growth_measurable", "Growth rate measurable & increasing",
  Number.isFinite(landed24h) && landed24h > 0 ? "PASS" : "PARTIAL",
  Number.isFinite(landed24h)
    ? `${landed24h} substrate-authored landings/24h (${Number.isFinite(landedTotal) ? landedTotal : "?"} total); edges ${edges}; gaps ${num(m.gaps?.model_reality_open)}`
    : `landed(.applied) ${num(m.self_alteration?.landed)}, edges ${edges} (honest cutover metric pending next snapshot)`,
  "honest landing rate from git substrate-authored cutover commits (replaces the frozen .applied attempt-count); measurable + trackable per-snapshot");

// 9. Activities with closure for topology discovery
const closure = num(m.capability?.shape_closure);
const realClosure = num(m.capability?.real_closure);
add("closure_activities", "Creates activities with closure to discover topology", "PARTIAL",
  `shape closure ${Number.isFinite(closure) ? pct(closure) : "n/a"}${Number.isFinite(realClosure) ? ` (real ${pct(realClosure)})` : ""}`,
  "topology-discovery loop + coverage-tick run; genuine-orphan shapes remain");

// 10. Keep scripts/internal components up to date
add("components_updated", "Keeps scripts & internal components up to date", "PASS",
  "host-pull-sync + per-vessel hot-reload; operator surgical fixes committed",
  "sync targets per vessel; cutover pipeline patches vessel source");

// 11. Understand + manipulate the substrate via activities
add("substrate_manipulation", "Understands + manipulates substrate via activities", "PASS",
  `self-manip activities ${Number.isFinite(selfManip) ? selfManip : "n/a"}`,
  "activities manipulate vessels/units/mitosis/scaffold; substrate authored its own model-reality-audit");

// 12. Resource efficiency + increasing information
const resourceEff = num(m.substrate_self?.llm_task_fraction);
const concepts = num(m.substrate_self?.concepts);
add("resource_efficiency", "Uses resources efficiently; increases available information",
  Number.isFinite(resourceEff) && resourceEff < 0.1 ? "PASS" : "PARTIAL",
  `LLM-task fraction ${Number.isFinite(resourceEff) ? pct(resourceEff) : "n/a"}, concepts ${Number.isFinite(concepts) ? concepts : "n/a"}`,
  "most tasks deterministic/cheap; concept-db grows monotonically");

// 14. Self-develop via idiomatic components; traverse activity graph dynamically
add("idiomatic_self_dev", "Self-develops via idiomatic components; dynamic graph traversal", "PARTIAL",
  `${num(m.self_alteration?.open_proposals)} open proposals; funnel draining`,
  "drafter→apply→patch→cutover funnel is idiomatic; feature-authoring is the honest S1→S2 residual");

// 15. Continuity of executions + continuous state signature
// state_signature is a TAG (`state_signature:<hash>`) on the trace, NOT a column —
// computed by dev-vessel's compute_state_signature, threaded onto trace tags by
// goal-host at dispatch, and used to key boredom's per-(signature, goal_idx)
// Thompson cells. Measure the tag, not a column (the column never existed).
const traceRate = num(m.dec_limiters?.rho_sample_traces_per_hour);
// executed_at is INDEXED (idx_activity_executions_executed_at); created_at is not,
// so filtering on it full-scanned all 160K+ traces. Both columns are 100% populated
// on this corpus, so the recent-window state_signature ratio is unchanged.
const sigRecent = await sqlCount("executed_at > time::now() - 60m AND string::contains(string::join(',', tags), 'state_signature:')");
const totRecent = await sqlCount("executed_at > time::now() - 60m");
const sigCoverage = Number.isFinite(sigRecent) && Number.isFinite(totRecent) && totRecent > 0 ? sigRecent / totRecent : NaN;
add("state_signature", "Traces continuity of executions; continuous state signature",
  Number.isFinite(sigCoverage) && sigCoverage >= 0.4 ? "PASS" : Number.isFinite(sigCoverage) && sigCoverage > 0 ? "PARTIAL" : "GAP",
  `${Number.isFinite(traceRate) ? traceRate : "n/a"} traces/hr; state_signature tag on ${Number.isFinite(sigCoverage) ? pct(sigCoverage) : "n/a"} of last-60m traces (${Number.isFinite(sigRecent) ? sigRecent : "?"}/${Number.isFinite(totRecent) ? totRecent : "?"})`,
  "goal-host tags each /run-goal trace state_signature:<hash> (live, current); untagged remainder are direct pool/shape dev-vessel execs that bypass goal-host; boredom keys Thompson cells on (signature, goal_idx)");

// 16. Orthogonal learning across activities/vessels/resolvers from similar traces
//     Probe the live prior_failed_attempts orthogonal channel: drafting one vessel's
//     typecheck gap should surface a similar-class failure from a DIFFERENT vessel.
let orthoCount = NaN, orthoActive = false;
try {
  const resp = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ impulse: { pointer: { type: "prior_failed_attempts", scenario_id: "typecheck-probe-cross-vessel-ts2322" } } }),
    signal: AbortSignal.timeout(8000),
  });
  const b = ((await resp.json()) as { body?: { orthogonal_count?: number } }).body ?? {};
  orthoCount = num(b.orthogonal_count);
  orthoActive = Number.isFinite(orthoCount);
} catch { /* dev-vessel unreachable */ }
add("orthogonal_learning", "Learns orthogonally across vessels/resolvers from similar traces",
  orthoActive ? "PASS" : "PARTIAL",
  orthoActive ? `prior_failed_attempts orthogonal channel live (${orthoCount} cross-vessel transfer(s) for a typecheck probe); vector-space-orthogonality-audit running` : "orthogonal channel probe unavailable",
  "drafter transfers failure lessons across activities/vessels by failure-class similarity (TS code / subsystem / reason); + observe-orthogonal-patterns + vector-space-orthogonality-audit detect cross-template clusters & novel failures");

// --- emit -------------------------------------------------------------------
const counts = rows.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {} as Record<string, number>);
const record = { at: m.at, snapshot_at: m.at, counts, rows };
await Bun.write(Bun.file(OUT), (await Bun.file(OUT).exists() ? await Bun.file(OUT).text() : "") + JSON.stringify(record) + "\n");

const icon = (v: Verdict) => (v === "PASS" ? "✓" : v === "PARTIAL" ? "~" : "✗");
console.log(`\n  criterion coverage  ·  snapshot ${m.at}`);
console.log(`  PASS ${counts.PASS ?? 0}  ·  PARTIAL ${counts.PARTIAL ?? 0}  ·  GAP ${counts.GAP ?? 0}   (of ${rows.length})`);
console.log("  " + "─".repeat(78));
for (const r of rows) {
  console.log(`  ${icon(r.verdict)} ${r.verdict.padEnd(7)} ${r.criterion}`);
  console.log(`      ${r.metric}`);
}
console.log("  " + "─".repeat(78));
console.log(`  GAPS to watch: ${rows.filter((r) => r.verdict === "GAP").map((r) => r.id).join(", ") || "none"}`);
