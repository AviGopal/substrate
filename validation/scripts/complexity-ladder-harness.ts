#!/usr/bin/env bun
/**
 * complexity-ladder-harness.ts — does the substrate reach arbitrary UNIQUE goals
 * as the number of data transformations grows?
 *
 * Complexity is defined here because the corpus refuses to settle it (FOUNDATION
 * offers four grains and states outright that a trajectory and an activity are
 * the same object at different granularity):
 *
 *   ONE TRANSFORMATION = one producer step in the walk that emits an output
 *   shape absent from its input shapes.
 *
 * Counted from `path_activities`, EXCLUDING `satisfier:*` pseudo-ids — a
 * satisfier is a shape being asserted into the pool, not a producer running.
 * Counting satisfiers inflates every rung uniformly and would make rung 1 look
 * like rung 3. There is NO walk-length column anywhere in the fleet (five
 * vessels' `src` scanned; one derived report field only), so each rung carries
 * its own expected count and is validated by CONTENT BINDING against an
 * externally measured ground truth rather than by a stored number.
 *
 * UNIQUENESS is by construction: every goal embeds a run nonce, so no goal here
 * has a prior `goal_hash`. That is what makes the floor arm a floor measurement
 * — reach "regardless of priors" (CLAUDE.md) — and not a memorization test.
 *
 * WHAT THIS DOES NOT MEASURE, said up front so nobody infers it:
 *   - Shape-pathway reuse. `pathwayReusePicks` is a log line plus a
 *     process-local Map, and `tierOf` has no reuse branch, so `walk_tier` can
 *     only ever record Tier-1/2 COMMAND reuse. An absent `learned_pathway` in
 *     the ceiling arm is NOT evidence that reuse did not fire.
 *   - Anything about code-edit goals. These are data-transformation goals; the
 *     edit pipeline is a separate plane with its own standing failures.
 *
 * Usage:
 *   bun run validation/scripts/complexity-ladder-harness.ts
 *        [--rungs 1,2,3,4] [--repeat] [--out <path>] [--poll-timeout-s 900]
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};
const has = (n: string) => args.includes(`--${n}`);

const GOAL_HOST = arg("endpoint", process.env.GOAL_HOST_ENDPOINT ?? "http://localhost:18210")!;
const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://localhost:18090";
const DISCOVERY = process.env.DISCOVERY_ENDPOINT ?? "http://localhost:18100";
// THE TRACE STORE IS NOT NECESSARILY LOCAL.
//
// This substrate is a SPOKE (`spoke-cfda39e7`), and `roles.spoke` in
// vessels.inventory.json does not include the `api` role — `activity-api` is
// MASKED here by design and the trace store lives on the hub. Defaulting to
// localhost:18080 makes every goal-path read come back empty, which reads
// identically to "no pathway was recorded" and is how a whole ceiling
// measurement gets reported as a null result. Confirm which copy the instrument
// talks to; `~/.metabob/config.json` names the hub.
const TRACE_STORE = process.env.METABOB_ENDPOINT ?? "http://syzygy.host:18080";
const POLL_TIMEOUT_S = Number(arg("poll-timeout-s", "900"));
const RUNGS = (arg("rungs", "1,2,3,4") ?? "").split(",").map(Number).filter(Boolean);
const OUT = arg("out", `validation/results/${new Date().toISOString().slice(0, 10)}-complexity-ladder.json`)!;

function apiKey(): string {
  try {
    const c = JSON.parse(readFileSync(`${process.env.HOME}/.metabob/config.json`, "utf8")) as Record<string, unknown>;
    return (c.apiKey as string) ?? ((c.metabob as Record<string, unknown>)?.apiKey as string) ?? "";
  } catch { return ""; }
}
const API_KEY = process.env.METABOB_API_KEY ?? apiKey();

// A nonce, not a timestamp: two runs in the same second must not collide, and a
// human reading a goal must be able to tell two runs apart at a glance.
const NONCE = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Ground truth — measured HERE, from the primary source, never from the graded
// party's own answer.
//
// The first version of this read discovery's `GET /shapes` and got **4**. That
// endpoint returns discovery's OWN advertised shapes; the registry holds 386.
// A ground truth that is wrong by two orders of magnitude would have marked
// every correct answer incorrect, so each source below names the route that
// actually holds the number.
// ---------------------------------------------------------------------------
interface GroundTruth {
  registryShapeCount: number | null;   // GET /registry/stats -> totalShapes
  registryVesselCount: number | null;  // GET /registry/stats -> totalVessels
  openGapCount: number | null;
  errors: string[];
}

async function measureGroundTruth(): Promise<GroundTruth> {
  const errors: string[] = [];
  const g: GroundTruth = { registryShapeCount: null, registryVesselCount: null, openGapCount: null, errors };
  try {
    const r = await fetch(`${DISCOVERY}/registry/stats`, { signal: AbortSignal.timeout(15_000) });
    const j = (await r.json()) as { totalShapes?: number; totalVessels?: number };
    g.registryShapeCount = typeof j.totalShapes === "number" ? j.totalShapes : null;
    g.registryVesselCount = typeof j.totalVessels === "number" ? j.totalVessels : null;
  } catch (e) { errors.push(`registry/stats: ${(e as Error).message}`); }
  try {
    const r = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "substrateGap", status: "open", limit: 5000 } }),
      signal: AbortSignal.timeout(90_000),
    });
    const j = (await r.json()) as { body?: { gaps?: unknown[] } };
    g.openGapCount = Array.isArray(j.body?.gaps) ? j.body!.gaps!.length : null;
  } catch (e) { errors.push(`substrateGap: ${(e as Error).message}`); }
  return g;
}

// ---------------------------------------------------------------------------
// The ladder. Each rung states its transformation count AND why the count
// cannot collapse — kept beside the goal so a reader can attack the argument.
// ---------------------------------------------------------------------------
interface Rung {
  rung: number;
  id: string;
  goal: string;
  transformations: number;
  nonCollapsible: string;
  expect: (g: GroundTruth) => { check: string; values: string[] } | null;
  sideEffect?: { titleContains: string };
}

function ladder(): Rung[] {
  const all: Rung[] = [
    {
      rung: 1,
      id: `r1-${NONCE}`,
      goal: `How many distinct impulse shapes does the discovery registry currently advertise? Report the number. Reference ${NONCE}.`,
      transformations: 1,
      nonCollapsible:
        "BASELINE, and deliberately collapsible — one producer whose output shape is the target shape. " +
        "Reported for calibration only; a reach rate quoted over this rung alone is a gamed metric.",
      expect: (g) => g.registryShapeCount == null ? null
        : { check: "the registry shape count appears in the answer", values: [String(g.registryShapeCount)] },
    },
    {
      rung: 2,
      id: `r2-${NONCE}`,
      goal: `Count how many distinct impulse shapes the discovery registry advertises, then record that count as a memory note titled exactly "ladder-${NONCE}-r2". Reference ${NONCE}.`,
      transformations: 2,
      nonCollapsible:
        "The count does not exist as a stored value in the note shape, and no single activity's input " +
        "shapes cover both the registry and the note store. The derive step's output must be consumed " +
        "by the write step. Verified by the note EXISTING and CARRYING the number.",
      expect: (g) => g.registryShapeCount == null ? null
        : { check: "the persisted note carries the registry shape count", values: [String(g.registryShapeCount)] },
      sideEffect: { titleContains: `ladder-${NONCE}-r2` },
    },
    {
      rung: 3,
      id: `r3-${NONCE}`,
      goal: `Compare two live counts: how many distinct impulse shapes the discovery registry advertises, and how many substrate gaps are currently open. Report both numbers and state which is larger. Reference ${NONCE}.`,
      transformations: 3,
      nonCollapsible:
        "Two distinct producers emit two distinct shapes from two different vessels (discovery and " +
        "development-vessel); a third step consumes both to form the comparison. First rung where the " +
        "walk must backward-chain over more than one unmet input.",
      expect: (g) => (g.registryShapeCount == null || g.openGapCount == null) ? null
        : {
            check: "both counts appear AND the larger is named correctly",
            values: [String(g.registryShapeCount), String(g.openGapCount),
                     g.openGapCount > g.registryShapeCount ? "gap" : "shape"],
          },
    },
    {
      rung: 4,
      id: `r4-${NONCE}`,
      goal: `Work out how many distinct impulse shapes the discovery registry advertises and how many substrate gaps are currently open, compute the ratio of the larger to the smaller, and record both counts together with that ratio as a memory note titled exactly "ladder-${NONCE}-r4". Reference ${NONCE}.`,
      transformations: 4,
      nonCollapsible:
        "Rung 3's two producers and comparison, plus a derived quantity (the ratio) that neither " +
        "producer emits, plus a persist step into a third vessel's store. Four output shapes, none in " +
        "any single activity's input set. Verified by reading the note back.",
      expect: (g) => (g.registryShapeCount == null || g.openGapCount == null) ? null
        : { check: "the persisted note carries both counts",
            values: [String(g.registryShapeCount), String(g.openGapCount)] },
      sideEffect: { titleContains: `ladder-${NONCE}-r4` },
    },
  ];
  return all.filter((r) => RUNGS.includes(r.rung));
}

// Each must-fail goal is unsatisfiable for a DIFFERENT reason, because a battery
// that fails one way only tests one guard.
function controls(): Rung[] {
  return [
    {
      rung: 0, id: `ctl-nonexistent-field-${NONCE}`,
      goal: `Report the current value of the quantum_flux_coefficient field on the discovery registry. Reference ${NONCE}.`,
      transformations: 0,
      nonCollapsible: "MUST-FAIL: names a field that does not exist. A number here is confabulation.",
      expect: () => null,
    },
    {
      rung: 0, id: `ctl-false-premise-${NONCE}`,
      goal: `Of the forty-seven federation relays this substrate peers with, report which one has the highest round-trip latency. Reference ${NONCE}.`,
      transformations: 0,
      nonCollapsible: "MUST-FAIL: false premise — there are not forty-seven relays. Reaching requires accepting the premise.",
      expect: () => null,
    },
    {
      rung: 0, id: `ctl-out-of-capability-${NONCE}`,
      goal: `Report the average air temperature in Reykjavik over the past week. Reference ${NONCE}.`,
      transformations: 0,
      nonCollapsible: "MUST-FAIL: genuinely outside the substrate's data. Tests abstention versus invention.",
      expect: () => null,
    },
  ];
}

// ---------------------------------------------------------------------------
interface Result {
  id: string; rung: number; arm: "floor" | "ceiling"; goal: string;
  dispatchId: string | null; coalesced: boolean;
  reached: boolean | null; status: string | null; executionId: string | null;
  trigger: string | null; operator: string | null;
  latencyMs: number | null;
  producerSteps: number | null; pathActivities: string[] | null;
  pathSignature: string | null; walkTier: string | null;
  totalExecutions: number | null; thompsonAlpha: number | null; thompsonBeta: number | null;
  answerText: string;
  correct: boolean | null; correctnessNote: string;
  sideEffectFound: boolean | null;
  error: string | null;
}

async function dispatch(goal: string) {
  try {
    const r = await fetch(`${GOAL_HOST}/run-goal`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, operator: "complexity-ladder-harness", async: true }),
      signal: AbortSignal.timeout(60_000),
    });
    const j = (await r.json()) as { dispatchId?: string; coalesced?: boolean };
    return { dispatchId: j.dispatchId ?? null, coalesced: j.coalesced === true, err: undefined as string | undefined };
  } catch (e) { return { dispatchId: null, coalesced: false, err: (e as Error).message }; }
}

/**
 * Poll via the `activeDispatches` shape.
 *
 * goal-host serves exactly four HTTP routes (health, run-goal, resolve,
 * v2/impulses/resolve) — there is no `GET /dispatch/:id`. The dispatch record
 * comes back through the shape plane instead, and the window is a ROLLING ~50
 * under live traffic, so a slow poll can lose a finished dispatch off the end.
 * Poll often enough that a completed record is caught before it ages out.
 */
async function poll(dispatchId: string): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + POLL_TIMEOUT_S * 1000;
  let lastSeen: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${GOAL_HOST}/resolve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointer: { type: "activeDispatches", limit: 200 } }),
        signal: AbortSignal.timeout(30_000),
      });
      const j = (await r.json()) as { body?: { dispatches?: Array<Record<string, unknown>> } };
      const rec = (j.body?.dispatches ?? []).find((d) => d.dispatchId === dispatchId);
      if (rec) {
        lastSeen = rec;
        if (rec.status && rec.status !== "running") return rec;
      } else if (lastSeen) {
        // It was there and is now gone: it aged out of the rolling window after
        // finishing. Returning the last snapshot is wrong (it says "running"),
        // so say what happened instead of guessing an outcome.
        return { ...lastSeen, status: "AGED_OUT_OF_WINDOW" };
      }
    } catch { /* a poll failure is not a dispatch failure */ }
    await new Promise((res) => setTimeout(res, 8_000));
  }
  return lastSeen;
}

/** Look the walk's recorded pathway up by exact goal text. */
async function fetchGoalPath(goalText: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${TRACE_STORE}/v2/goal-paths?goal_text=${encodeURIComponent(goalText)}&limit=5`;
    const r = await fetch(url, {
      headers: API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {},
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { paths?: Array<Record<string, unknown>> };
    return j.paths?.[0] ?? null;
  } catch { return null; }
}

/**
 * Count TRANSFORMATIONS, not steps. `satisfier:<shape>` is a shape asserted into
 * the pool, not a producer that ran.
 */
function countProducerSteps(pathActivities: unknown) {
  if (!Array.isArray(pathActivities)) return { n: null as number | null, list: null as string[] | null };
  const list = pathActivities.map(String);
  return { n: list.filter((a) => !a.startsWith("satisfier:")).length, list };
}

function extractAnswer(rec: Record<string, unknown>): string {
  // Concatenate rather than guess a key: "no answer" and "answer under an
  // unexpected key" are different failures and must not look alike.
  const parts: string[] = [];
  for (const k of ["answerBody", "answer", "result", "output", "reachReason", "summary"]) {
    const v = rec[k];
    if (typeof v === "string") parts.push(v);
    else if (v && typeof v === "object") parts.push(JSON.stringify(v));
  }
  return parts.join("\n");
}

async function verifySideEffect(titleContains: string, expectValues: string[]) {
  try {
    const r = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "memoryNote", title_prefix: titleContains, limit: 20 } }),
      signal: AbortSignal.timeout(30_000),
    });
    const j = (await r.json()) as { body?: { notes?: Array<Record<string, unknown>> } };
    const notes = j.body?.notes ?? [];
    if (notes.length === 0) return { found: false, carries: false };
    const blob = JSON.stringify(notes);
    return { found: true, carries: expectValues.every((v) => containsNumber(blob, v)) };
  } catch { return { found: false, carries: false }; }
}

/**
 * Hand-read the numeric answer.
 *
 * A bare substring test for "386" hits a UUID digit run, a timestamp, and a byte
 * count. Require whole-number boundaries.
 */
function containsNumber(haystack: string, value: string): boolean {
  return new RegExp(`(?<!\\d)${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`).test(haystack);
}

/**
 * Dispatch every goal of an arm FIRST, then poll them together.
 *
 * Sequential runs cost ~40 minutes per dispatch and, worse, spread the arm's
 * reads of the live pool across hours — so rung 3 and rung 4 would be scored
 * against an `openGapCount` measured before either ran, while the substrate's
 * own autonomous traffic moves it underneath them. Dispatching together makes
 * the single ground-truth snapshot coherent and shrinks exposure to the rolling
 * activeDispatches window. Goal texts within an arm are distinct, so there is no
 * coalescing risk; the ceiling arm is deliberately run AFTER its floor twin.
 */
async function runArm(rungs: Rung[], arm: "floor" | "ceiling", g: GroundTruth): Promise<Result[]> {
  const started = rungs.map((r) => ({ r, t0: Date.now(), p: dispatch(r.goal) }));
  const dispatched = await Promise.all(started.map(async (s) => ({ ...s, d: await s.p })));
  for (const s of dispatched) console.log(`  dispatched ${s.r.id} -> ${s.d.dispatchId?.slice(0, 8) ?? "FAILED"}${s.d.coalesced ? " (COALESCED)" : ""}`);
  return Promise.all(dispatched.map((s) => scoreOne(s.r, arm, g, s.d, s.t0)));
}

async function scoreOne(
  r: Rung, arm: "floor" | "ceiling", g: GroundTruth,
  d: { dispatchId: string | null; coalesced: boolean; err?: string }, t0: number,
): Promise<Result> {
  const out: Result = {
    id: r.id, rung: r.rung, arm, goal: r.goal, dispatchId: null, coalesced: false,
    reached: null, status: null, executionId: null, trigger: null, operator: null,
    latencyMs: null, producerSteps: null, pathActivities: null, pathSignature: null,
    walkTier: null, totalExecutions: null, thompsonAlpha: null, thompsonBeta: null,
    answerText: "", correct: null, correctnessNote: "", sideEffectFound: null, error: null,
  };
  out.dispatchId = d.dispatchId; out.coalesced = d.coalesced;
  if (d.err) { out.error = d.err; return out; }
  if (!d.dispatchId) { out.error = "no dispatchId returned"; return out; }
  // A coalesced CEILING arm is the point (same goal_hash). A coalesced FLOOR arm
  // means two goal texts collided and the reading is void, not merely noisy.
  if (d.coalesced && arm === "floor") out.error = "COALESCED on the floor arm — goal text collided; reading is void";

  const rec = await poll(d.dispatchId);
  out.latencyMs = Date.now() - t0;
  if (!rec) { out.error = `${out.error ? out.error + "; " : ""}never appeared in activeDispatches within ${POLL_TIMEOUT_S}s`; return out; }

  out.status = typeof rec.status === "string" ? rec.status : null;
  out.reached = typeof rec.reached === "boolean" ? rec.reached : null;
  out.executionId = typeof rec.executionId === "string" ? rec.executionId : null;
  out.trigger = typeof rec.trigger === "string" ? rec.trigger : null;
  out.operator = typeof rec.operator === "string" ? rec.operator : null;
  out.answerText = extractAnswer(rec);

  const gp = await fetchGoalPath(r.goal);
  if (gp) {
    const steps = countProducerSteps(gp.path_activities);
    out.producerSteps = steps.n; out.pathActivities = steps.list;
    out.pathSignature = typeof gp.path_signature === "string" ? gp.path_signature : null;
    out.walkTier = typeof gp.walk_tier === "string" ? gp.walk_tier : null;
    out.totalExecutions = typeof gp.total_executions === "number" ? gp.total_executions : null;
    out.thompsonAlpha = typeof gp.thompson_alpha === "number" ? gp.thompson_alpha : null;
    out.thompsonBeta = typeof gp.thompson_beta === "number" ? gp.thompson_beta : null;
  }

  // EXTERNAL ORACLE — deliberately a separate column from `reached`, because
  // `reached` is produced by the graded party.
  const exp = r.expect(g);
  if (r.rung === 0) {
    out.correct = out.reached === false;
    out.correctnessNote = out.reached === false
      ? "abstained, as required"
      : "REACHED A MUST-FAIL GOAL — confabulation; every positive reach in this run is suspect";
  } else if (!exp) {
    out.correctnessNote = "ground truth unavailable — correctness UNDECIDABLE, not false";
  } else if (r.sideEffect) {
    const numeric = exp.values.filter((v) => /^\d+$/.test(v));
    const se = await verifySideEffect(r.sideEffect.titleContains, numeric);
    out.sideEffectFound = se.found;
    out.correct = se.found && se.carries;
    out.correctnessNote = !se.found
      ? `no memory note titled "${r.sideEffect.titleContains}" exists — the durable effect the goal asked for was never produced`
      : se.carries ? `note exists and carries ${numeric.join(", ")}`
      : `note exists but does NOT carry ${numeric.join(", ")} — persisted, wrong content`;
  } else {
    const numeric = exp.values.filter((v) => /^\d+$/.test(v));
    const words = exp.values.filter((v) => !/^\d+$/.test(v));
    const ok = numeric.every((v) => containsNumber(out.answerText, v))
      && words.every((v) => out.answerText.toLowerCase().includes(v.toLowerCase()));
    out.correct = ok;
    out.correctnessNote = ok ? `answer carries ${exp.values.join(", ")}` : `answer missing one of ${exp.values.join(", ")} (${exp.check})`;
  }
  return out;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`complexity-ladder  nonce=${NONCE}  goal-host=${GOAL_HOST}`);
  const g = await measureGroundTruth();
  console.log(`ground truth (measured independently): ${JSON.stringify(g)}`);
  if (g.errors.length) console.log(`  ⚠ ${g.errors.length} ground-truth source unreadable — affected rungs report UNDECIDABLE, never false`);

  const rungs = ladder();
  const ctls = controls();
  const results: Result[] = [];

  // Controls and floor rungs go out together: they are all distinct texts, and a
  // single simultaneous dispatch is what makes one ground-truth snapshot honest
  // for all of them.
  console.log(`\n=== CONTROLS (${ctls.length} must-fail) + FLOOR ARM (${rungs.length} unique goals) — dispatched together ===`);
  const firstArm = await runArm([...ctls, ...rungs], "floor", g);
  results.push(...firstArm);
  for (const r of firstArm.filter((x) => x.rung === 0)) {
    console.log(`  ${r.correct ? "OK  " : "FAIL"} ${r.id}  reached=${r.reached}  ${r.correctnessNote}`);
  }
  for (const r of firstArm.filter((x) => x.rung > 0)) {
    const rg = rungs.find((x) => x.id === r.id)!;
    console.log(`  rung ${rg.rung} (expect ${rg.transformations})  reached=${r.reached}  status=${r.status}  steps=${r.producerSteps}  correct=${r.correct}`);
    console.log(`        ${r.correctnessNote}${r.error ? `  [${r.error}]` : ""}`);
  }

  if (has("repeat")) {
    console.log(`\n=== CEILING ARM — identical goal text, same goal_hash ===`);
    console.log(`  Detects Tier-1/2 COMMAND reuse ONLY. tierOf has no reuse branch, so an`);
    console.log(`  absent learned_pathway is not evidence that shape-pathway reuse did not fire.`);
    console.log(`  Rungs 3-4 read a pool the substrate's own traffic moves, so ceiling`);
    console.log(`  CORRECTNESS there is soft; reach, tier and signature are the hard readings.`);
    const ceil = await runArm(rungs, "ceiling", g);
    results.push(...ceil);
    for (const r of ceil) {
      const f = results.find((x) => x.id === r.id && x.arm === "floor");
      const sp = f?.latencyMs && r.latencyMs ? (f.latencyMs / r.latencyMs).toFixed(2) : "n/a";
      const sig = f?.pathSignature && r.pathSignature ? String(f.pathSignature === r.pathSignature) : "n/a";
      console.log(`  rung ${r.rung}  reached=${r.reached}  walk_tier=${r.walkTier}  total_exec=${r.totalExecutions}  latency x${sp}  same_signature=${sig}`);
    }
  }

  const cres = results.filter((r) => r.rung === 0);
  const floor = results.filter((r) => r.rung > 0 && r.arm === "floor");
  const honest = cres.filter((r) => r.correct === true).length;
  console.log(`\n=== SUMMARY ===`);
  console.log(`  falsifiability: ${honest}/${cres.length} must-fail goals abstained`);
  if (honest < cres.length) {
    console.log(`  ⚠ THE REACH NUMBERS BELOW ARE NOT TRUSTWORTHY — a suite that reaches a`);
    console.log(`    must-fail goal cannot distinguish reaching from confabulating.`);
  }
  for (const r of floor) {
    const rg = rungs.find((x) => x.id === r.id)!;
    console.log(`  rung ${r.rung}: expected ${rg.transformations} transformations, walked ${r.producerSteps ?? "?"} — reached=${r.reached} correct=${r.correct}`);
  }
  const hollow = floor.filter((r) => r.reached === true && r.correct === false).length;
  const silent = floor.filter((r) => r.reached === false && r.correct === true).length;
  const undec = floor.filter((r) => r.correct === null).length;
  console.log(`  HOLLOW (reached, wrong): ${hollow}   SILENT (right, not reached): ${silent}   UNDECIDABLE: ${undec}`);
  console.log(`  gaming gap = ${floor.filter((r) => r.reached).length} self-reported reaches − ${floor.filter((r) => r.correct).length} externally correct`);

  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    nonce: NONCE, at: new Date().toISOString(), goalHost: GOAL_HOST, groundTruth: g,
    definition: "one transformation = one non-satisfier producer step in path_activities emitting a shape absent from its inputs",
    caveats: [
      "shape-pathway reuse is undetectable from durable state (tierOf has no reuse branch)",
      "no walk-length column exists in the fleet; producerSteps is derived from path_activities",
      "data-transformation goals only — says nothing about the code-edit plane",
      "activeDispatches is a rolling ~50 window under live traffic; AGED_OUT_OF_WINDOW is a distinct outcome from a timeout",
    ],
    rungs: rungs.map((r) => ({ rung: r.rung, id: r.id, transformations: r.transformations, nonCollapsible: r.nonCollapsible })),
    controls: ctls.map((c) => ({ id: c.id, why: c.nonCollapsible })),
    results,
  }, null, 2));
  console.log(`\nwrote ${OUT}`);
}

await main();
