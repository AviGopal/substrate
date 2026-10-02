#!/usr/bin/env bun
/**
 * operator-goal-signal.ts — the HONEST signal read for the operator-goal-generator.
 *
 * The generator's success is NOT "did the goal reach" (that would invite gaming the
 * reach-gate). It is "is the learning machinery getting exercised + enriched". This
 * read reports the enrichment signals so a baseline-now vs later comparison shows
 * whether the added multi-step traffic is feeding learning:
 *   (a) ψ (successor_features): cell count + richness = entries whose vector carries a
 *       non-1 (>1) occupancy component, and average distinct components per vector;
 *   (b) genuine composition edges (activity_composition_graph edge_kind='genuine' +
 *       the composition_edge table);
 *   (c) reach-rate trend over the last 24h from goal_execution_paths (reached/total).
 * Also echoes generator throughput from the jsonl. Read-only; emits one JSON line.
 */
const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREAL_PASS || process.env.SURREALDB_PASSWORD || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
const GENLOG = "/workspace/metrics/operator-goal-gen.jsonl";

async function sql(query: string): Promise<any[]> {
  const r = await fetch(SQL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Surreal-NS": NS, "Surreal-DB": DB, Authorization: sqlAuth, "Content-Type": "text/plain" },
    body: query,
  });
  const j = JSON.parse(await r.text());
  return j.map((s: any) => s.result);
}

async function main() {
  // (a) ψ — count + richness. Pull vectors and compute richness in JS (SurrealDB object
  //     introspection is awkward in pure SQL).
  const [cells] = await sql(`SELECT vector, sample_count FROM successor_features LIMIT 5000;`);
  let psiCount = 0, richCells = 0, totalComponents = 0;
  for (const c of cells || []) {
    psiCount++;
    const v = c.vector || {};
    const vals = Object.values(v) as number[];
    totalComponents += vals.length;
    if (vals.some((x) => typeof x === "number" && x > 1)) richCells++;
  }
  const avgComponents = psiCount ? +(totalComponents / psiCount).toFixed(2) : 0;

  // (b) genuine edges
  const [g] = await sql(`SELECT count() FROM activity_composition_graph WHERE edge_kind = 'genuine' GROUP ALL;`);
  const [ce] = await sql(`SELECT count() FROM composition_edge GROUP ALL;`);
  const genuineEdges = g?.[0]?.count ?? 0;
  const compositionEdgeTable = ce?.[0]?.count ?? 0;

  // (c) reach-rate (goal_execution_paths cumulative + 24h traces)
  const [gp] = await sql(`SELECT math::sum(success_count) AS reached, math::sum(execution_count) AS total FROM goal_execution_paths GROUP ALL;`);
  const reached = gp?.[0]?.reached ?? 0, total = gp?.[0]?.total ?? 0;
  const reachRate = total ? +(reached / total).toFixed(4) : null;

  // generator throughput
  let dispatched = 0, lastClass: string | null = null;
  try {
    if (await Bun.file(GENLOG).exists()) {
      const lines = (await Bun.file(GENLOG).text()).split("\n").filter((l) => l.trim());
      for (const l of lines) { try { const r = JSON.parse(l); if (r.dispatched) { dispatched++; lastClass = r.class; } } catch {} }
    }
  } catch {}

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    psi: { cells: psiCount, rich_cells: richCells, avg_components_per_vector: avgComponents },
    genuine_edges: genuineEdges,
    composition_edge_table: compositionEdgeTable,
    reach: { reached, total, rate: reachRate },
    generator: { dispatched, last_class: lastClass },
  }, null, 2));
}

main().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
