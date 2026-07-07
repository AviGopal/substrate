#!/usr/bin/env bun
/**
 * composition-edge-reconcile.ts — keep activity_composition_graph in sync with
 * reality.
 *
 * The executor stores parent_execution_id + composition_chain on every nested
 * trace, but nothing derives the aggregate parent_activity_id -> child_activity_id
 * edge table that GET /v2/activities/composition/graph (and the topological /
 * backward-chaining model) reads. Without this the edge table is empty (or, after
 * a one-shot backfill, drifts stale as new compositions accrue).
 *
 * INCREMENTAL BY DEFAULT (2026-07-06). The original reconciler re-derived the
 * full edge set from ALL traces every run — three keyset passes over the whole
 * trace table (223k+ rows) plus a full pass over execution_trace_content, every
 * 30 minutes. Under load this was the single largest source of SurrealDB
 * saturation (all worker threads pinned, 20s+ queue delay on trivial queries,
 * cascading auth timeouts). Now each run processes only traces newer than a
 * persisted watermark (reconcile_state:`composition-edge`), fetches the few
 * out-of-batch predecessor executions by indexed execution_id, and ADDS deltas
 * onto the existing edge rows. Because a child/consumer always executes after
 * its parent/producer, processing only new traces as children/consumers is
 * complete — no edge is ever sourced from an old-child/new-parent pair.
 *
 * Exactness: the watermark is set to run-start minus a 10-minute insertion-lag
 * overlap, and the execution_ids already processed inside that overlap are kept
 * in the state record so the next run skips them (no double counting). Traces
 * that land with >10min lag are picked up by the periodic FULL rebuild, which
 * recomputes absolute counts from scratch (self-healing): forced with
 * RECONCILE_FULL=1, and automatic when no watermark exists or the last full
 * rebuild is older than FULL_EVERY_MS (7 days).
 *
 * Runs as a oneshot systemd unit on a timer (see
 * units/composition-edge-reconcile.{service,timer}).
 *
 * Reads SURREAL_PASS / SURREALDB_* from /etc/substrate/env (EnvironmentFile).
 */
const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREAL_PASS || process.env.SURREALDB_PASSWORD || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const auth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");

// DISCOVERY-ROUTED STORE LOCATION (2026-07-05). This reconciler must run against
// the substrate whose store the traces actually LAND in — after the SC-P4 hub
// cutover the local reconciler kept scanning a store the trace stream had left,
// freezing composition edges (and λ₁) for 3 days while 500+ traces/hr flowed
// elsewhere. Instead of trusting a hardcoded localhost, ask discovery who serves
// the trace shapes: if the advertised trace-store vessel is co-located (same
// host as this substrate's discovery), reconcile the local SurrealDB as before;
// if it is NOT co-located, log loudly and exit 0 — the reconciler on the store's
// own substrate is the one that must do the work ("resolvers live where data
// lives"), and deriving cross-substrate over raw SQL is not possible anyway
// (creds + latency). Fail-soft: discovery dark → proceed against env/localhost
// exactly as before. Env SURREALDB_URL always wins; RECONCILE_FORCE=1 skips the
// co-location gate.
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const DISCOVERY_CANDIDATES = [
  process.env.DISCOVERY_ENDPOINT,
  "http://127.0.0.1:8100",    // in-container (how the systemd unit runs)
  "http://localhost:18100",   // host-mapped fallback
].filter(Boolean) as string[];
const API_KEY = process.env.METABOB_API_KEY || "";

async function traceStoreVessel(): Promise<{ vesselId?: string; endpoint?: string } | null> {
  for (const disc of DISCOVERY_CANDIDATES) {
    for (const shape of ["executionTraceList", "activityExecutionTrace"]) {
      try {
        const r = await fetch(`${disc}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}) },
          body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) continue;
        const j = (await r.json()) as any;
        const v = j?.content?.vessels?.[0];
        if (v?.endpoint) return { vesselId: v.vesselId, endpoint: v.endpoint };
      } catch { /* next */ }
    }
  }
  return null;
}

if (process.env.RECONCILE_FORCE !== "1") {
  const store = await traceStoreVessel();
  if (store?.endpoint) {
    // Co-located iff the advertised trace store is loopback/localhost relative to
    // where THIS unit runs (each substrate's discovery only registers its own
    // fleet, so a loopback endpoint means "this substrate owns the trace store").
    const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(store.endpoint);
    if (!local) {
      console.log(JSON.stringify({
        skipped: true,
        reason: `discovery says the trace store (${store.vesselId}) lives at ${store.endpoint} — not this substrate; run the reconciler there`,
        at: new Date().toISOString(),
      }));
      process.exit(0);
    }
    console.error(`[edge-reconcile] discovery: trace store ${store.vesselId} @ ${store.endpoint} (co-located) — reconciling ${SQL_URL}`);
  } else {
    console.error("[edge-reconcile] discovery dark — proceeding against env/localhost (fail-soft)");
  }
}

async function sql(q: string): Promise<any[]> {
  // The /sql endpoint intermittently returns an empty/non-JSON body under load (the
  // same contention that rate-limits trace-GET). A single rapid-fire pagination run
  // makes hundreds of calls, so one transient empty response would abort the whole
  // reconcile. Retry on parse/transport failure with backoff so the topology actually
  // gets rebuilt. (2026-06-19)
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(SQL_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Surreal-NS": NS, "Surreal-DB": DB, Authorization: auth, "Content-Type": "text/plain" },
        body: q,
      });
      const text = await r.text();
      if (!text.trim()) throw new Error("empty body (transient contention)");
      const j = JSON.parse(text);
      if (!Array.isArray(j)) throw new Error("bad resp: " + JSON.stringify(j).slice(0, 300));
      const last = j[j.length - 1];
      if (last && last.status && last.status !== "OK") throw new Error("sql err: " + JSON.stringify(last).slice(0, 300));
      return j.map((s: any) => s.result);
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const PAGE = 5000;
const CHUNK = 200; // batch size for indexed execution_id INSIDE [...] lookups
const OVERLAP_MS = 10 * 60 * 1000;        // insertion-lag window reprocessed (deduped) next run
const FULL_EVERY_MS = 7 * 24 * 3600 * 1000; // self-healing full rebuild cadence
const STATE_RID = "reconcile_state:`composition-edge`";

type ShapeRec = {
  activity_id?: string;
  input_impulse_shapes: string[];
  output_impulse_shapes: string[];
  parent_execution_id?: string;
  composition_chain: string[];
  success: boolean;
};

function toShapeRec(r: any): ShapeRec {
  return {
    activity_id: r.activity_id,
    input_impulse_shapes: Array.isArray(r.input_impulse_shapes) ? r.input_impulse_shapes : [],
    output_impulse_shapes: Array.isArray(r.output_impulse_shapes) ? r.output_impulse_shapes : [],
    parent_execution_id: r.parent_execution_id && r.parent_execution_id !== "NONE" ? r.parent_execution_id : undefined,
    composition_chain: Array.isArray(r.composition_chain) ? r.composition_chain : [],
    success: r.success === true,
  };
}

// ---- mode selection: incremental (watermark) vs full rebuild --------------------------
const runStartMs = Date.now();
const [stateRows] = await sql(`SELECT watermark, recent_ids, last_full_at FROM ${STATE_RID};`);
const state: { watermark?: string; recent_ids?: string[]; last_full_at?: string } =
  (Array.isArray(stateRows) && stateRows[0]) || {};
const lastFullMs = state.last_full_at ? Date.parse(state.last_full_at) : NaN;
const fullMode =
  process.env.RECONCILE_FULL === "1" ||
  !state.watermark ||
  !Number.isFinite(lastFullMs) ||
  runStartMs - lastFullMs > FULL_EVERY_MS;
const alreadyProcessed = new Set(fullMode ? [] : state.recent_ids ?? []);
console.error(`[edge-reconcile] mode=${fullMode ? "full" : "incremental"} watermark=${state.watermark ?? "-"} recent_ids=${alreadyProcessed.size}`);

const TRACE_FIELDS = "id, execution_id, activity_id, parent_execution_id, composition_chain, input_impulse_shapes, output_impulse_shapes, success, executed_at";

// ---- 1) load the trace batch -----------------------------------------------------------
// FULL: keyset over the whole table on the primary key. No ORDER BY: records are stored
// keyed by id, so a `WHERE id > X` range scan already returns rows in id order — an
// explicit `ORDER BY id` full-sorts the table per page and times out the /sql call.
// LIMIT/START over an UNORDERED select is worse still: storage-order rows shift as the
// table grows and deep pagination silently SKIPS rows, disproportionately the most
// RECENT — the original source of the ~33% orphan rate. (2026-06-19)
//
// INCREMENTAL: index range scan on executed_at (idx_activity_execution_traces_executed_at,
// verified Iterate Index via EXPLAIN), keyset-advanced on executed_at itself since the
// index returns rows in executed_at order. Ties at a page boundary are handled by the
// run-local `seenRowIds` set plus a `>=` cursor; the (impossible in practice) case of a
// full page sharing one timestamp bumps the cursor by 1ms rather than looping forever.
const batch: Array<{ execution_id: string; rec: ShapeRec; executed_at?: string }> = [];
const execShapes = new Map<string, ShapeRec>(); // every execution this run can resolve lookups against
if (fullMode) {
  let lastId = "";
  for (;;) {
    const where = lastId ? `WHERE id > ${lastId}` : "";
    const [rows] = await sql(`SELECT ${TRACE_FIELDS} FROM activity_execution_traces ${where} LIMIT ${PAGE};`);
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      lastId = r.id;
      if (!r.execution_id) continue;
      const rec = toShapeRec(r);
      execShapes.set(r.execution_id, rec);
      batch.push({ execution_id: r.execution_id, rec, executed_at: r.executed_at });
    }
    if (rows.length < PAGE) break;
  }
} else {
  const seenRowIds = new Set<string>();
  let cursor = state.watermark as string;
  for (;;) {
    const [rows] = await sql(`SELECT ${TRACE_FIELDS} FROM activity_execution_traces WHERE executed_at >= type::datetime(${JSON.stringify(cursor)}) LIMIT ${PAGE};`);
    if (!rows || rows.length === 0) break;
    let progressed = false;
    let maxSeen = cursor;
    for (const r of rows) {
      if (r.executed_at && r.executed_at > maxSeen) maxSeen = r.executed_at;
      if (seenRowIds.has(r.id)) continue;
      seenRowIds.add(r.id);
      progressed = true;
      if (!r.execution_id || alreadyProcessed.has(r.execution_id)) continue;
      const rec = toShapeRec(r);
      execShapes.set(r.execution_id, rec);
      batch.push({ execution_id: r.execution_id, rec, executed_at: r.executed_at });
    }
    if (rows.length < PAGE) break;
    cursor = progressed || maxSeen > cursor ? maxSeen : new Date(Date.parse(cursor) + 1).toISOString();
  }
}

// ---- 1b) resolve out-of-batch predecessors (incremental only in practice) -------------
// A child/consumer references its parent/producer by execution_id; in incremental mode
// that predecessor is usually OLDER than the watermark. Fetch exactly those executions
// via the indexed execution_id (EXPLAIN: Iterate Index union) in CHUNK-sized batches.
{
  const needed = new Set<string>();
  for (const { execution_id, rec } of batch) {
    if (rec.parent_execution_id && !execShapes.has(rec.parent_execution_id)) needed.add(rec.parent_execution_id);
    const chain = rec.composition_chain.filter((c) => c && c !== execution_id);
    const tail = chain[chain.length - 1];
    if (tail && !execShapes.has(tail)) needed.add(tail);
  }
  const ids = [...needed];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const arr = JSON.stringify(ids.slice(i, i + CHUNK));
    const [rows] = await sql(`SELECT ${TRACE_FIELDS} FROM activity_execution_traces WHERE execution_id INSIDE ${arr};`);
    for (const r of rows ?? []) { if (r.execution_id) execShapes.set(r.execution_id, toShapeRec(r)); }
  }
}

// ---- 2) parent-nesting edges from the batch's children ---------------------------------
// (dispatch-nesting: wrapper -> child star spokes; genuine flow comes from §2b)
const edges = new Map<string, { count: number; success: number }>();
let children = 0, orphan = 0, selfLoop = 0;
for (const { rec } of batch) {
  if (!rec.parent_execution_id) continue;
  children++;
  const childAct = rec.activity_id;
  const parentAct = execShapes.get(rec.parent_execution_id)?.activity_id;
  if (!childAct || !parentAct) { orphan++; continue; }
  if (parentAct === childAct) { selfLoop++; continue; }
  const key = parentAct + " " + childAct;
  const e = edges.get(key) ?? { count: 0, success: 0 };
  e.count++; if (rec.success) e.success++;
  edges.set(key, e);
}

// ---- 2b) GENUINE producer->consumer edges from SHAPE-FLOW (C7) --------------------------
//
// The parent-nesting derivation above (§2) only sees DISPATCH-NESTING: a child's
// parent_execution_id points at the wrapper that dispatched it, so the edges it emits
// are wrapper->child star spokes (compose-* wrappers + lifecycle hubs), NOT genuine
// "A produced a shape that B consumed" links.
//
// This second derivation emits genuine producer->consumer edges from two signals that
// are already CAPTURED in the trace store:
//
//   (1) Cross-execution composition_chain shape-flow. Traces linked by a composition
//       chain are an ordered walk: chain[i] is the immediate predecessor of chain[i+1]
//       (the chain is denormalized root-first, and parent_execution_id is the direct
//       predecessor). When step B's INPUT shapes intersect step A's OUTPUT shapes (A =
//       B's chain predecessor), B genuinely consumed a shape A produced — emit the edge
//       A.activity_id -> B.activity_id, weighted by B's success.
//
//   (2) Option-B task-level placeholder provenance. Within a single execution's tasks
//       (execution_trace_content.tasks), a consumer task carries consumed_from_task_ids
//       (the producer task ids it referenced via {{placeholders}}); a producer task that
//       dispatched a sub-activity carries child_activity_id. When the consumer's resolved
//       activity differs from the producer task's child_activity_id, that is a genuine
//       producer-activity -> consumer-activity capability edge — emit it.
//
// Both tolerate missing fields: a trace with no composition_chain / parent_execution_id,
// or content with no task provenance, simply contributes nothing. Edges are merged into
// the SAME `edges` map (summing count/success) so §3 writes one deduped set.
// Completeness under the incremental batch: B (the consumer) always executes after A
// (its chain predecessor / task producer), so iterating only NEW traces as consumers —
// with §1b resolving their older predecessors — covers every new edge occurrence.
async function deriveShapeFlowEdges(): Promise<Array<{ from: string; to: string; success: boolean }>> {
  const out: Array<{ from: string; to: string; success: boolean }> = [];

  const intersects = (a: string[] = [], b: string[] = []): boolean => {
    if (!a.length || !b.length) return false;
    const set = new Set(a);
    for (const x of b) if (set.has(x)) return true;
    return false;
  };

  // --- (1) composition_chain shape-flow: batch traces are the consumers (B) -----------
  for (const { execution_id, rec: b } of batch) {
    if (!b.activity_id) continue;
    // The immediate predecessor of B is its parent_execution_id; if absent, fall back to
    // the last element of composition_chain that is NOT B itself (root-first ordering, so
    // the nearest ancestor is the tail before B).
    const predIds = new Set<string>();
    if (b.parent_execution_id) predIds.add(b.parent_execution_id);
    const chain = b.composition_chain.filter((c) => c && c !== execution_id);
    if (chain.length) predIds.add(chain[chain.length - 1]);
    for (const predId of predIds) {
      const a = execShapes.get(predId);
      if (!a || !a.activity_id) continue;
      if (a.activity_id === b.activity_id) continue;
      // B consumed A's output iff B's input shapes intersect A's output shapes.
      if (!intersects(a.output_impulse_shapes, b.input_impulse_shapes)) continue;
      out.push({ from: a.activity_id, to: b.activity_id, success: b.success === true });
    }
  }

  // --- (2) Option-B task-level placeholder provenance ----------------------------------
  // Per-task data lives in execution_trace_content (split-write), keyed by execution_id
  // (idx_etc_execution_id). FULL mode pages the whole table; incremental fetches only the
  // content rows belonging to this run's batch executions.
  const handleContentRow = (r: any) => {
    const tasks: any[] = Array.isArray(r.tasks) ? r.tasks : [];
    if (!tasks.length) return;
    const ownerAct = execShapes.get(r.execution_id)?.activity_id;
    // producer task id -> the activity that task produced (its dispatched sub-activity).
    const producerActOf = new Map<string, string>();
    for (const t of tasks) {
      const tid = t.task_id ?? t.taskId;
      const childAct = t.child_activity_id ?? t.childActivityId;
      if (tid && childAct) producerActOf.set(String(tid), String(childAct));
    }
    for (const t of tasks) {
      const consumedFrom: string[] = Array.isArray(t.consumed_from_task_ids)
        ? t.consumed_from_task_ids
        : Array.isArray(t.consumedFromTaskIds)
          ? t.consumedFromTaskIds
          : [];
      if (!consumedFrom.length) continue;
      // consumer activity: the consumer task's own dispatched activity if any, else the
      // owning execution's activity.
      const consumerAct = (t.child_activity_id ?? t.childActivityId ?? ownerAct) as string | undefined;
      if (!consumerAct) continue;
      for (const pid of consumedFrom) {
        const producerAct = producerActOf.get(String(pid));
        if (!producerAct || producerAct === consumerAct) continue;
        // success of this consumer task (fall back to execution success).
        const taskOk = t.success === true || t.status === "success";
        out.push({ from: producerAct, to: consumerAct, success: taskOk });
      }
    }
  };

  if (fullMode) {
    let cLastId = "";
    for (;;) {
      const idGuard = cLastId ? `AND id > ${cLastId}` : "";
      const [rows] = await sql(
        `SELECT id, execution_id, tasks FROM execution_trace_content WHERE array::len(tasks ?? []) > 0 ${idGuard} LIMIT ${PAGE};`,
      );
      if (!rows || rows.length === 0) break;
      for (const r of rows) { cLastId = r.id; handleContentRow(r); }
      if (rows.length < PAGE) break;
    }
  } else {
    const ids = batch.map((b) => b.execution_id);
    for (let i = 0; i < ids.length; i += CHUNK) {
      const arr = JSON.stringify(ids.slice(i, i + CHUNK));
      const [rows] = await sql(
        `SELECT id, execution_id, tasks FROM execution_trace_content WHERE execution_id INSIDE ${arr} AND array::len(tasks ?? []) > 0;`,
      );
      for (const r of rows ?? []) handleContentRow(r);
    }
  }

  return out;
}

// Merge shape-flow edges into the SAME `edges` map the parent-nesting derivation built,
// so §3 writes one deduped set (counts summed across both sources, success accumulated).
// PROVENANCE-BACKED edges (2026-06-27). Edges from deriveShapeFlowEdges() are not
// wrapper→child dispatch spokes — they are REAL consumption links: §1 = B's input
// shapes actually intersected A's output shapes across a composition chain; §2 = a
// consumer task referenced a producer task via {{placeholder}} (consumed_from_task_ids).
// These are genuine capability flow EVEN WHEN one endpoint is a `compose-*` composite
// (a composite that consumes/produces a real shape is itself a real capability). The
// name-based `classifyEdge` scaffold heuristic (KIND_SCAFFOLD includes "compose-") was
// stamping these `scaffold` and excluding them from the genuine subgraph — which is why
// seeded bridge composites produced real data flow yet genuine.components never dropped
// and λ₂ stayed 0. We record the provenance keys so classifyEdge can keep them genuine
// (still demoted to `hub` if they touch a lifecycle hook — hubs are never genuine flow).
let shapeFlowContributions = 0;
const provenanceEdgeKeys = new Set<string>();
const shapeFlowEdges = await deriveShapeFlowEdges();
for (const sf of shapeFlowEdges) {
  if (!sf.from || !sf.to || sf.from === sf.to) continue;
  provenanceEdgeKeys.add(sf.from + " " + sf.to);
  // MUST use the same separator as the §2 parent-nesting join and the split below —
  // a separator mismatch here once made every shape-flow key split to [whole, undefined],
  // writing child_activity_id NONE and aborting the entire reconcile on the first genuine
  // edge. That single-char mismatch is why genuine_edges was frozen for weeks. (2026-06-26)
  const key = sf.from + " " + sf.to;
  const e = edges.get(key) ?? { count: 0, success: 0 };
  e.count++;
  if (sf.success) e.success++;
  edges.set(key, e);
  shapeFlowContributions++;
}

// Edge classification (C7) — persisted at WRITE time so the spectral-gap reader and
// the selection scaffold-exclusion gate can PREFER a durable column over the read-time
// touchesHub/isSynthetic heuristic. Mirrors activity-api's classifyCompositionEdge
// (src/routes/activities.ts) and the read-time HUB/SYNTH markers below: hub takes
// priority over scaffold; genuine = neither endpoint is a hub or scaffold. (2026-06-26)
const KIND_HUB = ["validator-dispatch", "slot-binding"];
const KIND_SCAFFOLD = ["compose-", "genuine-edge-probe", "edge-probe", "probe-producer", "probe-consumer", "probe-orchestrator"];
function classifyEdge(p: string, c: string, provenanceBacked = false): "genuine" | "scaffold" | "hub" {
  // Lifecycle-hub edges are NEVER genuine capability flow, even with provenance.
  if (KIND_HUB.some((h) => (p || "").includes(h) || (c || "").includes(h))) return "hub";
  // A provenance-backed consumption edge (real shape-flow or {{placeholder}} reference)
  // is genuine even if an endpoint is a compose-* composite — the composite genuinely
  // consumed/produced the shape. Only the NAME heuristic demoted it to scaffold; the
  // provenance overrides the name. (2026-06-27)
  if (provenanceBacked) return "genuine";
  if (KIND_SCAFFOLD.some((s) => (p || "").includes(s) || (c || "").includes(s))) return "scaffold";
  return "genuine";
}

// ---- 3) write edges (idempotent, deterministic id from the pair hash) ------------------
// FULL mode writes absolute counts (recomputed from all history — self-healing).
// INCREMENTAL mode ADDS this run's deltas onto the existing row's counts: the touched
// edge set is small, so read the current counts for exactly those records first, then
// UPSERT the summed absolutes through the same guarded write path.
const ridOf = (key: string) => Bun.hash(key).toString(16);
const existingCounts = new Map<string, { count: number; success: number }>();
if (!fullMode && edges.size > 0) {
  const rids = [...edges.keys()].map((k) => `activity_composition_graph:\`${ridOf(k)}\``);
  for (let i = 0; i < rids.length; i += CHUNK) {
    const arr = rids.slice(i, i + CHUNK).join(", ");
    const [rows] = await sql(`SELECT id, parent_activity_id, child_activity_id, execution_count, success_count FROM [${arr}];`);
    for (const r of rows ?? []) {
      if (!r || !r.parent_activity_id || !r.child_activity_id) continue;
      existingCounts.set(r.parent_activity_id + " " + r.child_activity_id, {
        count: typeof r.execution_count === "number" ? r.execution_count : 0,
        success: typeof r.success_count === "number" ? r.success_count : 0,
      });
    }
  }
}

let wrote = 0;
for (const [key, delta] of edges) {
  const [p, c] = key.split(" ");
  // Guard + diagnostic: a malformed pair (empty/undefined endpoint) writes a NONE into the
  // SCHEMAFULL child_activity_id/parent_activity_id and aborts the WHOLE reconcile (sql()
  // rethrows on status!=OK). Skip it and log the raw key bytes so the source can be found. (2026-06-26)
  if (!p || !c) { console.error("skip-malformed-edge keyJSON=" + JSON.stringify(key) + " p=" + JSON.stringify(p) + " c=" + JSON.stringify(c)); continue; }
  const prior = fullMode ? { count: 0, success: 0 } : existingCounts.get(key) ?? { count: 0, success: 0 };
  const e = { count: prior.count + delta.count, success: prior.success + delta.success };
  const weight = e.count > 0 ? e.success / e.count : 0;
  const rid = ridOf(key);
  const edgeKind = classifyEdge(p, c, provenanceEdgeKeys.has(key));
  // account_id_version is a SCHEMAFULL `TYPE int` field (migration 095). Its
  // schema DEFAULT 0 is NOT applied by `UPSERT ... CONTENT` (CONTENT replaces the
  // record and SurrealDB only applies DEFAULT on field-absent CREATE, not on a
  // CONTENT upsert), so omitting it left the field NONE and EVERY reconcile run
  // threw "Found NONE for field account_id_version, expected an int" on the first
  // edge — aborting the whole reconcile. The composition graph therefore never
  // grew past its stale ~15 pre-existing edges, starving the backward/composition
  // learning model. Set it explicitly so the edge set actually lands.
  try {
  await sql(`UPSERT activity_composition_graph:\`${rid}\` CONTENT {
    parent_activity_id: ${JSON.stringify(p)}, child_activity_id: ${JSON.stringify(c)},
    execution_count: ${e.count}, success_count: ${e.success}, weight: ${weight},
    success: ${weight >= 0.5}, org_id: 'organizations:substrate', account_id_version: 0,
    execution_id: 'composition-edge-reconcile',
    edge_kind: ${JSON.stringify(edgeKind)}, genuine: ${edgeKind === "genuine"},
    derived_from: 'composition-edge-reconcile', updated_at: time::now(), created_at: time::now()
  };`);
  wrote++;
  } catch (err) {
    // One malformed edge must NEVER abort the whole topology rebuild (sql() rethrows on
    // status!=OK). Log the culprit's raw key + endpoints and continue so the genuine-edge
    // signal still lands; the bad pair is then root-caused offline. (2026-06-26)
    console.error("upsert-failed rid=" + rid + " key=" + JSON.stringify(key) + " p=" + JSON.stringify(p) + " c=" + JSON.stringify(c) + " err=" + String(err).slice(0, 200));
  }
}

// ---- 4) advance the watermark -----------------------------------------------------------
// New watermark = run start minus the insertion-lag overlap; the execution_ids already
// processed inside that overlap ride along in recent_ids so the next run skips them
// (exact — no double counting). Traces landing with more lag than OVERLAP_MS are caught
// by the periodic full rebuild.
{
  const newWatermark = new Date(runStartMs - OVERLAP_MS).toISOString();
  const recent = batch
    .filter((b) => b.executed_at && b.executed_at >= newWatermark)
    .map((b) => b.execution_id);
  // Carry forward previously-recorded overlap ids that are STILL inside the new window
  // (a fast rerun narrows the window; ids that fell out are safely behind the watermark).
  if (!fullMode) {
    for (const id of alreadyProcessed) if (!recent.includes(id)) recent.push(id);
  }
  const lastFullAt = fullMode ? new Date(runStartMs).toISOString() : state.last_full_at!;
  await sql(`UPSERT ${STATE_RID} CONTENT {
    watermark: ${JSON.stringify(newWatermark)},
    recent_ids: ${JSON.stringify(recent.slice(0, 10000))},
    last_full_at: ${JSON.stringify(lastFullAt)},
    updated_at: time::now()
  };`);
}

const [cnt] = await sql(`SELECT count() FROM activity_composition_graph GROUP ALL;`);

// GENUINE edge count = the HONEST λ₁ (credit-mixing) signal in capability space.
// The lifecycle hooks slot-binding / validator-dispatch fire as nested children of
// EVERY activity, so the raw edge count is dominated by activity→hook parentage that
// carries no capability-to-capability credit. An edge is "genuine" only when NEITHER
// endpoint is a lifecycle hub — i.e. one capability's output actually fed another
// capability. genuine_edges ≈ 0 (a near-pure star) means λ₁ in capability space is ~0
// regardless of how large the raw count is; this is the number that must rise before
// minting more capability (ρ_grow) stays sub-critical (λ₁ ≳ ρ_grow). See
// docs/architecture/SUBSTRATE_AS_DYNAMICS.md §3-4 and SUBSTRATE_AS_DEC.md §4.4.
// NOTE: in incremental mode these stats cover only edges TOUCHED this run — the
// whole-graph numbers come from the weekly full rebuild (mode is in the output).
const HUB = ["validator-dispatch", "slot-binding"];
const touchesHub = (s: string) => HUB.some((h) => (s || "").includes(h));
// SYNTHETIC scaffolding: the `genuine-edge-probe-*` orchestrator/producer/consumer
// trio exists ONLY to manufacture a non-hub edge — it builds no real functionality.
// Counting it as genuine λ₁ lets the substrate satisfy the spectral-gap governor's
// master inequality (λ₁ ≳ ρ_grow) by GAMING rather than by composing real capability.
// organic_genuine_edges = non-hub edges that are also not synthetic probe scaffolding;
// this is the HONEST capability-composition signal.
const SYNTH = ["genuine-edge-probe", "edge-probe", "probe-producer", "probe-consumer", "probe-orchestrator"];
const isSynthetic = (s: string) => SYNTH.some((k) => (s || "").includes(k));
// Topology learns from BOTH failures and successes (operator direction 2026-06-19):
// every edge carries execution_count + success_count, so we distinguish an organic
// composition that was merely ATTEMPTED from one that actually SUCCEEDED. A failed
// organic edge is still a real topology link (the substrate TRIED to compose these
// capabilities — that it failed is signal about what conditions were missing), but a
// SUCCESSFUL organic edge is the stronger credit-mixing signal. We track both so the
// learning loop can reward success without losing the "attempted, learn why it failed"
// information. organic_success_rate = succeeded / attempted over organic edges.
let genuine_edges = 0, organic_genuine_edges = 0, organic_successful_edges = 0;
let organic_attempts = 0, organic_successes = 0;
for (const [key, e] of edges) {
  const [p, c] = key.split(" ");
  if (touchesHub(p) || touchesHub(c)) continue;
  genuine_edges++;
  if (isSynthetic(p) || isSynthetic(c)) continue;
  organic_genuine_edges++;
  organic_attempts += e.count;
  organic_successes += e.success;
  if (e.success > 0) organic_successful_edges++;
}
const organic_success_rate = organic_attempts > 0 ? +(organic_successes / organic_attempts).toFixed(3) : null;
console.log(JSON.stringify({
  mode: fullMode ? "full" : "incremental",
  batch_traces: batch.length,
  indexed_executions: execShapes.size, children, orphan, selfLoop,
  shape_flow_contributions: shapeFlowContributions,
  distinct_edges: edges.size, genuine_edges, organic_genuine_edges,
  organic_successful_edges, organic_success_rate, upserted: wrote,
  graph_total: (cnt && cnt[0] && cnt[0].count) ?? 0,
  at: new Date().toISOString(),
}));
