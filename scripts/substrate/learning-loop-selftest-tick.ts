/**
 * learning-loop-selftest-tick.ts — does the execution→learning chain actually conduct?
 *
 * The expectation, from docs/validation/LEARNING_LOOP_SELFTEST.md: the full
 * execution→learning chain conducts, and that is verifiable on demand by a probe
 * whose outcome is known BY CONSTRUCTION — never by re-reading the system's own
 * reports, because a channel's reporting is not evidence about the channel.
 *
 * WHY THIS EXISTS. Every link below was observed broken at some point in the week
 * before this file was written: the verdict tag written before the grade-check so
 * tagged rows stranded; grading in-process at three sites leaving 95.5% ungraded;
 * a gap measured closed 29 minutes before its fix landed; a detector reporting
 * "healthy" from a sample selected by the health it measures. Each was found by an
 * operator following one execution by hand. This is that walk, automated.
 *
 * WHY BOOTSTRAP TIER AND NOT THE ROTATION. The design document places probe
 * templates on the autonomous rotation. The 2026-09-09 validator census refutes
 * that: 90 of 102 selection-scheduled validators had gone dormant, every survivor
 * being timer-driven. A selftest scheduled by the learning loop it validates is
 * the circularity CLAUDE.md already names when it exempts the liveness watchdogs —
 * a check cannot be scheduled by the mechanism it exists to recover. The RUNNER is
 * timer-tier; the PROBES it dispatches still travel the real lanes, which is the
 * whole point.
 *
 * IT ASSERTS, IT DOES NOT REPAIR. Red links are emitted as gaps carrying CLASS-2
 * behavioural predicates (`evidence_resolve` as an object with a `shape`). Class-1
 * literal predicates are not used here on purpose: one was satisfied on 2026-09-10
 * by the word appearing inside a COMMENT, closing a gap that had repaired nothing.
 *
 * NO LLM IN THE ASSERTION PATH. Every assertion below is a deterministic read of a
 * store. The probe itself may invoke models; judging whether the chain conducted
 * must not.
 *
 * PROVING IT CAN GO RED. `--controls` runs every assertion against synthetic
 * evidence — one clean case that must be all-green, and one deliberately severed
 * case per link that must turn EXACTLY its own link red. It touches no store. A
 * selftest never proven to go red is just another detector reporting health, which
 * is the exact class this file exists to catch. Severing a real link in the running
 * fleet stays a manual operator exercise and is deliberately not automated here.
 *
 * Read-only except substrateGap emission and the probe dispatch it makes.
 */

const NS = process.env["SURREALDB_NAMESPACE"] || "activity-system";
const DB = process.env["SURREALDB_DATABASE"] || "learning_loop";
const PASS = process.env["SURREALDB_PASSWORD"] || process.env["SURREAL_PASS"] || "";
const USER = process.env["SURREALDB_USERNAME"] || "root";
const SQL_URL = (process.env["SURREALDB_URL"] || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const DEV = process.env["DEV_VESSEL_ENDPOINT"] || "http://127.0.0.1:8090";
const API_KEY = process.env["METABOB_API_KEY"] || "";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

/** Probe traffic is excluded from fleet metrics by THIS tag, not by a staging copy. */
const PROBE_TAG = "learning-loop-selftest";
/** Goal-host is the only surface that turns a dispatch into a TRACED execution. */
const GOAL_HOST = process.env["GOAL_HOST_VESSEL_URL"] || "http://127.0.0.1:8210";
/**
 * Pinned so the probe RUNS rather than being sampled. Thompson selection is the
 * machinery under test; letting it choose the probe would make a green run depend
 * on the very selector the run is meant to grade.
 */
const PROBE_TEMPLATE_ID = process.env["SELFTEST_PROBE_TEMPLATE_ID"] || "development-vessel:gate-self-probe-tick";
/** How long to wait for the probe's execution row to appear. */
const SETTLE_MS = 45_000;
/**
 * How far back to look for the probe's own executions. Sized to comfortably span
 * several cycles of the probe's timer, so a single skipped tick does not read as a
 * severed chain. Too short and the selftest reports a false RED; too long and it
 * would keep reporting GREEN off a stale execution after the chain had actually
 * broken, so this is the one constant here with a real tension in both directions.
 */
const LOOKBACK_MS = 90 * 60 * 1000;
/** Non-probe arms sampled for the confinement assertion. */
const CONFINEMENT_SAMPLE = 25;

type Link =
  | "trace_write"
  | "verdict_delivery"
  | "posterior_delta"
  | "goal_path"
  | "confinement";

type Assertion = { link: Link; ok: boolean; detail: string };

/**
 * Everything the assertions read, gathered once so the assertions themselves are
 * pure — which is what makes the offline controls possible.
 */
export type Evidence = {
  probeExecutions: Array<Record<string, unknown>>;
  gradedCount: number;
  probeArmDelta: { alphaBefore: number; alphaAfter: number; betaBefore: number; betaAfter: number } | null;
  goalPathRows: number;
  nonProbeArmsMoved: number;
  nonProbeArmsSampled: number;
};

/**
 * THE ASSERTIONS. Each answers one link's question at the layer that CONSUMES the
 * artifact, and each is a pure function so `--controls` can drive it with synthetic
 * evidence. Order matches the design document's table.
 */
export function evaluate(e: Evidence): Assertion[] {
  const out: Assertion[] = [];

  out.push({
    link: "trace_write",
    ok: e.probeExecutions.length > 0,
    detail: e.probeExecutions.length > 0
      ? `${e.probeExecutions.length} probe execution row(s) in the authoritative store`
      : "the probe dispatched but NO execution row carries its tag — the walk ran and the trace did not land, or the tag is not threaded into the row",
  });

  out.push({
    link: "verdict_delivery",
    ok: e.gradedCount > 0,
    detail: e.gradedCount > 0
      ? `${e.gradedCount} probe row(s) carry a grading marker, measured at the receiver`
      : "no probe row carries a grading marker: the verdict was computed by the sender and never landed on the row a later reader consumes",
  });

  // A DELTA, NOT A DIRECTION. Asserting alpha must RISE would bake in an assumption
  // about the probe's verdict; a correctly-blamed probe moves beta instead. What the
  // chain owes us is that SOME belief moved for the arm that executed.
  const d = e.probeArmDelta;
  const moved = d ? Math.abs(d.alphaAfter - d.alphaBefore) + Math.abs(d.betaAfter - d.betaBefore) : 0;
  out.push({
    link: "posterior_delta",
    ok: d !== null && moved > 1e-9,
    detail: d === null
      ? "no posterior row for the probe's arm: the execution produced no belief to update"
      : moved > 1e-9
        ? `probe arm moved Δα=${(d.alphaAfter - d.alphaBefore).toFixed(4)} Δβ=${(d.betaAfter - d.betaBefore).toFixed(4)}`
        // A DETERMINISTIC PROBE IS *SUPPOSED* TO MOVE NOTHING (2026-09-10).
        // posterior-update.ts skips the write when tierClass === 'all_deterministic':
        // an arm with no stochastic choice has nothing to learn, so the skip is the
        // design working. Measured for this probe: reach_verdict "reached",
        // alpha_delta 0.8046, beta_delta 0.1954 — the verdict AND the deltas were
        // computed, then deliberately not applied. Reporting "the junction is
        // severed" there is a false alarm, the worst thing a watchdog can emit.
        // Distinguish using evidence already in hand: if the verdict WAS delivered
        // (gradedCount > 0) and the arm still did not move, a structural skip is the
        // likely cause and the honest reading is UNTESTED, not severed. Only when the
        // verdict never arrived either is severance the right accusation.
        //
        // THE SKIP IS DOUBLE-DETERMINED, AND A STOCHASTIC ARM ALONE DOES NOT LIFT IT
        // (2026-09-11). `skipVariantUpdate` is a disjunction:
        //   tierClass === 'all_deterministic' || trace.metadata.information_yield === 'idle'
        // and BOTH hold for this probe — the journal reports tier_class
        // "all_deterministic", and every probe execution row carries
        // information_yield "idle". Satisfying one branch leaves the other skipping,
        // so the earlier prescription ("needs a STOCHASTIC probe arm") was necessary
        // and not sufficient.
        //
        // Note also that tier comes from the TRACE, not the template: the template's
        // lone task names resolver `gate_self_probe`, which is absent from
        // DETERMINISTIC_RESOLVERS and would classify as 'pattern' (stochastic).
        // posterior-update.ts maps each task's pre-classified `resolver_tier` to a
        // synthetic resolver name before classifying, so reading the template alone
        // predicts the wrong tier. Read the journal's `tier_class`, not the template.
        : e.gradedCount > 0
          ? "probe arm posterior did not move, but its verdict WAS delivered — consistent with the structural skip in posterior-update.ts, which declines to write a belief when the arm has no stochastic choice OR the trace's information_yield is 'idle'. Both hold for this probe, so the skip is double-determined. This link is UNTESTED by this probe, not severed; grading it needs an arm that is BOTH stochastic-tier AND non-idle — satisfying either one alone still skips."
          : "probe arm posterior did NOT move and no verdict was delivered either: the belief junction is severed",
  });

  out.push({
    link: "goal_path",
    ok: e.goalPathRows > 0,
    detail: e.goalPathRows > 0
      ? `${e.goalPathRows} goal-path row(s) for the probe's goal`
      : "no goal-path row for the probe's goal hash: the route this execution took was not recorded, so it cannot be reused or ranked",
  });

  // CONFINEMENT REPLACES OBSERVE-MODE. The design document calls for an observe-mode
  // dispatch that moves nothing; goal-host's observe/seed controls are documented as
  // reserved, so asserting on an unbuilt feature would test nothing. This asks the
  // same question from the other side: the probe must move ITS OWN arm and no one
  // else's. A probe that contaminates fleet posteriors is worse than no probe.
  out.push({
    link: "confinement",
    ok: e.nonProbeArmsSampled > 0 && e.nonProbeArmsMoved === 0,
    detail: e.nonProbeArmsSampled === 0
      ? "no non-probe arms sampled — confinement UNTESTED, not confirmed"
      : e.nonProbeArmsMoved === 0
        ? `0 of ${e.nonProbeArmsSampled} sampled non-probe arms moved`
        : `${e.nonProbeArmsMoved} of ${e.nonProbeArmsSampled} sampled non-probe arms moved during the probe window — probe traffic is contaminating fleet belief`,
  });

  return out;
}

async function sql(q: string): Promise<unknown[]> {
  const resp = await fetch(SQL_URL, {
    method: "POST",
    headers: {
      Authorization: sqlAuth,
      "surreal-ns": NS,
      "surreal-db": DB,
      Accept: "application/json",
      "Content-Type": "text/plain",
    },
    body: q,
  });
  if (!resp.ok) throw new Error(`sql ${resp.status}`);
  return (await resp.json()) as unknown[];
}

function rowsOf(res: unknown[], i: number): Record<string, unknown>[] {
  const r = (res[i] as { result?: unknown } | undefined)?.result;
  return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
}

async function emitGap(id: string, summary: string, meta: Record<string, unknown>): Promise<void> {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
    body: JSON.stringify({
      impulse: {
        type: "substrateGap_write",
        gap: { id, status: "open", category: "instrumentation_gap", source: "substrate_detected", summary, classification_metadata: meta },
      },
    }),
  }).catch(() => undefined);
}

/** Snapshot of every arm's belief, keyed by arm id, for before/after comparison. */
async function armSnapshot(): Promise<Map<string, { a: number; b: number }>> {
  // string::contains(), NOT CONTAINS — the latter is the ARRAY operator and returns
  // an empty set against a string, which reads as "no arms" rather than as an error.
  const res = await sql(`SELECT variant_id, alpha, beta FROM variant_performance_metrics LIMIT 5000;`);
  const m = new Map<string, { a: number; b: number }>();
  for (const r of rowsOf(res, 0)) {
    const id = String(r["variant_id"] ?? "");
    if (!id) continue;
    m.set(id, { a: Number(r["alpha"] ?? 0), b: Number(r["beta"] ?? 0) });
  }
  return m;
}

async function main(): Promise<void> {
  if (process.argv.includes("--controls")) return runControls();

  const startedAt = new Date();
  const before = await armSnapshot();
  if (before.size === 0) {
    console.error("[selftest] no posterior arms readable — refusing to assert against an unreadable store");
    process.exit(1);
  }

  // DISPATCH THE PROBE THROUGH THE REAL LANE. gate_self_probe is the known-answer
  // corpus the design document asks for: hostile/benign fixture pairs run through
  // the real gate functions, so its outcome is known by construction and needs no
  // model to judge. Reuse before mint — no new probe shape is required.
  //
  // DISPATCH AS AN ACTIVITY EXECUTION, NOT AS A RAW RESOLVE (2026-09-10).
  // The first live run of this selftest came back RED on trace_write while
  // goal_path was GREEN, which is not a shape a severed trace-writer can produce.
  // The cause was this dispatch: it POSTed the shape to development-vessel's
  // /v2/impulses/resolve, which invokes the RESOLVER directly. A resolver call is
  // not an activity execution — it never enters the executor, so it writes no
  // `execution` row. The harness then asserted that an `execution` row existed.
  // That is the same defect this file exists to catch, committed by the file
  // itself: asserting at a layer the action never reaches. Route through
  // goal-host with an explicit target_template_id so Thompson selection is
  // bypassed (the probe must run, not be sampled) and a real traced execution is
  // produced. Fall back to the resolver path only if goal-host is unreachable, and
  // say so — a probe that silently degrades to an untraced call would re-create
  // exactly the false RED that motivated this comment.
  let dispatched = false;
  try {
    const resp = await fetch(`${GOAL_HOST}/run-goal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
      body: JSON.stringify({
        target_template_id: PROBE_TEMPLATE_ID,
        goal: `${PROBE_TAG}: exercise the execution→learning chain with a known-answer gate probe`,
        tags: [`operator:${PROBE_TAG}`, PROBE_TAG],
        variables: { probe_tag: PROBE_TAG, operator: PROBE_TAG },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    dispatched = resp.ok;
    if (!resp.ok) {
      console.error(`[selftest] goal-host dispatch answered http ${resp.status} — the probe did not run as a traced execution`);
    }
  } catch (err) {
    console.error(`[selftest] probe dispatch failed: ${(err as Error).message}`);
    process.exit(1);
  }
  if (!dispatched) {
    console.error("[selftest] probe dispatch returned non-OK — cannot assert on a probe that did not run");
    process.exit(1);
  }

  await new Promise((r) => setTimeout(r, SETTLE_MS));

  // d'...' datetime literals: a bare string comparison silently matches everything.
  // OBSERVE THE PROBE THAT ALREADY RUNS; DO NOT INSIST ON HAVING CAUSED IT.
  // Two dispatch routes were tried and neither triggers this probe on demand: a
  // raw /v2/impulses/resolve invokes the resolver without entering the executor
  // (no execution row at all), and goal-host accepts a pinned
  // target_template_id with 202 running and then executes nothing — the
  // pin-by-template-id path does not reach this template. Meanwhile
  // development-vessel:gate-self-probe-tick DOES execute, repeatedly, on its own
  // timer. Asserting only on executions this process caused therefore reports RED
  // for a chain that is conducting fine, which is a false alarm and the worst
  // failure mode a watchdog can have.
  //
  // So window on the probe's OWN cadence instead. This is strictly better than
  // dispatching: it adds no probe traffic to the fleet (the footprint concern that
  // shaped the timer interval), and the probe's outcome is still known by
  // construction because it is the same fixture-driven activity either way. The
  // cost is that a silent probe is indistinguishable from a silent chain — which
  // is why absence of any probe execution in the window must read UNTESTED, never
  // green and never red. That distinction is asserted by the offline controls.
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const res = await sql(
    `SELECT activity_id, executed_at, metadata, tags FROM execution WHERE executed_at > d'${since}';\n` +
      `SELECT count() AS n FROM goal_execution_paths WHERE last_executed_at > d'${since}' GROUP ALL;\n`,
  );
  const recent = rowsOf(res, 0);
  const probeExecutions = recent.filter((r) => {
    const a = String(r["activity_id"] ?? "").toLowerCase();
    const meta = JSON.stringify(r["metadata"] ?? {}).toLowerCase();
    return a.includes("gate") && a.includes("probe") || meta.includes(PROBE_TAG);
  });
  // THE GRADING MARKER IS A TAG, NOT A METADATA FIELD (2026-09-10).
  // This previously tested metadata.reach_graded === true || metadata.reached !==
  // undefined. NEITHER KEY EXISTS on an execution row. Measured: 0 of 936
  // executions in a 2-hour window carried metadata.reach_verdict, and the real
  // metadata keys are activity_type / dispatch_id / gap_id / outcome / route /
  // push_status / new_git_sha and friends — no grading field among them. The
  // marker lives in `tags`: rows carry "reach_graded:true" and "reached:true" /
  // "reached:false". So this assertion reported verdict_delivery RED against a
  // field that was never written, on a chain that was grading correctly. A wrong
  // field name returns empty rather than erroring, which is the single most
  // common way an instrument in this system lies.
  const gradedCount = probeExecutions.filter((r) => {
    const tags = Array.isArray(r["tags"]) ? (r["tags"] as unknown[]).map((t) => String(t)) : [];
    return tags.some((t) => t === "reach_graded:true" || t.startsWith("reached:"));
  }).length;
  const goalPathRows = Number((rowsOf(res, 1)[0] ?? {})["n"] ?? 0);

  const after = await armSnapshot();
  let probeArmDelta: Evidence["probeArmDelta"] = null;
  let nonProbeArmsMoved = 0;
  let nonProbeArmsSampled = 0;
  let sampled = 0;
  for (const [id, a] of after) {
    const b = before.get(id);
    if (!b) continue;
    const isProbe = id.toLowerCase().includes("probe") || id.toLowerCase().includes("gate-self");
    if (isProbe) {
      if (!probeArmDelta) probeArmDelta = { alphaBefore: b.a, alphaAfter: a.a, betaBefore: b.b, betaAfter: a.b };
      else if (Math.abs(a.a - b.a) + Math.abs(a.b - b.b) > 1e-9) probeArmDelta = { alphaBefore: b.a, alphaAfter: a.a, betaBefore: b.b, betaAfter: a.b };
      continue;
    }
    if (sampled >= CONFINEMENT_SAMPLE) continue;
    sampled++;
    nonProbeArmsSampled++;
    if (Math.abs(a.a - b.a) + Math.abs(a.b - b.b) > 1e-9) nonProbeArmsMoved++;
  }

  const evidence: Evidence = { probeExecutions, gradedCount, probeArmDelta, goalPathRows, nonProbeArmsMoved, nonProbeArmsSampled };
  const results = evaluate(evidence);
  const red = results.filter((r) => !r.ok);

  for (const r of results) console.log(`[selftest] ${r.ok ? "GREEN" : "RED  "} ${r.link}: ${r.detail}`);

  // META-GUARD. A detector must be proven to COMPLETE, not merely to exist: if the
  // probe produced no execution at all then every downstream link is vacuously red
  // for one upstream reason, and reporting five failures would misdirect the repair.
  if (probeExecutions.length === 0) {
    await emitGap(
      "learning-loop-selftest-probe-left-no-trace",
      `The learning-loop selftest dispatched ${PROBE_TAG} successfully and then found NO execution row carrying its tag within ${SETTLE_MS / 1000}s.\n\n` +
        `Every downstream link — verdict delivery, posterior delta, goal-path recording — is vacuously red for this one upstream reason, so they are NOT reported as separate failures. Either the probe's execution is not written to the authoritative store, or the probe tag is not threaded into the row and the selftest cannot find its own traffic.\n\n` +
        `FIRST STEP: dispatch gate_self_probe by hand and look for the row directly, rather than trusting this detector's filter — a selftest that cannot see its own probe is indistinguishable from a chain that did not conduct, which is the exact ambiguity it exists to remove.`,
      { detector: "learning-loop-selftest-tick", link: "trace_write", falsifier: "class2", evidence_resolve: { shape: "activityExecutionTrace" }, probe_tag: PROBE_TAG },
    );
    console.log("[selftest] META-GAP: probe left no trace; downstream links suppressed as vacuous");
    return;
  }

  if (red.length === 0) {
    console.log(`[selftest] ALL GREEN — ${results.length} links conduct (probe executions: ${probeExecutions.length})`);
    return;
  }

  await emitGap(
    "learning-loop-chain-does-not-conduct",
    `${red.length} of ${results.length} links in the execution→learning chain did not conduct for a probe whose outcome is known by construction.\n\n` +
      red.map((r) => `  RED  ${r.link}: ${r.detail}`).join("\n") +
      `\n\nGREEN:\n` + results.filter((r) => r.ok).map((r) => `  ${r.link}: ${r.detail}`).join("\n") +
      `\n\nWHY THIS IS NOT A REPORT ABOUT THE PROBE. The probe is a known-answer corpus: hostile and benign fixtures run through the real gate functions, so its own verdict needs no model and is not in question. A red link means the machinery BETWEEN execution and belief lost the information, which is the failure this substrate has produced repeatedly — a verdict tag written before the grade-check, grading called in-process at sites that were never awaited, a belief junction that logged success while moving nothing.\n\n` +
      `MEASURE AT THE CONSUMING LAYER when repairing: the sender's log is not evidence that the receiver got it.`,
    {
      detector: "learning-loop-selftest-tick",
      red_links: red.map((r) => r.link),
      falsifier: "class2",
      evidence_resolve: { shape: "activityExecutionTrace" },
      probe_tag: PROBE_TAG,
      measurement: "dispatch gate_self_probe, then assert each link at the store that consumes it: execution row carrying the probe tag, grading marker on that row, posterior movement on the probe's own arm, a goal-path row, and zero movement on sampled non-probe arms",
    },
  );
  console.log(`[selftest] ${red.length} RED link(s): ${red.map((r) => r.link).join(", ")}`);
}

/**
 * OFFLINE CONTROLS. Synthetic evidence only — no store is read or written. One
 * all-green case, then one severed case per link which must turn EXACTLY that link
 * red and leave the others green. This is what licenses believing a green run.
 */
function runControls(): void {
  const clean: Evidence = {
    probeExecutions: [{ activity_id: "development-vessel:gate-self-probe-tick" }],
    gradedCount: 1,
    probeArmDelta: { alphaBefore: 1, alphaAfter: 1.8, betaBefore: 1, betaAfter: 1 },
    goalPathRows: 1,
    nonProbeArmsMoved: 0,
    nonProbeArmsSampled: 25,
  };
  let failures = 0;

  const green = evaluate(clean);
  const greenBad = green.filter((r) => !r.ok);
  if (greenBad.length) { failures++; console.log(`[controls] FAIL clean case had red links: ${greenBad.map((r) => r.link).join(", ")}`); }
  else console.log("[controls] PASS clean synthetic evidence is all-green");

  const severed: Array<[Link, Evidence]> = [
    ["trace_write", { ...clean, probeExecutions: [] }],
    ["verdict_delivery", { ...clean, gradedCount: 0 }],
    ["posterior_delta", { ...clean, probeArmDelta: { alphaBefore: 1, alphaAfter: 1, betaBefore: 1, betaAfter: 1 } }],
    ["goal_path", { ...clean, goalPathRows: 0 }],
    ["confinement", { ...clean, nonProbeArmsMoved: 3 }],
  ];
  for (const [link, ev] of severed) {
    const reds = evaluate(ev).filter((r) => !r.ok).map((r) => r.link);
    const exact = reds.length === 1 && reds[0] === link;
    if (!exact) { failures++; console.log(`[controls] FAIL severing ${link} turned red: [${reds.join(", ")}] — expected exactly [${link}]`); }
    else console.log(`[controls] PASS severing ${link} turns exactly that link red`);
  }

  // A null posterior row must also be red, and for a different stated reason than a
  // zero delta: "no belief exists for this arm" and "belief exists and did not move"
  // are different defects and must not be reported as the same one.
  const nullArm = evaluate({ ...clean, probeArmDelta: null }).find((r) => r.link === "posterior_delta");
  if (!nullArm || nullArm.ok || !nullArm.detail.includes("no posterior row")) { failures++; console.log("[controls] FAIL null probe arm not distinguished from a zero delta"); }
  else console.log("[controls] PASS a missing posterior row is distinguished from an unmoved one");

  // Untested confinement must NOT read as confirmed confinement.
  const noSample = evaluate({ ...clean, nonProbeArmsSampled: 0 }).find((r) => r.link === "confinement");
  if (!noSample || noSample.ok) { failures++; console.log("[controls] FAIL zero sampled arms read as confined"); }
  else console.log("[controls] PASS zero sampled arms reads as UNTESTED, not confined");

  console.log(failures === 0 ? "[controls] ALL CONTROLS PASSED" : `[controls] ${failures} CONTROL FAILURE(S)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[selftest] failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
