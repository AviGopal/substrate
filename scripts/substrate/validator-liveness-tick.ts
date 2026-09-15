/**
 * validator-liveness-tick.ts — a detector for the SILENT-VALIDATOR class.
 *
 * A validator that stops running emits silence, and silence is indistinguishable
 * from health. Measured 2026-09-09: of 102 validator-shaped activities that had
 * executed since 08-25, only 12 ran in the last 24h — 90 were dormant, at ages of
 * 7 to 16 days. The dormant set was precisely the wiring-validation layer
 * (advertised-shape-coverage 15d, orphaned-capability 16d, detector-coverage 9d,
 * coverage_tick 12d, substrate_health_tick 12d). Nothing reported it.
 *
 * WHY THIS RUNS FROM SYSTEMD AND NOT FROM THE POOL. Every survivor of that census
 * was systemd-timed or a very-high-frequency tick; every dormant one was a
 * `satisfier:*` or `learned-composition-*`, i.e. Thompson-selected. Cadence
 * currently rides on selection, and selection has no obligation to keep a
 * validator alive — including `rhythm_conductor_tick` itself, which is registered
 * as `satisfier:rhythm_conductor_tick` and had 11 executions ever, the last 53
 * hours before this file was written. That is the circularity CLAUDE.md already
 * names when it exempts the liveness watchdogs from the script-retention rule:
 * "a check cannot be scheduled by the mechanism it exists to recover." This is
 * the bootstrap tier, and it is the stated exception rather than a carve-out.
 *
 * IT MEASURES, IT DOES NOT SET POLICY. The expected cadence of a validator is
 * derived from THAT VALIDATOR'S OWN HISTORY — the median gap between its past
 * executions — not from a period chosen here. A validator is severed when its
 * current silence exceeds a multiple of the rhythm it previously kept. Choosing
 * cadence periods is an operator decision; observing that something stopped
 * keeping its own is not.
 *
 * META-GUARD (a detector must be proven to COMPLETE, not merely to exist): if the
 * fleet is active but ZERO validators had enough history to evaluate, this emits a
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

/** Fleet-idle guard: a quiet fleet makes every validator look severed. */
const IDLE_WINDOW_SEC = 2 * 3600;
/** Look-back for reconstructing each validator's own rhythm. */
const HISTORY_DAYS = 30;
/** Minimum executions before a validator has a rhythm worth asserting against. */
const MIN_HISTORY = 5;
/** Silence must exceed this multiple of the validator's own median gap. */
const SEVERED_MULTIPLE = 6;
/** ...and always at least this, so a chatty validator is not flagged on a blip. */
const MIN_SILENCE_SEC = 24 * 3600;
/** An id that looks like a validator rather than ordinary work. */
const VALIDATOR_RE = /tick|scan|probe|observer|audit|integrity|conformance/i;

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

/** Median of a numeric array; 0 for an empty one. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
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

async function main(): Promise<void> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
  // ORDER BY rather than math::max: that aggregate returns null on datetimes in
  // this SurrealDB build, which reads as "never executed" for every row.
  const res = await sql(
    `SELECT activity_id, executed_at FROM execution WHERE executed_at > d'${since}';\n` +
      `SELECT executed_at FROM execution ORDER BY executed_at DESC LIMIT 1;\n`,
  );

  const execs = rowsOf(res, 0);
  const newestRow = rowsOf(res, 1)[0];
  const newestExec = newestRow ? Date.parse(String(newestRow["executed_at"] ?? "")) : NaN;
  const now = Date.now();

  if (!Number.isFinite(newestExec) || (now - newestExec) / 1000 > IDLE_WINDOW_SEC) {
    console.log(`[validator-liveness] fleet idle (newest execution ${newestRow ? newestRow["executed_at"] : "none"}) — abstaining; a quiet fleet is not a severed validator`);
    return;
  }

  // Reconstruct each validator's own rhythm from its own history.
  const times = new Map<string, number[]>();
  for (const row of execs) {
    const a = String(row["activity_id"] ?? "");
    if (!a || !VALIDATOR_RE.test(a)) continue;
    const t = Date.parse(String(row["executed_at"] ?? ""));
    if (!Number.isFinite(t)) continue;
    (times.get(a) ?? times.set(a, []).get(a)!).push(t);
  }

  let evaluated = 0;
  const severed: { id: string; silentH: number; medianH: number; n: number }[] = [];
  for (const [id, ts] of times) {
    if (ts.length < MIN_HISTORY) continue;
    ts.sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < ts.length; i++) gaps.push(ts[i]! - ts[i - 1]!);
    const med = median(gaps);
    if (med <= 0) continue;
    evaluated++;
    const silent = now - ts[ts.length - 1]!;
    if (silent > Math.max(med * SEVERED_MULTIPLE, MIN_SILENCE_SEC * 1000)) {
      severed.push({ id, silentH: silent / 3600_000, medianH: med / 3600_000, n: ts.length });
    }
  }

  if (evaluated === 0) {
    await emitGap(
      "validator-liveness-detector-checked-nothing",
      `validator-liveness-tick ran against a LIVE fleet (newest execution ${new Date(newestExec).toISOString()}) but evaluated ZERO validators: ` +
        `${times.size} validator-shaped activity id(s) were seen in the last ${HISTORY_DAYS} days and none had the ${MIN_HISTORY} executions needed to establish a rhythm. ` +
        `A detector that checks nothing is indistinguishable from a detector that finds nothing, which is the class this detector exists to catch. ` +
        `Either the validator-id pattern no longer matches how validators are named, or validator execution has collapsed entirely.`,
      { detector: "validator-liveness-tick", evaluated: 0, candidates: times.size, falsifier: "class2", evidence_resolve: { shape: "activityExecutionTrace" } },
    );
    console.log(`[validator-liveness] META-GAP: fleet live, ${times.size} candidates, 0 evaluable`);
    return;
  }

  if (severed.length === 0) {
    console.log(`[validator-liveness] OK — ${evaluated} validator(s) evaluated, none severed`);
    return;
  }

  severed.sort((a, b) => b.silentH - a.silentH);
  const lines = severed
    .slice(0, 40)
    .map((s) => `  ${s.id} — silent ${(s.silentH / 24).toFixed(1)}d, own median cadence ${s.medianH.toFixed(1)}h over ${s.n} runs`)
    .join("\n");

  await emitGap(
    "validator-cadence-severed",
    `${severed.length} of ${evaluated} validators with an established rhythm have gone silent for more than ${SEVERED_MULTIPLE}x their own median cadence, while the fleet is live ` +
      `(newest execution ${new Date(newestExec).toISOString()}).\n\n` +
      `Each line below is a validator that previously kept a measurable rhythm and has stopped. The expectation is derived from that validator's own history, not from a period chosen by anyone, so a severed entry means the component stopped doing what it was already doing.\n\n` +
      `${lines}\n\n` +
      `WHY THIS RECURS: a validator whose execution depends on Thompson selection has no guarantee of being selected, and when it is not, it emits silence rather than a failure. Silence is read as health by every consumer. The survivors of this census are the ones driven by a timer rather than by selection.`,
    {
      detector: "validator-liveness-tick",
      severed_count: severed.length,
      evaluated,
      worst: severed[0]?.id,
      falsifier: "class2",
      evidence_resolve: { shape: "activityExecutionTrace" },
      measurement: "per-validator: silence > max(6x own median inter-execution gap, 24h), evaluated only for validators with >=5 executions in 30d, and only while the fleet is live",
    },
  );
  console.log(`[validator-liveness] SEVERED ${severed.length}/${evaluated} — worst: ${severed[0]!.id} (${(severed[0]!.silentH / 24).toFixed(1)}d)`);
}

main().catch((e) => {
  console.error("[validator-liveness] failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
