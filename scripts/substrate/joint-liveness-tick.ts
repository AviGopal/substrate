/**
 * joint-liveness-tick.ts — a detector for the write→read-severed CLASS.
 *
 * The dominant defect class in this substrate is a writer with no live reader:
 * `activity_execution_traces` frozen 42 days while the self-observation layer kept
 * querying it; `decision_outcome` sitting empty; the composition graph a batch
 * artifact. Each instance got patched by hand; nothing detected the class.
 *
 * This is the class detector (law 6). For every (table, time column, max lag)
 * binding that SHOULD co-advance with live fleet activity, it asserts the table's
 * newest write is within `maxLagSec` of the newest `execution` row. A bound table
 * frozen while `execution` is live is the exact frozen-table signature. Each
 * severed joint emits a `substrateGap`.
 *
 * META-GUARD (law: a detector must be proven to COMPLETE, not just exist): if the
 * fleet is active (execution is fresh) but ZERO bindings were successfully checked,
 * the detector emits a gap about ITSELF — otherwise a detector that silently checks
 * nothing is the newest check-that-cannot-fail, the very thing it exists to catch.
 *
 * Strictly read-only except substrateGap emission. Add a binding here whenever a
 * new reader→table dependency is wired; the binding list IS the shaped dependency
 * graph the walk cannot yet see.
 */

const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREALDB_PASSWORD || process.env.SURREAL_PASS || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const DEV = process.env.DEV_VESSEL_ENDPOINT || process.env.DEVELOPMENT_VESSEL_URL || "http://127.0.0.1:8090";
const KEY = process.env.SUBSTRATE_ADMIN_KEY || process.env.METABOB_API_KEY || "";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

// Fleet-idle guard: if the newest execution is older than this, the fleet is
// simply idle and a stale reader-table is not evidence of a severed joint.
const IDLE_WINDOW_SEC = 2 * 3600;

// The shaped dependency graph. Each entry: a table a named reader depends on that
// must keep pace with `execution`. timeCol is read via ORDER BY (math::max returns
// null on datetimes in this SurrealDB build).
const BINDINGS: Array<{ table: string; timeCol: string; maxLagSec: number; reader: string }> = [
  {
    table: "decision_outcome",
    timeCol: "executed_at",
    maxLagSec: 3600,
    reader: "activity-api /decision-calibration + universal per-execution reach capture (migration 202)",
  },
  // Add here as joints are wired, e.g. a metrics/posterior table, the composition
  // graph once it stamps a time column, or any future self-observation reader.
];

async function sql<T = any>(q: string): Promise<T[]> {
  const r = await fetch(SQL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Surreal-NS": NS, "Surreal-DB": DB, Authorization: sqlAuth, "Content-Type": "text/plain" },
    body: q,
  });
  const j = (await r.json()) as Array<{ status: string; result: T[] }>;
  const last = j[j.length - 1];
  if (!last || last.status !== "OK") throw new Error(`sql failed: ${JSON.stringify(j).slice(0, 200)}`);
  return last.result;
}

async function newestOf(table: string, timeCol: string): Promise<number | null> {
  const rows = await sql<Record<string, unknown>>(`SELECT ${timeCol} FROM ${table} ORDER BY ${timeCol} DESC LIMIT 1;`);
  const v = rows?.[0]?.[timeCol];
  if (!v) return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

async function emitGap(id: string, category: string, summary: string): Promise<void> {
  const body = JSON.stringify({
    impulse: { pointer: { type: "substrateGap_write", gap: { id, category, source: "joint_liveness_detector", summary, status: "open" } } },
  });
  const r = await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
    body,
  });
  if (!r.ok) console.error(`[joint-liveness] emitGap FAILED http=${r.status} id=${id} — detector fired but nothing is queryable`);
  else console.log(`[joint-liveness] gap filed: ${id}`);
}

async function main() {
  // NOWMS must not come from Date.now() semantics we can't trust across hosts; use
  // the DB clock so the comparison is against the same time source that stamps rows.
  const nowRows = await sql<{ t: string }>("RETURN { t: <string> time::now() };");
  const nowMs = Date.parse(String(nowRows?.[0]?.t ?? "")) || 0;

  const newestExec = await newestOf("execution", "executed_at");
  if (newestExec == null) {
    // No execution table freshness at all — either a fresh boot or `execution`
    // itself is severed. Both warrant a gap: the ground-truth liveness signal is gone.
    await emitGap(
      "joint-liveness-execution-has-no-freshness",
      "systematic_failure",
      "joint-liveness detector could not read a newest executed_at from `execution` — the ground-truth liveness table is empty or unreadable, so no reader-table freshness can be judged. Either a genuinely fresh boot or `execution` writes have severed.",
    );
    console.log("[joint-liveness] execution has no freshness; gap filed; exiting");
    return;
  }

  const fleetIdleSec = nowMs ? (nowMs - newestExec) / 1000 : 0;
  if (fleetIdleSec > IDLE_WINDOW_SEC) {
    console.log(`[joint-liveness] fleet idle (${Math.round(fleetIdleSec / 60)}min since last execution) — no severed-joint signal; skipping`);
    return;
  }

  let checked = 0;
  let severed = 0;
  for (const b of BINDINGS) {
    let newestX: number | null;
    try {
      newestX = await newestOf(b.table, b.timeCol);
    } catch (e) {
      console.error(`[joint-liveness] binding ${b.table}.${b.timeCol} query errored: ${(e as Error)?.message ?? e}`);
      continue; // a binding that cannot be read is not "checked"
    }
    checked++;
    const lagSec = newestX == null ? Infinity : (newestExec - newestX) / 1000;
    if (lagSec > b.maxLagSec) {
      severed++;
      await emitGap(
        `severed-joint-${b.table}`,
        "systematic_failure",
        `Write->read joint SEVERED: \`${b.table}\` (read by ${b.reader}) has no write within ${b.maxLagSec}s of the newest \`execution\` row, while the fleet is active (last execution ${Math.round(fleetIdleSec)}s ago). Newest ${b.table}.${b.timeCol} lags live execution by ${newestX == null ? "∞ (empty)" : Math.round(lagSec) + "s"}. This is the frozen-table class (cf. activity_execution_traces frozen 42d). Repair: find the writer that stopped, or the reader pointed at a dead table, and reconnect it.`,
      );
    } else {
      console.log(`[joint-liveness] ok: ${b.table} lag=${Math.round(lagSec)}s (<= ${b.maxLagSec}s)`);
    }
  }

  // META-GUARD: fleet is active but the detector checked nothing -> it cannot fail.
  if (checked === 0) {
    await emitGap(
      "joint-liveness-detector-checks-nothing",
      "systematic_failure",
      `joint-liveness detector ran with the fleet ACTIVE (last execution ${Math.round(fleetIdleSec)}s ago) but successfully checked 0 of ${BINDINGS.length} bindings — every binding query errored or the binding list is empty. A detector that checks nothing is the newest check-that-cannot-fail; it must gap on itself.`,
    );
  }

  console.log(`[joint-liveness] done: fleet_active newest_exec_lag=${Math.round(fleetIdleSec)}s bindings=${BINDINGS.length} checked=${checked} severed=${severed}`);
}

main().catch((e) => {
  console.error(`[joint-liveness] fatal: ${(e as Error)?.stack ?? e}`);
  process.exit(1);
});
