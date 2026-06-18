// recompute-poisoned-posteriors.ts (v2 — GROUP BY counting).
// Un-poison the forward model: phantom (errorless) failures β-poisoned the
// Thompson posteriors of the substrate's autonomy machinery. Reset each
// phantom-dominated poisoned variant to Beta(1 + real_successes, 1 + real
// failures-WITH-an-error), dropping errorless failures (neutral, per the
// substrate's own audited-NO=no_op design). Snapshot taken first.
//
// NB: per-variant WHERE+count() is BROKEN on this table (multi-index AND
// mis-intersects → counts exceed totals). GROUP BY aggregation is correct, so
// we count via ONE GROUP BY over the store. DRY_RUN=1 reports only.
const PASS = process.env.SURREALDB_PASSWORD!;
const AUTH = "Basic " + btoa("root:" + PASS);
const URL = "http://127.0.0.1:8000/sql";
const DRY = process.env.DRY_RUN === "1";
const MEAN_FLOOR = Number(process.env.MEAN_FLOOR ?? 0.15);
const MIN_TOTAL = Number(process.env.MIN_TOTAL ?? 20);

async function q<T = any>(sql: string): Promise<T[]> {
  const r = await fetch(URL, { method: "POST", headers: { Accept: "application/json", "Content-Type": "text/plain", Authorization: AUTH }, body: "USE NS `activity-system` DB learning_loop;\n" + sql });
  const j = (await r.json()) as Array<{ status: string; result: T[] }>;
  const last = j[j.length - 1];
  if (!last || last.status !== "OK") throw new Error("SQL: " + JSON.stringify(j).slice(0, 300));
  return last.result;
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// 1. Ground-truth counts per variant_id via GROUP BY (the only reliable path).
console.log("[recompute] counting via GROUP BY variant_id,status,has_err…");
const rows = await q<{ variant_id: string; status: string; has_err: boolean; n: number }>(
  `SELECT variant_id, status, (error_message != NONE AND error_message != "") AS has_err, count() AS n
   FROM activity_execution_traces GROUP BY variant_id, status, has_err;`,
);
type C = { succ: number; realFail: number; phantom: number };
const counts = new Map<string, C>();
for (const r of rows) {
  if (!r.variant_id) continue;
  const c = counts.get(r.variant_id) ?? { succ: 0, realFail: 0, phantom: 0 };
  if (r.status === "success" || r.status === "completed") c.succ += r.n;
  else if (r.status === "failure") { if (r.has_err) c.realFail += r.n; else c.phantom += r.n; }
  counts.set(r.variant_id, c);
}

// 2. Poisoned variants from the metrics table.
const poisoned = await q<{ variant_id: string; thompson_alpha: number; thompson_beta: number; total_executions: number }>(
  `SELECT variant_id, thompson_alpha, thompson_beta, total_executions FROM variant_performance_metrics
   WHERE total_executions >= ${MIN_TOTAL} AND (thompson_alpha / (thompson_alpha + thompson_beta)) < ${MEAN_FLOOR};`,
);
console.log(`[recompute] ${poisoned.length} poisoned variants (mean < ${MEAN_FLOOR}). DRY_RUN=${DRY}`);

let changed = 0;
for (const v of poisoned) {
  const c = counts.get(v.variant_id);
  if (!c) { console.log(`  SKIP ${v.variant_id.slice(0, 46)} (no trace counts)`); continue; }
  const oldMean = v.thompson_alpha / (v.thompson_alpha + v.thompson_beta);
  const newAlpha = 1 + c.succ, newBeta = 1 + c.realFail;
  const newMean = newAlpha / (newAlpha + newBeta);
  // Act only when phantom failures dominate (don't touch honestly-failing variants).
  if (c.phantom < 10 || c.phantom <= c.realFail) {
    console.log(`  SKIP ${v.variant_id.slice(0, 46)} succ=${c.succ} realFail=${c.realFail} phantom=${c.phantom} (not phantom-dominated)`);
    continue;
  }
  console.log(`  ${DRY ? "WOULD" : "FIX "} ${v.variant_id.slice(0, 46)} succ=${c.succ} realFail=${c.realFail} phantom=${c.phantom}  mean ${oldMean.toFixed(3)} -> ${newMean.toFixed(3)}  β ${v.thompson_beta.toFixed(0)} -> ${newBeta}`);
  if (!DRY) {
    await q(`UPDATE variant_performance_metrics SET
        thompson_alpha = ${newAlpha}, thompson_beta = ${newBeta},
        successful_executions = ${c.succ}, failed_executions = ${c.realFail},
        total_executions = ${c.succ + c.realFail},
        success_rate = ${c.succ + c.realFail > 0 ? c.succ / (c.succ + c.realFail) : 0},
        depoisoned_at = time::now(), depoisoned_dropped_phantom = ${c.phantom}
      WHERE variant_id = "${esc(v.variant_id)}";`);
    changed++;
  }
}
console.log(`[recompute] DONE — ${changed} variants ${DRY ? "(dry-run)" : "un-poisoned"}.`);
