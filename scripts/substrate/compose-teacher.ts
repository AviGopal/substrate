#!/usr/bin/env bun
/**
 * compose-teacher.ts — SUBSTRATE-NATIVE continuous composition-teaching loop.
 *
 * WHY (2026-06-19, operator direction "the system could do this itself"): the
 * substrate's topology is a near-pure star because no real activity composes other
 * real activities — every capability is single-step + lifecycle hooks. Its native
 * greenfield generator (generative-frontier-gap-tick) is DEADLOCKED: it refuses to
 * emit until headroom = λ₂·(1−star_ratio) ≥ 0.35, but headroom only rises from organic
 * composition, which never happens. This loop BOOTSTRAPS organic composition from
 * within the substrate (a systemd timer, not an external Claude agent): each tick it
 * finds a reliably-succeeding producer→consumer pair of REAL capabilities, ensures a
 * composite that chains them exists, and dispatches it through goal-host-vessel. The
 * composition-edge-reconcile timer then records the organic edges; spectral-gap tracks
 * star_ratio/headroom falling. As organic composition accumulates and headroom crosses
 * 0.35, the substrate's OWN generative frontier unlocks and takes over — at which point
 * this bootstrap can be retired. Bounded: ONE composite authored/dispatched per tick.
 *
 * Env (exported by the unit's EnvironmentFile=/etc/substrate/env): SURREAL_PASS,
 * METABOB_API_KEY, SURREALDB_* . No `set -a` needed — systemd exports EnvironmentFile.
 */
const NS = process.env.SURREALDB_NAMESPACE || "activity-system";
const DB = process.env.SURREALDB_DATABASE || "learning_loop";
const PASS = process.env.SURREAL_PASS || process.env.SURREALDB_PASSWORD || "";
const USER = process.env.SURREALDB_USERNAME || "root";
const SQL_URL = (process.env.SURREALDB_URL || "http://127.0.0.1:8000").replace(/\/$/, "") + "/sql";
const API = (process.env.METABOB_ENDPOINT || "http://127.0.0.1:8080").replace(/\/$/, "");
const GOAL_HOST = (process.env.GOAL_HOST_VESSEL_ENDPOINT || "http://127.0.0.1:8210").replace(/\/$/, "");
const KEY = process.env.METABOB_API_KEY || "";
const sqlAuth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
const LOG = "/workspace/metrics/teaching-loop.jsonl";

const HUB = ["validator-dispatch", "slot-binding"];
const isHub = (s: string) => HUB.some((h) => (s || "").includes(h));
const isSynthetic = (s: string) => /probe/.test(s || "");
const plainName = (id: string) => (id || "").replace(/^activity:⟨/, "").replace(/⟩$/, "");

async function sql(q: string): Promise<any[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(SQL_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Surreal-NS": NS, "Surreal-DB": DB, Authorization: sqlAuth, "Content-Type": "text/plain" },
        body: q,
      });
      const text = await r.text();
      if (!text.trim()) throw new Error("empty body");
      const j = JSON.parse(text);
      const last = j[j.length - 1];
      if (last && last.status && last.status !== "OK") throw new Error("sql err: " + JSON.stringify(last).slice(0, 200));
      return j.map((s: any) => s.result);
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
    }
  }
  return [];
}

async function log(rec: Record<string, unknown>) {
  try {
    const line = JSON.stringify(rec) + "\n";
    const prev = (await Bun.file(LOG).exists()) ? await Bun.file(LOG).text() : "";
    await Bun.write(LOG, prev + line);
  } catch { /* tolerant */ }
}

const stamp = () => new Date().toISOString();

// 1) Real (non-hub, non-probe, non-proposed) activities with declared shapes.
const [acts] = await sql(`SELECT id, input_shapes, output_shapes FROM activity WHERE proposed != true LIMIT 3000;`);
const real = (acts || []).filter((a: any) => a.id && !isHub(a.id) && !isSynthetic(a.id));

// 2) Reliably-succeeding activities over the last 24h (≥1 success).
const since = new Date(Date.now() - 24 * 3600_000).toISOString();
const [succRows] = await sql(`SELECT activity_id, count() AS ok FROM activity_execution_traces WHERE executed_at >= type::datetime("${since}") AND success = true GROUP BY activity_id;`);
const succeeds = new Set<string>((succRows || []).filter((r: any) => (r.ok ?? 0) > 0).map((r: any) => r.activity_id));

// 3) Chainable pairs, BOTH reliably succeeding, distinct.
//    STRICT: producer.output_shape ∈ consumer.input_shapes (pool-level continuity).
//    RELAXED (operator principle "the system may not always have an ideal shape mapping
//    — try with what it has"): a producer that emits SOME output paired with another
//    reliable activity — they chain through ENVIRONMENT state (e.g. concept-usage writes
//    usage records that concept-relevance reads via concept-db), not the impulse pool.
//    Strict first (better signal); relaxed fills the long tail so exploration doesn't
//    stall at zero — the substrate learns from the outcome which couplings are real.
type Pair = { producer: string; consumer: string; shape: string; strict: boolean };
const strict: Pair[] = [], relaxed: Pair[] = [];
const reliable = real.filter((a: any) => succeeds.has(a.id));
for (const p of reliable) {
  for (const c of reliable) {
    if (c.id === p.id) continue;
    const shared = (p.output_shapes || []).find((s: string) => (c.input_shapes || []).includes(s));
    if (shared) strict.push({ producer: p.id, consumer: c.id, shape: shared, strict: true });
    else if ((p.output_shapes || []).length) relaxed.push({ producer: p.id, consumer: c.id, shape: (p.output_shapes || [])[0], strict: false });
  }
}
const pairs: Pair[] = [...strict, ...relaxed];

// 4) Existing composite ids, so we don't re-author. A composite is any activity whose
//    tasks dispatch other activities via resolver "activity" (excluding the probe).
const [existing] = await sql(`SELECT id, tasks FROM activity WHERE proposed != true LIMIT 3000;`);
const composedTargets = new Set<string>();
const existingCompositeIds = new Set<string>();
for (const a of existing || []) {
  const tasks = a.tasks || [];
  // Recognise the genuine activities-as-resolver form (resolver = a template id, i.e.
  // contains "activity:"/"⟨"), the resolver:"compose"+subActivityId form, and the legacy
  // resolver:"activity"+config.templateId form, so we don't re-author. (2026-06-26)
  const looksLikeTemplateId = (s: any) => typeof s === "string" && (s.includes("activity:") || s.includes("⟨"));
  const dispatched = tasks
    .filter((t: any) => looksLikeTemplateId(t.resolver) || (t.resolver === "compose" && t.subActivityId) || (t.resolver === "activity" && t.config?.templateId))
    .map((t: any) => (looksLikeTemplateId(t.resolver) ? t.resolver : t.subActivityId ?? t.config?.templateId));
  if (dispatched.length && !isSynthetic(a.id)) {
    existingCompositeIds.add(a.id);
    composedTargets.add(dispatched.sort().join("|"));
  }
}

// Prefer teaching a NEW chain (distinct organic edge → lowers star_ratio, grows topology);
// fall back to reinforcing an existing successful composite (grows execution_count +
// Thompson credit + successful-organic-edge weight). Cap distinct composites so the
// registry doesn't bloat — past the cap, exploration shifts to reinforcement.
const MAX_COMPOSITES = Number(process.env.COMPOSE_TEACHER_MAX ?? 40);
const underCap = existingCompositeIds.size < MAX_COMPOSITES;
const uncomposed = (p: Pair) => !composedTargets.has([p.producer, p.consumer].sort().join("|"));
// Target headroom: prefer cross-linking LEAF capabilities (neither endpoint is itself a
// composite) — that converts degree-1 pendants (which pin λ₂ low) into cross-linked
// nodes, and prefer STRICT (real shape) chains over relaxed. Only compose composites
// once leaf pairs are exhausted. Ordering: strict-leaf → relaxed-leaf → strict → relaxed.
const isComposite = (id: string) => existingCompositeIds.has(id);
const leafPair = (p: Pair) => !isComposite(p.producer) && !isComposite(p.consumer);
const rank = (p: Pair) => (leafPair(p) ? 0 : 2) + (p.strict ? 0 : 1);
const ordered = underCap ? pairs.filter(uncomposed).sort((a, b) => rank(a) - rank(b)) : [];
const fresh = ordered[0];

async function dispatch(targetTemplateId: string, goal: string): Promise<any> {
  const r = await fetch(`${GOAL_HOST}/run-goal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${KEY}` },
    body: JSON.stringify({ goal, targetTemplateId }),
  });
  return r.ok ? r.json() : { status: "dispatch_failed", http: r.status };
}

let action: string, compositeId: string, result: any;

if (fresh) {
  // Author a new composite chaining the fresh pair (idempotent UPSERT).
  compositeId = `compose-${plainName(fresh.producer)}-to-${plainName(fresh.consumer)}`.slice(0, 80);
  const body = {
    id: compositeId,
    name: `Compose ${plainName(fresh.producer)} → ${plainName(fresh.consumer)} (organic)`,
    description: `Substrate-authored composite: chain real capability ${fresh.producer} (produces ${fresh.shape}) into ${fresh.consumer} (consumes ${fresh.shape}). Continuity of state flows producer→consumer; produces an organic non-hub composition edge as a side-effect of real work.`,
    tags: ["meta", "composition", "organic.edge", "substrate.authored"],
    input_shapes: [],
    output_shapes: [fresh.shape],
    proposed: false,
    // GENUINE producer→consumer composite (2026-06-26). Earlier this authored two
    // SIBLING `resolver:"activity"` dispatches with NO data-flow link between them — the
    // consumer never referenced the producer, so consumed_from_task_ids stayed empty and
    // childActivityId was not reliably set, meaning composition-edge-reconcile derived only
    // wrapper→child star spokes, NEVER a producer→consumer edge (the wrapper-scaffold trap).
    // The correct form (per ias-executor engine.ts compose contract + the Option-B
    // provenance path in composition-edge-reconcile §2b):
    //   • resolver:"compose" + subActivityId  → records childActivityId = the dispatched template
    //   • consumer config references {{dispatch_producer_<shape>}}  → the engine's placeholder
    //     scan sets consumedFromTaskIds=["dispatch_producer"] (producer task projected that
    //     shape key into producerTaskOf when it ran)
    //   • declared input/output shapes  → ALSO lets the composition_chain shape-flow path fire
    // Reconcile then emits the genuine edge fresh.producer → fresh.consumer.
    // ACTIVITIES-AS-RESOLVER form (engine.ts:384-388): the sub-activity template id goes
    // in the `resolver` field itself (a core, persisted task field). resolver:"compose" +
    // subActivityId does NOT survive the activity-api template write (subActivityId is
    // dropped → null → compose throws), but resolver:<templateId> persists and the engine
    // dispatches it as compose, setting childActivityId = the dispatched template. The
    // consumer references {{dispatch_producer_<shape>}} so the engine's placeholder scan
    // sets consumedFromTaskIds=["dispatch_producer"] → reconcile §2b Option-B emits the
    // genuine producer→consumer edge. Declared in/out shapes also enable the shape-flow
    // path. (2026-06-26)
    tasks: [
      { id: "dispatch_producer", description: `Run ${fresh.producer} to produce ${fresh.shape}.`, resolver: fresh.producer, outputShapes: [fresh.shape], config: { reason: "composition step 1: produce " + fresh.shape } },
      { id: "dispatch_consumer", description: `Run ${fresh.consumer} consuming ${fresh.shape} produced upstream.`, resolver: fresh.consumer, inputShapes: [fresh.shape], config: { reason: "composition step 2: consume " + fresh.shape, upstream: `{{dispatch_producer_${fresh.shape}}}` } },
    ],
  };
  const reg = await fetch(`${API}/v2/activities/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${KEY}` },
    body: JSON.stringify(body),
  });
  action = reg.ok ? "authored_and_dispatched_new_chain" : "author_failed";
  if (reg.ok) result = await dispatch(`activity:⟨${compositeId}⟩`, body.description);
  else result = { status: "author_failed", http: reg.status, detail: (await reg.text()).slice(0, 200) };
} else if (existingCompositeIds.size) {
  // Reinforce: round-robin over existing composites by tick (deterministic via minute).
  const ids = [...existingCompositeIds].sort();
  compositeId = ids[Math.floor(Date.now() / 60000) % ids.length]!;
  action = "reinforced_existing_composite";
  result = await dispatch(compositeId, `Reinforce composition ${compositeId}`);
} else {
  compositeId = "(none)";
  action = "no_chainable_pair_found";
  result = { status: "noop" };
}

// 5) Observe + record the becoming.
let star_ratio: number | null = null, headroom: number | null = null;
try {
  const sg = (await Bun.file("/workspace/metrics/spectral-gap.jsonl").text()).trim().split("\n").filter(Boolean);
  const last = JSON.parse(sg[sg.length - 1]!);
  star_ratio = last.star_ratio ?? null;
  if (typeof last.fiedler_lambda2 === "number" && typeof last.star_ratio === "number") {
    headroom = Math.round(last.fiedler_lambda2 * (1 - last.star_ratio) * 1e4) / 1e4;
  }
} catch { /* spectral not ready */ }

const rec = {
  at: stamp(), action, composite: compositeId,
  execution_id: result?.executionId ?? null, outcome: result?.status ?? null,
  chainable_pairs_available: pairs.length, existing_composites: existingCompositeIds.size,
  star_ratio, headroom, unlock_at: 0.35,
};
await log(rec);
console.log(JSON.stringify(rec));
