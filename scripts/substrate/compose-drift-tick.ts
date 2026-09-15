/**
 * compose-drift-tick.ts — a detector for the COMPOSER-DEGRADES-ITSELF class.
 *
 * The substrate modifies the component that performs all modification, and
 * nothing executes the result. Measured 2026-09-09: `feature-compose.ts` took 41
 * autonomous commits across 09-06/07, and its anchor-failure rate went 3.3% (on
 * 09-04, a zero-commit day that serves as the natural control) to 34.4% on 09-08.
 * One confirmed cause was `f0cfb91`, a ONE-LINE inverted boolean that disabled
 * the blind-edit anchor repair for two days and passed typecheck, the semantic
 * gate and mitosis cutover on the way in. `bac7d00` repaired it.
 *
 * NOTHING REPORTED ANY OF THAT. The compose pipeline logs its own blind spot on
 * every run against an untested file: "every gate below this point READS the
 * diff; only a test RUNS it. A FAVORABLE verdict here means the change was
 * reviewed, never executed." A regression in the authoring lane therefore
 * accumulates in exactly the capability needed to detect and repair it, and the
 * only reason the two-day outage above was ever found was an operator counting
 * rows by hand.
 *
 * WHY THIS RUNS FROM SYSTEMD AND NOT FROM THE POOL. Same circularity CLAUDE.md
 * names when it exempts the liveness watchdogs from the script-retention rule:
 * "a check cannot be scheduled by the mechanism it exists to recover." A detector
 * for the authoring lane cannot be authored and scheduled by the authoring lane.
 * This is the bootstrap tier, and it is the stated exception rather than a
 * silent carve-out. Sibling precedent: validator-liveness-tick.ts.
 *
 * IT MEASURES, IT DOES NOT SET POLICY. The expected failure rate of the composer
 * is derived from THE COMPOSER'S OWN RECENT HISTORY — the median of its trailing
 * complete days — not from a threshold chosen here. Degradation is asserted only
 * when the most recent complete day exceeds that self-derived baseline by both a
 * relative and an absolute margin AND survives a two-proportion z-test, so a
 * quiet day or ordinary variance cannot trip it. Choosing an acceptable failure
 * rate is an operator decision; observing that the composer stopped performing
 * at the level it was already performing at is not.
 *
 * THE INSTRUMENT IS NAMED, BECAUSE THE OBVIOUS VARIANT DISAGREES. The population
 * is `feature_compose` executions; the numerator is `apply_failed AND
 * ops_applied == 0` — a HARD anchor failure where nothing was applied. Dropping
 * the `ops_applied` clause reports 43.3% for 09-08 where this instrument reports
 * 34.4%: two defensible metrics, very different numbers. Six operator metrics
 * for this same question were discarded for measuring the wrong population, so
 * the predicate is stated in the gap it emits and must stay stated.
 *
 * DAY-SCALE WINDOWS ONLY. A 2-hour slice of this series read 24.6% while the
 * containing 184-execution window read 16.8%, and a false "the repair evaporated"
 * conclusion was built on that slice before being retracted. Sub-day windows are
 * noise on this metric.
 *
 * META-GUARD (a detector must be proven to COMPLETE, not merely to exist): if the
 * composer ran at volume but no day had enough samples to evaluate, this emits a
 * gap about ITSELF, because a detector that silently checks nothing is the exact
 * class it exists to catch.
 *
 * Strictly read-only except substrateGap emission.
 */

const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREALDB_PASSWORD || process.env.SURREAL_PASS || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const DEV = process.env.DEV_VESSEL_ENDPOINT || process.env.DEVELOPMENT_VESSEL_URL || "http://127.0.0.1:8090";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

/** Trailing window used to reconstruct the composer's own recent baseline. */
const HISTORY_DAYS = 10;
/** A day needs this many compose executions before its rate means anything. */
const MIN_DAY_SAMPLES = 40;
/** ...and this many trailing complete days before a baseline is assertable. */
const MIN_BASELINE_DAYS = 3;
/** Degradation must be at least this multiple of the self-derived baseline... */
const DEGRADED_MULTIPLE = 1.6;
/** ...and at least this many percentage points above it, so a low baseline
 *  cannot make ordinary noise look like a multiple. */
const MIN_ABSOLUTE_MARGIN = 0.08;
/** Two-proportion z above which the difference is not plausibly sampling noise. */
const MIN_Z = 2.5;

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

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * One-sample z for "this day's rate exceeds the reference rate p0".
 *
 * DELIBERATELY NOT A POOLED TWO-PROPORTION TEST. Pooling the baseline's raw
 * counts folds any previously-degraded day into the reference, so the detector
 * normalises to its own bad history and goes blind exactly after an episode —
 * the failure mode it exists to catch. Measured while writing this file: against
 * pooled counts (contaminated by 09-08 at 34.4%) 09-09 scored z=1.84 and would
 * have been waved through; against the robust median baseline it scores far
 * higher, which matches the operator finding that the composer never returned to
 * its early-September level after bac7d00 repaired the acute regression.
 *
 * p0 is the MEDIAN of the composer's own complete days, so a single catastrophic
 * day cannot raise the bar it will later be judged against.
 */
function zScore(hits: number, n: number, p0: number): number {
  if (n === 0 || p0 <= 0 || p0 >= 1) return 0;
  const se = Math.sqrt((p0 * (1 - p0)) / n);
  return se > 0 ? (hits / n - p0) / se : 0;
}

async function emitGap(id: string, summary: string, meta: Record<string, unknown>): Promise<void> {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      impulse: {
        type: "substrateGap_write",
        gap: {
          id,
          status: "open",
          category: "instrumentation_gap",
          source: "substrate_detected",
          summary,
          classification_metadata: meta,
        },
      },
    }),
  }).catch(() => undefined);
}

type Day = { day: string; n: number; hard: number; rate: number };

async function main(): Promise<void> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
  // Pull rows rather than GROUP BY so the day bucketing and the predicate are
  // both visible here, in the same file as the comment that defines them.
  const res = await sql(
    `SELECT executed_at, metadata FROM execution ` +
      `WHERE activity_id CONTAINS 'feature_compose' AND executed_at > d'${since}';\n`,
  );
  const rows = rowsOf(res, 0);

  const byDay = new Map<string, { n: number; hard: number }>();
  for (const row of rows) {
    const ts = String(row["executed_at"] ?? "");
    const day = ts.slice(0, 10);
    if (day.length !== 10) continue;
    const meta = (row["metadata"] ?? {}) as Record<string, unknown>;
    const bucket = byDay.get(day) ?? { n: 0, hard: 0 };
    bucket.n++;
    // THE NAMED INSTRUMENT. apply_failed alone is a different, looser metric.
    if (meta["apply_failed"] === true && Number(meta["ops_applied"] ?? -1) === 0) bucket.hard++;
    byDay.set(day, bucket);
  }

  const today = new Date().toISOString().slice(0, 10);
  const days: Day[] = [...byDay.entries()]
    .map(([day, b]) => ({ day, n: b.n, hard: b.hard, rate: b.n > 0 ? b.hard / b.n : 0 }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // TODAY IS EXCLUDED: a partial day is not a complete one, and treating an
  // in-progress window as a data point is how a false regression gets declared.
  const complete = days.filter((d) => d.day !== today && d.n >= MIN_DAY_SAMPLES);

  if (complete.length < MIN_BASELINE_DAYS + 1) {
    const volume = rows.length;
    if (volume >= MIN_DAY_SAMPLES * (MIN_BASELINE_DAYS + 1)) {
      await emitGap(
        "compose-drift-detector-checked-nothing",
        `compose-drift-tick saw ${volume} feature_compose execution(s) in the last ${HISTORY_DAYS} days but could evaluate only ${complete.length} complete day(s) with at least ${MIN_DAY_SAMPLES} samples, which is fewer than the ${MIN_BASELINE_DAYS + 1} needed to assert a baseline. ` +
          `A detector that checks nothing is indistinguishable from a detector that finds nothing, which is the class this detector exists to catch. ` +
          `Either execution rows stopped carrying the metadata this instrument reads (apply_failed / ops_applied), or the activity id for composition changed and 'feature_compose' no longer matches it.`,
        { detector: "compose-drift-tick", evaluated_days: complete.length, rows: volume, falsifier: "class2", evidence_resolve: { shape: "activityExecutionTrace" } },
      );
      console.log(`[compose-drift] META-GAP: ${volume} rows, only ${complete.length} evaluable day(s)`);
      return;
    }
    console.log(`[compose-drift] insufficient history — ${complete.length} complete day(s), ${volume} row(s); abstaining`);
    return;
  }

  const latest = complete[complete.length - 1]!;
  const baselineDays = complete.slice(0, -1).slice(-HISTORY_DAYS);
  const baseRate = median(baselineDays.map((d) => d.rate));
  const baseN = baselineDays.reduce((s, d) => s + d.n, 0);
  const baseHard = baselineDays.reduce((s, d) => s + d.hard, 0);
  const z = zScore(latest.hard, latest.n, baseRate);

  const degraded =
    latest.rate >= baseRate * DEGRADED_MULTIPLE &&
    latest.rate - baseRate >= MIN_ABSOLUTE_MARGIN &&
    z >= MIN_Z;

  const series = complete
    .map((d) => `  ${d.day}  n=${String(d.n).padStart(4)}  hard=${String(d.hard).padStart(4)}  ${(d.rate * 100).toFixed(1)}%`)
    .join("\n");

  if (!degraded) {
    console.log(
      `[compose-drift] OK — ${latest.day} ${(latest.rate * 100).toFixed(1)}% vs self-baseline ${(baseRate * 100).toFixed(1)}% ` +
        `(median of ${baselineDays.length} day(s), z=${z.toFixed(2)}) over ${complete.length} evaluable day(s)`,
    );
    return;
  }

  await emitGap(
    "compose-anchor-failure-rate-degraded",
    `The composer's hard anchor-failure rate on ${latest.day} was ${(latest.rate * 100).toFixed(1)}% (${latest.hard}/${latest.n}), against a self-derived baseline of ${(baseRate * 100).toFixed(1)}% — the MEDIAN of its own preceding ${baselineDays.length} complete days, which together carried ${baseHard}/${baseN} (one-sample z=${z.toFixed(2)} against that median). The median is used rather than the pooled rate so that a previously degraded day cannot raise the bar this check is later judged against.\n\n` +
      `INSTRUMENT: population = executions whose activity_id contains 'feature_compose'; numerator = metadata.apply_failed === true AND metadata.ops_applied === 0, i.e. a hard anchor failure where NOTHING was applied. The looser predicate apply_failed alone reports a materially higher number and is a different metric; do not compare across the two.\n\n` +
      `PER-DAY SERIES (complete days only; today is excluded as partial):\n${series}\n\n` +
      `WHY THIS MATTERS AND WHY IT RECURS: feature-compose.ts is the component that performs every code change in this substrate, including changes to itself, and it has no test file. Its own pipeline logs the condition on every run: "every gate below this point READS the diff; only a test RUNS it. A FAVORABLE verdict here means the change was reviewed, never executed." A regression in this component therefore degrades the capability needed to detect and repair it. The precedent is f0cfb91 — a one-line inverted boolean that disabled the blind-edit anchor repair for two days while passing typecheck, the semantic gate and mitosis cutover.\n\n` +
      `FIRST DIAGNOSTIC STEP: list autonomous commits to the composer inside the degraded window and inspect them as a set, not individually — 'git log --author="Substrate Autonomous" --since=<day> -- src/resolvers/feature-compose.ts'. A single-line boolean inversion is the established shape of this failure and will not stand out in any one diff.`,
    {
      detector: "compose-drift-tick",
      day: latest.day,
      rate: latest.rate,
      baseline_rate: baseRate,
      baseline_days: baselineDays.length,
      z,
      samples: latest.n,
      edit_site: "repos/development-vessel/src/resolvers/feature-compose.ts",
      falsifier: "class2",
      evidence_resolve: { shape: "activityExecutionTrace" },
      measurement:
        "per-day: hard anchor-failure rate (apply_failed AND ops_applied==0) over feature_compose executions exceeds max(1.6x, +8pp) of the median of the composer's own preceding complete days, with two-proportion z >= 2.5; partial days excluded; days below 40 samples excluded",
    },
  );
  console.log(
    `[compose-drift] DEGRADED ${latest.day}: ${(latest.rate * 100).toFixed(1)}% vs baseline ${(baseRate * 100).toFixed(1)}% (z=${z.toFixed(2)}, n=${latest.n})`,
  );
}

main().catch((e) => {
  console.error("[compose-drift] failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
