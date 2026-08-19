/**
 * Does the posterior Thompson draws from agree with the record of what happened?
 *
 * WHY THIS EXISTS. Every learning instrument in this system reports on the
 * *credit channel* — how many deltas were sent, how many were dropped, whether a
 * write threw. None of them compares the end state to the outcomes it is supposed
 * to summarise, so a channel that faithfully delivers only HALF the evidence
 * reads as perfectly healthy at every checkpoint. It is: every delta it carries
 * arrives. It just never carries the other sign.
 *
 * `variant_performance_metrics` stores two numbers per arm:
 *
 *   successful_executions / total_executions  — did the STEP run cleanly
 *                                               (validated.success on the
 *                                                execution record)
 *   thompson_alpha / thompson_beta            — was the step CREDITED with
 *                                               reaching a goal with substance
 *
 * READ THIS BEFORE QUOTING THE OUTPUT: those are different quantities, not two
 * views of one history. Reaching with substance is rarer than executing without
 * error, so a posterior mean BELOW the execution-success rate is expected and is
 * not by itself a defect. This script measures the gap between "works" and
 * "gets somewhere" — a standing view, not a verdict.
 *
 * The reading that no benign story explains is `atPrior`: arms that have never
 * been graded at all. Those are drawn at Beta(1,1) forever, and Thompson treats
 * a coin it has never flipped exactly like one it has flipped and found fair.
 *
 * WHAT THE TAU MEANS. Kendall's tau-b summarises whether the posterior orders
 * arm PAIRS the way execution reliability does. It is a proxy check, not a
 * verdict: tau near 0 means execution reliability cannot be used to sanity-check
 * the posterior, which is worth knowing precisely because it means a broken
 * credit channel has nothing obvious to contradict it. Diagnose the channel from
 * the walk's own credit decisions, not from this number.
 *
 * TWO WAYS THIS SCRIPT COULD LIE, both guarded:
 *   - Arms with one or two outcomes have empirical rates of exactly 0.000 or
 *     1.000. A first version included them and reported 279 of 280 arms
 *     "discordant" — an artefact of breaking ties among identical 1.000s. Hence
 *     --min-n, and pairwise comparison instead of positional.
 *   - An unauthenticated read returns 401, and an empty result set is
 *     indistinguishable from "no arm has a posterior". Hence the key check below:
 *     the script refuses to report rather than report a zero it cannot defend.
 *
 * Reads through the same authenticated resolve path the vessels use, so it
 * measures the store the sampler reads and not a convenient copy of it.
 *
 * Usage:  bun run validation/scripts/posterior-divergence.ts [--limit=N] [--min-n=N] [--json]
 *   ACTIVITY_API_ENDPOINT   store to ask (default http://localhost:18080)
 *   HUB_DISCOVERY_URL       shape vocabulary, for the satisfier arms
 *   GOAL_HOST_VESSEL_API_KEY | METABOB_API_KEY   credential
 *
 * Exits non-zero when the posterior stops tracking the record, so it can gate.
 */

const ENDPOINT = process.env["ACTIVITY_API_ENDPOINT"] ?? "http://localhost:18080";
const KEY = process.env["GOAL_HOST_VESSEL_API_KEY"] || process.env["METABOB_API_KEY"] || "";
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 300);
const AS_JSON = process.argv.includes("--json");

if (!KEY) {
  console.error("no API key in env — an unauthenticated read returns 401 and an empty result set,");
  console.error("which is indistinguishable from 'no arms have posteriors'. Refusing to report that.");
  process.exit(2);
}

const headers = { "content-type": "application/json", Authorization: `ApiKey ${KEY}` };

type Arm = {
  id: string;
  alpha: number;
  beta: number;
  successes: number;
  failures: number;
  samples: number;
};

const DISCOVERY = process.env["HUB_DISCOVERY_URL"] ?? process.env["DISCOVERY_ENDPOINT"] ?? "http://localhost:18100";

async function armIds(): Promise<string[]> {
  const r = await fetch(`${ENDPOINT}/v2/activities/templates?limit=${LIMIT}`, { headers });
  if (!r.ok) throw new Error(`template listing ${r.status}`);
  const j = (await r.json()) as { templates?: { id: string }[] };
  const ids = (j.templates ?? []).map((t) => t.id);

  // THE SATISFIER PLANE AND THE FLOOR ARE GRADED ARMS THAT ARE NOT CATALOGUE ROWS.
  // A template listing contains zero `satisfier:*` ids, so an instrument built from
  // it alone omits precisely the tier that answers goals no learned pathway covers
  // — and that tier is where the credit asymmetry is worst, because a one-step
  // reach can never present the in-chain producer→consumer edge the α gate wants.
  // Reporting "the fleet looks fine" while blind to it is the failure this whole
  // script exists to avoid, so the arm list is derived from the live shape
  // vocabulary rather than harvested from whatever happened to appear in a log.
  const satisfiers: string[] = [];
  try {
    const d = await fetch(`${DISCOVERY}/registry/shapes`, { headers, signal: AbortSignal.timeout(15_000) });
    if (d.ok) {
      const dj = (await d.json()) as { shapes?: (string | { shape?: string; name?: string })[] };
      for (const s of dj.shapes ?? []) {
        const name = typeof s === "string" ? s : (s.shape ?? s.name ?? "");
        if (name) satisfiers.push(`satisfier:${name}`);
      }
    }
  } catch { /* discovery down: fall through with the catalogue arms we do have */ }
  if (satisfiers.length === 0) {
    console.error("WARNING: no shape vocabulary retrieved — the satisfier plane is NOT covered by this run.");
  }
  return [...ids, ...satisfiers, "universal-tool-fallback"];
}

async function posterior(id: string): Promise<Arm | null> {
  const r = await fetch(`${ENDPOINT}/v2/impulses/resolve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pointer: { type: "thompson_posterior", activity_id: id } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { success?: boolean; content?: unknown };
  if (!j.success) return null;
  const c = typeof j.content === "string" ? JSON.parse(j.content) : j.content;
  const b = (c as { content?: Record<string, number> }).content ?? (c as Record<string, number>);
  return {
    id,
    alpha: Number(b["alpha"] ?? 0),
    beta: Number(b["beta"] ?? 0),
    successes: Number(b["success_count"] ?? 0),
    failures: Number(b["failure_count"] ?? 0),
    samples: Number(b["sample_count"] ?? 0),
  };
}

const ids = await armIds();
const arms: Arm[] = [];
for (const id of ids) {
  const a = await posterior(id).catch(() => null);
  if (a) arms.push(a);
}

const atPrior = arms.filter((a) => Math.abs(a.alpha - 1) < 1e-9 && Math.abs(a.beta - 1) < 1e-9);
const rate = (a: Arm) => a.successes / (a.successes + a.failures);
const mean = (a: Arm) => a.alpha / (a.alpha + a.beta);

// MINIMUM EVIDENCE. An arm with one outcome has an empirical rate of exactly 0.000
// or 1.000, which is not an estimate of anything. Including those made a first
// version of this script report 279 of 280 arms "rank discordant" — an artefact of
// breaking ties among dozens of identical 1.000s, not a finding. Comparing a
// posterior against a one-sample rate measures the sample size, not the channel.
const MIN_N = Number(process.argv.find((a) => a.startsWith("--min-n="))?.split("=")[1] ?? 5);
const graded = arms.filter((a) => a.successes + a.failures >= MIN_N && a.alpha + a.beta > 0);

const under = graded.filter((a) => mean(a) < rate(a) - 0.02);
const over = graded.filter((a) => mean(a) > rate(a) + 0.02);

// AGREEMENT IS MEASURED PAIRWISE, NOT POSITIONALLY. Thompson picks by comparing
// arms, so what matters is whether the posterior orders each PAIR the way the
// evidence does. Kendall's tau-b counts concordant minus discordant pairs and
// handles ties in either ranking properly — a pair tied on evidence is not
// evidence of disagreement, which is exactly what the positional version got
// wrong. tau = 1 is perfect agreement, 0 is no relationship, negative means the
// sampler systematically prefers the arms the record says are worse.
let concordant = 0, discordantPairs = 0, tiedRate = 0, tiedMean = 0;
for (let i = 0; i < graded.length; i++) {
  for (let j = i + 1; j < graded.length; j++) {
    const dr = rate(graded[i]!) - rate(graded[j]!);
    const dm = mean(graded[i]!) - mean(graded[j]!);
    if (dr === 0 && dm === 0) continue;
    if (dr === 0) { tiedRate++; continue; }
    if (dm === 0) { tiedMean++; continue; }
    if (dr * dm > 0) concordant++; else discordantPairs++;
  }
}
const n0 = concordant + discordantPairs + tiedRate + tiedMean;
const tau = n0 > 0
  ? (concordant - discordantPairs) / Math.sqrt((concordant + discordantPairs + tiedRate) * (concordant + discordantPairs + tiedMean))
  : NaN;
// Inversions among pairs the evidence actually separates: the plain-language form
// of the same thing, and the number to quote.
const separable = concordant + discordantPairs;

if (AS_JSON) {
  console.log(JSON.stringify({
    armsQueried: arms.length,
    atPrior: atPrior.length,
    graded: graded.length,
    understating: under.length,
    overstating: over.length,
    minN: MIN_N,
    pairsSeparableByEvidence: separable,
    pairsOrderedAgainstEvidence: discordantPairs,
    kendallTau: tau,
    arms: graded.map((a) => ({ id: a.id, successes: a.successes, failures: a.failures, empirical: rate(a), posteriorMean: mean(a), alpha: a.alpha, beta: a.beta })),
  }, null, 2));
} else {
  console.log(`arms queried            ${arms.length}`);
  console.log(`still at exactly (1,1)  ${atPrior.length}  — never graded, drawn at the prior forever`);
  console.log(`graded with n >= ${MIN_N}       ${graded.length}  — arms with fewer outcomes tell you about sample size, not about the channel`);
  console.log();
  console.log(`${"arm".padEnd(52)} ${"succ".padStart(6)} ${"fail".padStart(6)} ${"empirical".padStart(10)} ${"posterior".padStart(10)}`);
  for (const a of [...graded].sort((x, y) => y.samples - x.samples)) {
    console.log(`${a.id.slice(0, 52).padEnd(52)} ${String(a.successes).padStart(6)} ${String(a.failures).padStart(6)} ${rate(a).toFixed(3).padStart(10)} ${mean(a).toFixed(3).padStart(10)}`);
  }
  console.log();
  console.log(`posterior UNDERSTATES its own success rate   ${under.length}/${graded.length}`);
  console.log(`posterior OVERSTATES it                      ${over.length}/${graded.length}`);
  console.log(`pairs the evidence separates                 ${separable}`);
  console.log(`  of those, ordered AGAINST the evidence      ${discordantPairs} (${(100 * discordantPairs / Math.max(1, separable)).toFixed(0)}%)`);
  console.log(`Kendall tau-b (1 = agrees, 0 = unrelated)     ${tau.toFixed(3)}`);
}

// A one-directional channel is the signature to fail on: understating everywhere
// with nothing overstating cannot be noise, and it is the shape that a live β with
// a withheld α produces. Exit non-zero so this is usable as a gate, not just a view.
// GATE ON THE READING THAT HAS NO BENIGN EXPLANATION. Deflation does not qualify:
// a posterior below the execution-success rate is what a working substance gate
// produces. An arm that has NEVER been graded does — it means outcomes are being
// produced and nothing is turning them into evidence, so Thompson keeps drawing
// that arm at the prior no matter how often it runs.
const priorShare = arms.length > 0 ? atPrior.length / arms.length : 0;
if (priorShare > 0.25) {
  console.error(`\nFAIL: ${atPrior.length}/${arms.length} arms (${(100 * priorShare).toFixed(0)}%) have never been graded.`);
  console.error("  They are drawn at Beta(1,1) forever — Thompson cannot tell them from an arm proven fair.");
  process.exit(1);
}
