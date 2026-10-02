/**
 * self-development-trend.ts — the empirical instrument for "is the substrate
 * developing itself unsupervised?"
 *
 * Records, on a timer, the signal metrics whose TREND over hours/days answers
 * the question the apparatus cannot answer in a single snapshot:
 *   - ψ cells / multi-shape / multiply-sampled  → is the look-ahead enriching?
 *   - genuine composition edges                  → is the capability graph growing?
 *   - goal reach-rate (cumulative + windowed)    → is it getting better at reaching?
 *   - operator-goals dispatched/reached          → is it exercising itself?
 *
 * Appends one line per tick to /workspace/metrics/self-development-trend.jsonl.
 * Read it (tail / jq) any time — across sessions — to see whether the running
 * loop genuinely improves. Low/flat early is EXPECTED (the composer's S1→S2
 * frontier); the question is the slope over time. (2026-06-28)
 *
 * Self-activating from the run-dir; env-gated SELF_DEV_TREND (default 1).
 */
import { readFileSync } from "node:fs";

const ENABLED = (process.env["SELF_DEV_TREND"] ?? "1") !== "0";
if (!ENABLED) { console.log("[self-dev-trend] disabled"); process.exit(0); }

// Read SurrealDB creds from the substrate env (same pattern as spectral-gap.ts).
let NS = "activity-system", DB = "learning_loop", URL = "http://localhost:8000",
  USER = "root", PASS = "root";
try {
  const env = readFileSync("/etc/substrate/env", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "SURREAL_URL") URL = v;
    else if (k === "SURREAL_USER" || k === "SURREALDB_USERNAME") USER = v;
    else if (k === "SURREAL_PASS" || k === "SURREALDB_PASSWORD") PASS = v;
    else if (k === "SURREAL_NS") NS = v;
    else if (k === "SURREAL_DB") DB = v;
  }
} catch { /* fall back to defaults */ }

async function q(sql: string): Promise<any[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${URL}/sql`, {
        method: "POST",
        headers: {
          Accept: "application/json", "Content-Type": "text/plain",
          "Surreal-NS": NS, "Surreal-DB": DB,
          Authorization: "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64"),
        },
        body: sql,
      });
      const j = JSON.parse(await r.text());
      const last = j[j.length - 1];
      if (last?.status === "OK") return last.result;
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
  }
  return null; // null = unreachable, distinct from a real zero
}

function num(rows: any[] | null, key: string): number | null {
  if (!rows || rows.length === 0) return null;
  const v = rows[0]?.[key];
  return typeof v === "number" ? v : null;
}

const psiCells = num(await q("SELECT count() AS c FROM successor_features GROUP ALL;"), "c");
const psiMulti = num(await q("SELECT count() AS c FROM successor_features WHERE array::len(object::keys(vector)) > 1 GROUP ALL;"), "c");
const psiSampled = num(await q("SELECT count() AS c FROM successor_features WHERE sample_count > 1 GROUP ALL;"), "c");
const edges = num(await q("SELECT count() AS c FROM activity_composition_graph WHERE edge_kind = 'genuine' GROUP ALL;"), "c");
const reach = await q("SELECT math::sum(success_count) AS r, math::sum(execution_count) AS a FROM goal_execution_paths GROUP ALL;");
const reaches = num(reach, "r");
const attempts = num(reach, "a");
// Windowed reach over the last 6h (the trend that matters more than the cumulative).
const wReach = await q("SELECT math::sum(success_count) AS r, math::sum(execution_count) AS a FROM goal_execution_paths WHERE updated_at > time::now() - 6h GROUP ALL;");

const out = {
  // Caller stamps `at` after the run (Date.now is unavailable in some contexts);
  // here we are a normal script run so new Date() is fine.
  at: new Date().toISOString(),
  psi_cells: psiCells,
  psi_multishape: psiMulti,
  psi_multisampled: psiSampled,
  genuine_edges: edges,
  reach_cum: reaches !== null && attempts ? Math.round((reaches / attempts) * 1e4) / 1e4 : null,
  reaches_cum: reaches, attempts_cum: attempts,
  reach_6h: num(wReach, "r") !== null && num(wReach, "a") ? Math.round((num(wReach, "r")! / num(wReach, "a")!) * 1e4) / 1e4 : null,
};
console.log(JSON.stringify(out));
try {
  const f = "/workspace/metrics/self-development-trend.jsonl";
  const prev = await Bun.file(f).exists() ? await Bun.file(f).text() : "";
  await Bun.write(Bun.file(f), prev + JSON.stringify(out) + "\n");
} catch { /* tolerant */ }
