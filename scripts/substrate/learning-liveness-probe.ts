#!/usr/bin/env bun
/**
 * learning-liveness-probe — is the learning loop ALIVE, right now, with no operator?
 *
 * Learning has been demonstrated by hand many times: snapshot a posterior, dispatch
 * one goal, snapshot again, diff. It had never once been demonstrated WITHOUT an
 * operator, and that gap is not academic — "the substrate's credit channel is
 * one-directional" was published twice from this workstation, both times by reading
 * a field instead of intervening. The only continuously-available signals were the
 * ones that lie. This probe is that intervention, standing.
 *
 * ─── THE FOUR WAYS A NAIVE VERSION OF THIS IS WORSE THAN NOTHING ───────────────
 *
 * Each of these was measured on this substrate, and each would make the probe agree
 * with a broken loop:
 *
 * 1. DO NOT ASSERT AN AMOUNT. The update is graded, not binary:
 *    posterior-update.ts returns `{alphaDelta: y, betaDelta: 1 - y}` with a floor of
 *    0.5, so a free low-output success moves α by ~0.75 and β by ~0.25. Asserting
 *    "α += 1" FAILS ON A WORKING SYSTEM. Assert direction and the sample-count
 *    increment; never the magnitude.
 *
 * 2. DO NOT COMPARE AGAINST alphaBetaDelta. That field describes a POST to
 *    impulse_shape_activity_score, which nothing reads. Grading goes through
 *    POST /reach into variant_performance_metrics, which is what thompson_posterior
 *    returns. Neither number describes the other, BY DESIGN. A checker built on that
 *    comparison reports permanent divergence and is useless. This probe reads the
 *    STORE and treats the dispatch's self-report as commentary.
 *
 * 3. A MISSING ROW IS NOT A VIRGIN ARM. thompson_posterior used to answer an unknown
 *    id with a fabricated Beta(1,1) and loaded:true — and Beta(1,1) is the maximally
 *    explorable posterior, so a typo read as an enticing untried arm rather than an
 *    error. The shape now reports posterior_source; anything other than "stored" is
 *    UNKNOWN and must abort the probe rather than count as evidence.
 *
 * 4. IDENTICAL GOAL TEXT COALESCES. A coalesced dispatch runs nothing, moves nothing,
 *    and is indistinguishable from a dead learning channel. Every probe goal carries a
 *    nonce, and a run where the sample count did NOT increment is reported as
 *    inconclusive — never as failure, and never as success.
 *
 * Plus the one that decides which numbers you are even reading: a spoke MASKS
 * activity-api, so :18080 answers 000 locally and an empty read there looks exactly
 * like "nothing was recorded". The store endpoint is resolved from the RUNNING
 * goal-host process (/proc/<pid>/environ), not from the env file a live process may
 * predate.
 *
 * 5. DECAY MAKES THE RAW DELTA'S SIGN MEANINGLESS. Learned by this probe failing on
 *    itself: decay accumulated since the arm's last write is applied BEFORE the graded
 *    delta, so a single success after an idle gap moves α and β DOWN. Assert on
 *    success_count (a monotonic counter) and on the mean α/(α+β) (decay scales both
 *    parameters, so it cancels) — never on the raw deltas.
 *
 * Exit codes: 0 = learning verified alive · 2 = inconclusive · 3 = FAILED (gap filed).
 */

const CONTAINER = process.env["PROBE_CONTAINER"] ?? "substrate-live";
const GOAL_HOST = process.env["GOAL_HOST_ENDPOINT"] ?? "http://127.0.0.1:8210";
const DEV_VESSEL = process.env["DEV_VESSEL_ENDPOINT"] ?? "http://127.0.0.1:8090";
const API_KEY = process.env["METABOB_API_KEY"] ?? process.env["API_KEY"] ?? "";
const POLL_LIMIT = Number(process.env["PROBE_POLL_LIMIT"] ?? 24);
const POLL_INTERVAL_MS = Number(process.env["PROBE_POLL_INTERVAL_MS"] ?? 10_000);

type Posterior = { alpha: number; beta: number; n: number; succ: number; source: string };

function authHeaders(json = false): Record<string, string> {
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) };
}

/** ASK THE CONSUMER, NOT THE CONFIG. See the header note on masked units. */
async function resolveStore(): Promise<string> {
  const explicit = process.env["ACTIVITY_API_ENDPOINT"];
  if (explicit && explicit.trim().length > 0) return explicit.replace(/\/+$/, "");
  try {
    const proc = Bun.spawnSync([
      "docker", "exec", CONTAINER, "sh", "-c",
      'tr "\\0" "\\n" < /proc/$(pgrep -f "goal-host-vessel/src/index.ts" | head -1)/environ | grep "^ACTIVITY_API_ENDPOINT=" | cut -d= -f2-',
    ]);
    const v = new TextDecoder().decode(proc.stdout).trim().replace(/^"|"$/g, "");
    if (v.startsWith("http")) return v.replace(/\/+$/, "");
  } catch { /* fall through */ }
  return "http://127.0.0.1:8080";
}

async function readPosterior(store: string, armId: string): Promise<Posterior | null> {
  const res = await fetch(`${store}/v2/impulses/resolve`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ impulse: { pointer: { type: "thompson_posterior", activity_id: armId } } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const j = await res.json() as { content?: unknown };
  const parsed = typeof j?.content === "string" ? JSON.parse(j.content) : j?.content;
  const b = (parsed as { content?: Record<string, unknown> } | undefined)?.content;
  if (!b) return null;
  const alpha = b["alpha"], beta = b["beta"], n = b["sample_count"], succ = b["success_count"];
  if (typeof alpha !== "number" || typeof beta !== "number") return null;
  return {
    alpha, beta,
    n: typeof n === "number" ? n : 0,
    succ: typeof succ === "number" ? succ : 0,
    // Absent on a pre-2026-08-19 activity-api; treated as "stored" so the probe still
    // runs against an older hub rather than refusing everything. The `n > 0` check
    // below is the backstop for that case.
    source: typeof b["posterior_source"] === "string" ? b["posterior_source"] : "stored",
  };
}

async function publish(store: string, body: unknown): Promise<void> {
  try {
    await fetch(`${store}/v2/activities/observable`, {
      method: "POST", headers: authHeaders(true),
      body: JSON.stringify({ kind: "learning_liveness", body }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch { /* the verdict still goes to stdout and, on failure, to the gap store */ }
}

async function fileGap(title: string, body: string): Promise<void> {
  try {
    await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST", headers: authHeaders(true),
      body: JSON.stringify({ impulse: { type: "substrateGap_write", title, body, gapType: "correctness", severity: "high", source: "learning-liveness-probe" } }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) { console.error(`[probe] gap filing failed: ${(e as Error).message}`); }
}

const store = await resolveStore();
const ARM = process.env["PROBE_ARM"] ?? "satisfier:shellResult";
console.log(`[probe] store=${store} arm=${ARM}`);

const before = await readPosterior(store, ARM);
if (!before) { console.log("[probe] INCONCLUSIVE — posterior unreadable"); process.exit(2); }
// Condition 3: a prior is not a measurement.
if (before.source !== "stored" || before.n === 0) {
  console.log(`[probe] INCONCLUSIVE — posterior_source=${before.source} n=${before.n}; this is a PRIOR, not a measurement. Nothing can be concluded about credit flow from it.`);
  process.exit(2);
}
console.log(`[probe] BEFORE alpha=${before.alpha.toFixed(4)} beta=${before.beta.toFixed(4)} n=${before.n} succ=${before.succ}`);

// Condition 4: nonce, or the dispatch coalesces and measures nothing.
const nonce = `liveness-${Math.random().toString(16).slice(2, 8)}-${before.n}`;
const goal = `[${nonce}] Report how many shapes the discovery registry currently advertises. Answer with the single total number.`;
// Deterministically gradeable ON PURPOSE: goal-host re-queries the registry itself and
// compares (deterministic:verified-registry-count). No LLM judge decides this verdict,
// so the probe tests the CREDIT CHANNEL rather than a model's opinion of an answer.
const disp = await fetch(`${GOAL_HOST}/run-goal`, {
  method: "POST", headers: authHeaders(true),
  body: JSON.stringify({ goal, operator: "learning-liveness-probe" }),
  signal: AbortSignal.timeout(60_000),
}).then((r) => r.json()).catch(() => null) as { dispatchId?: string } | null;

if (!disp?.dispatchId) { console.log("[probe] INCONCLUSIVE — dispatch refused"); process.exit(2); }
console.log(`[probe] dispatched ${disp.dispatchId}`);

let reached: boolean | null = null;
let picked = "";
for (let i = 0; i < POLL_LIMIT; i++) {
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  const rec = await fetch(`${GOAL_HOST}/executions/${disp.dispatchId}`, { headers: authHeaders(), signal: AbortSignal.timeout(20_000) })
    .then((r) => r.json()).catch(() => null) as { status?: string; reached?: boolean | null; selectedTemplateId?: string } | null;
  if (rec && rec.status && rec.status !== "running") { reached = rec.reached ?? null; picked = rec.selectedTemplateId ?? ""; break; }
}
console.log(`[probe] terminalized reached=${reached} picked=${picked || "<none>"}`);

// MEASURE THE ARM THE WALK ACTUALLY PICKED, not the one this script assumed. Reading
// the wrong arm is the single easiest way to conclude "credit does not flow".
const measuredArm = picked && picked !== ARM ? picked : ARM;
const beforeMeasured = measuredArm === ARM ? before : null;
const after = await readPosterior(store, measuredArm);
if (!after) { console.log("[probe] INCONCLUSIVE — posterior unreadable after dispatch"); process.exit(2); }

if (!beforeMeasured) {
  console.log(`[probe] INCONCLUSIVE — the walk picked ${measuredArm}, which was not bracketed. Re-run with PROBE_ARM=${measuredArm}.`);
  await publish(store, { verdict: "inconclusive", reason: "picked-arm-not-bracketed", picked: measuredArm, nonce });
  process.exit(2);
}

const dN = after.n - beforeMeasured.n;
const dAlpha = after.alpha - beforeMeasured.alpha;
const dBeta = after.beta - beforeMeasured.beta;
console.log(`[probe] AFTER  alpha=${after.alpha.toFixed(4)} beta=${after.beta.toFixed(4)} n=${after.n} succ=${after.succ}`);
console.log(`[probe] DELTA  alpha=${dAlpha >= 0 ? "+" : ""}${dAlpha.toFixed(4)} beta=${dBeta >= 0 ? "+" : ""}${dBeta.toFixed(4)} n=${dN >= 0 ? "+" : ""}${dN}`);

const result = { arm: measuredArm, nonce, dispatchId: disp.dispatchId, reached, before: beforeMeasured, after, dAlpha, dBeta, dN };

// Condition 4 again, on the way out: no execution means nothing was measured. This is
// NOT a failure — reporting it as one would make the probe cry wolf on a busy substrate
// that simply picked a different arm.
if (dN === 0) {
  console.log("[probe] INCONCLUSIVE — sample_count did not move; the arm did not execute for this dispatch.");
  await publish(store, { ...result, verdict: "inconclusive", reason: "no-execution-on-arm" });
  process.exit(2);
}

// ─── CONDITION 5, WHICH THIS PROBE LEARNED BY FAILING ON ITSELF ───────────────
// DECAY MAKES THE RAW DELTA'S SIGN MEANINGLESS. The first live run of this probe
// reported FAILED on a working loop: a reached goal, success_count 2039 -> 2040, and
// alpha -1.4153 / beta -21.0123. Nothing was broken. `decayedThompsonCounts` applies
// ALL accumulated decay since the arm's last write before adding the graded delta, so
// after an idle gap a single success nets NEGATIVE on both parameters. Asserting
// "alpha must rise" fails on a healthy system exactly as surely as asserting a
// magnitude does — it is the same mistake one derivative down.
//
// The decay-immune signals are:
//   success_count — a monotonic counter; decay cannot touch it
//   the MEAN alpha/(alpha+beta) — decay scales both parameters, so it largely cancels
// On that same run the mean moved +0.001286, the correct direction, while both raw
// parameters fell. Assert on those two, never on the raw deltas.
const meanBefore = beforeMeasured.alpha / (beforeMeasured.alpha + beforeMeasured.beta);
const meanAfter = after.alpha / (after.alpha + after.beta);
const dMean = meanAfter - meanBefore;
const dSucc = after.succ - beforeMeasured.succ;
console.log(`[probe] MEAN   ${meanBefore.toFixed(6)} -> ${meanAfter.toFixed(6)} (${dMean >= 0 ? "+" : ""}${dMean.toFixed(6)})  successes ${dSucc >= 0 ? "+" : ""}${dSucc}`);
Object.assign(result, { meanBefore, meanAfter, dMean, dSucc });

// A graded execution must leave SOME trace in the posterior: either the success
// counter moved, or the mean did. Both flat after a recorded execution means the
// execution landed and the credit did not.
const movedAtAll = dSucc !== 0 || Math.abs(dMean) > 1e-9;
const directionOk = reached === true ? (dSucc > 0 || dMean > 0) : true;

if (movedAtAll && directionOk) {
  console.log(`[probe] ALIVE — ${dN} execution(s) recorded and the posterior followed (mean ${dMean >= 0 ? "+" : ""}${dMean.toFixed(6)}, successes ${dSucc >= 0 ? "+" : ""}${dSucc}).`);
  await publish(store, { ...result, verdict: "alive" });
  process.exit(0);
}

const why = !movedAtAll
  ? `the arm executed ${dN} time(s) and NEITHER success_count NOR the posterior mean moved — the execution was recorded and the credit was not`
  : `reached=${reached} but success_count moved ${dSucc} and the mean moved ${dMean.toFixed(6)} — a reached goal must credit one of them`;
console.log(`[probe] FAILED — ${why}`);
await publish(store, { ...result, verdict: "failed", reason: why });
await fileGap(
  "learning-liveness probe FAILED: an execution was recorded and the posterior did not follow",
  `Standing probe on arm ${measuredArm}, dispatch ${disp.dispatchId} (nonce ${nonce}).\n\n` +
  `BEFORE alpha=${beforeMeasured.alpha} beta=${beforeMeasured.beta} n=${beforeMeasured.n}\n` +
  `AFTER  alpha=${after.alpha} beta=${after.beta} n=${after.n}\n` +
  `DELTA  alpha=${dAlpha} beta=${dBeta} n=${dN}; reached=${reached}\n\n` +
  `${why}.\n\n` +
  `Read this as a claim about the CREDIT CHANNEL, not about the goal: the goal was chosen ` +
  `because it grades deterministically (deterministic:verified-registry-count re-queries ` +
  `the registry and compares), so no model opinion is involved. The posterior was read ` +
  `from the store via thompson_posterior with posterior_source="stored", not from the ` +
  `dispatch record's alphaBetaDelta — those describe two different tables by design.\n\n` +
  `Before chasing the walk, check the cheap explanations in order: (1) does the arm still ` +
  `have a posterior row, (2) did POST /reach actually run for this execution, (3) is this ` +
  `host reading the same activity-api the goal-host writes to (a spoke masks it).`,
);
process.exit(3);
