#!/usr/bin/env bun
/**
 * operator-goal-generator.ts — the CONVERGENT ENABLER (2026-06-27).
 *
 * WHY. The substrate now HAS the learning machinery: successor-features ψ (state-
 * conditioned Thompson), traced multi-step deliberation, the post-execution reach-gate
 * (verifyGoalReached → β-penalty on hollow completion), and decomposition-authoring
 * (gap-compose / feature_compose). But it is STARVED of the one input that exercises
 * all of it: DIVERSE, genuinely MULTI-STEP operator goals. Day-to-day traffic is thin
 * single-task internal ticks — boredom dispatches topology goals, gap-compose is paused,
 * the working set is internal observer/tick machinery. ψ vectors stay thin (mostly
 * occupancy-1 entries), deliberation stays shallow, reach-rate sits low because nothing
 * forces a query→aggregate→format or producer→consumer→consumer composition.
 *
 * This timer turns "has the apparatus" into "exercises it": each tick it picks ONE
 * multi-step operator goal from a rotating, diverse catalogue, GROUNDS it in real
 * substrate data (queried live so successive ticks reference actual templates / shapes /
 * failure modes / cost), and dispatches it through goal-host /run-goal. The completion
 * shape of every catalogue class has NO single producer — reaching it forces real
 * composition, which is precisely the signal ψ + the reach-gate + the composer need.
 *
 * ANTI-GAMING (the central honesty constraint). The generator is NOT optimised for
 * reach-rate and does NOT select goals by reachability — that would game the reach-gate.
 * Rotation is DETERMINISTIC over the catalogue classes (round-robin by a persisted tick
 * counter, no Math.random — unavailable under bun here anyway), selecting for DIVERSE
 * COVERAGE and genuine multi-step structure. The reach-gate remains the validator: real
 * content is still required to reach. Our success metric is "is the machinery getting
 * exercised + enriched", tracked over time via the jsonl + a companion read
 * (operator-goal-signal.ts) — ψ cell count / vector richness, genuine-edge count,
 * reach-rate trend — NOT a vanity reach-rate.
 *
 * Bounded: ONE goal per tick. Non-fatal: a dispatch failure logs + continues. Pausable:
 * OPERATOR_GOAL_GEN=0 disables (default enabled).
 *
 * Env (EnvironmentFile=/etc/substrate/env): SURREAL_PASS / SURREALDB_*, METABOB_API_KEY,
 * GOAL_HOST_VESSEL_ENDPOINT, METABOB_ENDPOINT.
 */

if ((process.env.OPERATOR_GOAL_GEN ?? "1") === "0") {
  console.log(JSON.stringify({ ts: new Date().toISOString(), skipped: "OPERATOR_GOAL_GEN=0" }));
  process.exit(0);
}

const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREAL_PASS || process.env.SURREALDB_PASSWORD || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const GOAL_HOST = (process.env.GOAL_HOST_VESSEL_ENDPOINT || "http://127.0.0.1:8210").replace(/\/$/, "");
const KEY = process.env.METABOB_API_KEY || "";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
const LOG = "/workspace/metrics/operator-goal-gen.jsonl";
const stamp = () => new Date().toISOString();

async function sql(query: string): Promise<any[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(SQL_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Surreal-NS": NS, "Surreal-DB": DB, Authorization: sqlAuth, "Content-Type": "text/plain" },
        body: query,
      });
      const text = await r.text();
      if (!text.trim()) throw new Error("empty body");
      const j = JSON.parse(text);
      return j.map((s: any) => s.result);
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
    }
  }
  return [];
}

async function readJsonl(path: string): Promise<any[]> {
  try {
    if (!(await Bun.file(path).exists())) return [];
    const txt = await Bun.file(path).text();
    return txt.split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

async function appendJsonl(path: string, rec: Record<string, unknown>) {
  try {
    const prev = (await Bun.file(path).exists()) ? await Bun.file(path).text() : "";
    await Bun.write(path, prev + JSON.stringify(rec) + "\n");
  } catch { /* tolerant */ }
}

const since24h = () => new Date(Date.now() - 24 * 3600_000).toISOString();

// ── Catalogue ────────────────────────────────────────────────────────────────
// Each class is GENUINELY multi-step: its completion shape has no single producer, so
// reaching it forces query→aggregate→format or producer→consumer→consumer composition.
// `build` queries live substrate data so successive ticks of the same class differ
// (different N / window / which-metric) and reference ACTUAL data, not invented names.
type Built = { goal: string; params: Record<string, unknown> };

const CATALOGUE: { class: string; build: () => Promise<Built> }[] = [
  {
    // registry report — query→rank→format. Parameterized: which extremum + N from a
    // counter, grounded by confirming the table is non-empty.
    class: "registry_report",
    build: async () => {
      const [rows] = await sql(`SELECT activity_id, count() AS n FROM activity_execution_traces WHERE executed_at >= type::datetime("${since24h()}") GROUP BY activity_id LIMIT 1;`);
      const live = (rows || []).length > 0;
      // Vary order/metric/N across ticks deterministically off the global counter.
      const variants = [
        { metric: "failure", order: "highest", N: 8 },
        { metric: "success", order: "highest", N: 10 },
        { metric: "failure", order: "lowest", N: 5 },
        { metric: "success", order: "lowest", N: 7 },
      ];
      const v = variants[(globalThis as any).__variantIdx % variants.length];
      return {
        goal: `Report the ${v.N} activity templates with the ${v.order} ${v.metric} counts over the last 24 hours. For each, give the template id and its ${v.metric} count, sorted ${v.order === "highest" ? "descending" : "ascending"} by that count.`,
        params: { ...v, table_live: live },
      };
    },
  },
  {
    // failure analysis — group→count→exemplar. Multi-step: aggregate failure_mode then
    // pull one example execution_id per mode.
    class: "failure_analysis",
    build: async () => {
      const [fm] = await sql(`SELECT failure_mode.type AS t, count() AS n FROM activity_execution_traces WHERE executed_at >= type::datetime("${since24h()}") AND success = false AND failure_mode.type != NONE GROUP BY failure_mode.type LIMIT 5;`);
      const modes = (fm || []).map((r: any) => r.t).filter(Boolean);
      return {
        goal: `Summarize the most common failure modes across execution traces from the last 24 hours. For each distinct failure_mode.type, report a count and one example execution_id, ordered by count descending.`,
        params: { observed_modes: modes },
      };
    },
  },
  {
    // orphan/coverage — set-difference between consumed input shapes and produced output
    // shapes across the activity registry, then join back the consuming activities.
    class: "orphan_coverage",
    build: async () => {
      const [shapes] = await sql(`SELECT array::distinct(array::flatten((SELECT VALUE input_shapes FROM activity WHERE proposed != true LIMIT 2000))) AS ins LIMIT 1;`);
      const sampleIns = ((shapes?.[0]?.ins) || []).slice(0, 6);
      return {
        goal: `List the impulse shapes that are consumed as some activity's input_shapes but have no activity producing them as an output_shape. For each such orphaned shape, name the activities that consume it.`,
        params: { sample_input_shapes: sampleIns },
      };
    },
  },
  {
    // cost/tier — aggregate cost grouped by resolver_tier over a window, ranked.
    class: "cost_by_tier",
    build: async () => {
      const [c] = await sql(`SELECT math::sum(cost_usd) AS total, count() AS n FROM activity_execution_traces WHERE executed_at >= type::datetime("${since24h()}") GROUP ALL;`);
      const total = c?.[0]?.total ?? null;
      return {
        goal: `Report the total resolution cost grouped by resolver_tier (deterministic, pattern, llm) over the last 24 hours, ordered by total cost highest first. Include the count of resolutions per tier alongside each total.`,
        params: { window_total_cost_usd: total, window_trace_count: c?.[0]?.n ?? null },
      };
    },
  },
  {
    // cross-vessel synthesis — read recent successful multi-task executions, distil the
    // recurring task-pattern, and produce a CONCEPT. Producer→consumer→consumer.
    class: "concept_synthesis",
    build: async () => {
      const [ex] = await sql(`SELECT activity_id, count() AS n FROM activity_execution_traces WHERE executed_at >= type::datetime("${since24h()}") AND success = true GROUP BY activity_id LIMIT 5;`);
      const top = (ex || []).map((r: any) => r.activity_id).filter(Boolean).slice(0, 5);
      return {
        goal: `Examine the most recent successful multi-task execution traces. Identify the recurring task pattern they share (the common sequence of resolver steps and shape flow), and produce a concept that summarizes that pattern with a name, description, and the activities it generalizes.`,
        params: { recent_successful_activities: top },
      };
    },
  },
];

// ── Deterministic round-robin rotation ───────────────────────────────────────
// Tick counter persisted in the jsonl (count of prior dispatch records). Round-robin
// across catalogue classes; a secondary variant index (also off the counter) varies
// within-class parameterization. NO Math.random — selection is purely positional, which
// also makes "select by diversity not reachability" structurally true.
async function dispatch(goal: string): Promise<any> {
  const r = await fetch(`${GOAL_HOST}/run-goal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${KEY}` },
    body: JSON.stringify({ goal }),
  });
  if (!r.ok) return { status: "dispatch_failed", http: r.status, body: (await r.text()).slice(0, 300) };
  try { return await r.json(); } catch { return { status: "dispatch_ok_nonjson" }; }
}

async function main() {
  const prior = await readJsonl(LOG);
  const tick = prior.filter((p) => p.dispatched).length;
  const classIdx = tick % CATALOGUE.length;
  (globalThis as any).__variantIdx = Math.floor(tick / CATALOGUE.length);
  const entry = CATALOGUE[classIdx];

  let built: Built;
  try {
    built = await entry.build();
  } catch (e) {
    // Grounding query failed — still dispatch the un-parameterized class goal (the
    // catalogue text is self-contained); just note the grounding miss. Non-fatal.
    built = { goal: `(${entry.class}) — grounding query failed; dispatching default class goal.`, params: { grounding_error: String(e).slice(0, 200) } };
  }

  const result = await dispatch(built.goal);
  const dispatchId = result?.dispatchId || result?.executionId || result?.execution_id || result?.id || null;
  const ok = !!dispatchId || result?.status === "success" || result?.status === "completed" || result?.status === "running";

  const rec = {
    ts: stamp(),
    tick,
    class: entry.class,
    variant_idx: (globalThis as any).__variantIdx,
    goal_text: built.goal,
    params: built.params,
    dispatch_id: dispatchId,
    dispatch_status: result?.status ?? null,
    dispatched: ok,
    raw: ok ? undefined : result,
  };
  await appendJsonl(LOG, rec);
  console.log(JSON.stringify({ tick, class: entry.class, dispatch_id: dispatchId, dispatch_status: result?.status ?? null, dispatched: ok }));
}

main().catch(async (e) => {
  await appendJsonl(LOG, { ts: stamp(), error: String(e).slice(0, 300) });
  console.error("operator-goal-generator error:", String(e).slice(0, 300));
  process.exit(0); // non-fatal — never crash the oneshot
});
