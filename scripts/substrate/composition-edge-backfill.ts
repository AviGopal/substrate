// One-shot backfill: derive activity_composition_graph edges from the
// parent_execution_id / activity_id relationship already stored on traces.
// Runs INSIDE substrate-live (direct SurrealDB HTTP /sql, root creds).
const URL = "http://127.0.0.1:8000/sql";
const NS = "activity-system", DB = "learning_loop";
const USER = "root", PASS = process.env.SURREAL_PASS!;
const auth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

async function sql(q: string): Promise<any[]> {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Accept: "application/json", "Surreal-NS": NS, "Surreal-DB": DB, Authorization: auth, "Content-Type": "text/plain" },
    body: q,
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error("bad resp: " + JSON.stringify(j).slice(0, 300));
  const last = j[j.length - 1];
  if (last && last.status && last.status !== "OK") throw new Error("sql err: " + JSON.stringify(last).slice(0, 300));
  return j.map((s: any) => s.result);
}

// 1) Build execution_id -> {activity_id, org_id} for ALL traces (paged).
const idToAct = new Map<string, string>();
let off = 0; const PAGE = 5000; let total = 0;
for (;;) {
  const [rows] = await sql(`SELECT execution_id, activity_id FROM activity_execution_traces LIMIT ${PAGE} START ${off};`);
  if (!rows || rows.length === 0) break;
  for (const r of rows) if (r.execution_id && r.activity_id) idToAct.set(r.execution_id, r.activity_id);
  total += rows.length; off += PAGE;
  if (rows.length < PAGE) break;
}
console.log(`indexed ${idToAct.size} execution_id->activity_id (scanned ${total})`);

// 2) Aggregate edges from children (parent_execution_id set).
type E = { count: number; success: number };
const edges = new Map<string, E>();
let childOff = 0, children = 0, orphan = 0, selfLoop = 0;
for (;;) {
  const [rows] = await sql(`SELECT activity_id, parent_execution_id, success FROM activity_execution_traces WHERE parent_execution_id != NONE LIMIT ${PAGE} START ${childOff};`);
  if (!rows || rows.length === 0) break;
  for (const r of rows) {
    children++;
    const childAct = r.activity_id; const parentAct = idToAct.get(r.parent_execution_id);
    if (!childAct || !parentAct) { orphan++; continue; }
    if (parentAct === childAct) { selfLoop++; continue; } // skip self-edges (retries within same activity)
    const key = parentAct + "" + childAct;
    const e = edges.get(key) ?? { count: 0, success: 0 };
    e.count++; if (r.success === true) e.success++;
    edges.set(key, e);
  }
  childOff += PAGE;
  if (rows.length < PAGE) break;
}
console.log(`children=${children} orphan(parent activity unknown)=${orphan} selfLoop=${selfLoop} distinctEdges=${edges.size}`);

// 3) UPSERT each edge (idempotent by deterministic record id).
let wrote = 0;
for (const [key, e] of edges) {
  const [p, c] = key.split("");
  const weight = e.count > 0 ? e.success / e.count : 0;
  const pj = JSON.stringify(p), cj = JSON.stringify(c);
  // deterministic id from the pair; let SurrealDB generate a safe id via a hash of the strings
  const rid = `${Bun.hash(key).toString(16)}`;
  await sql(`UPSERT activity_composition_graph:\`${rid}\` CONTENT {
    parent_activity_id: ${pj}, child_activity_id: ${cj},
    execution_count: ${e.count}, success_count: ${e.success}, weight: ${weight},
    success: ${weight >= 0.5}, org_id: 'organizations:substrate',
    execution_id: 'trace-backfill-2026-06-17',
    derived_from: 'trace-backfill-2026-06-17', updated_at: time::now(), created_at: time::now()
  };`);
  wrote++;
}
console.log(`UPSERTed ${wrote} composition edges`);
const [cnt] = await sql(`SELECT count() FROM activity_composition_graph GROUP ALL;`);
console.log(`activity_composition_graph now holds: ${JSON.stringify(cnt)}`);
