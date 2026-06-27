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
//    `tasks` is fetched too so we can detect GOAL-SEEDED head producers (2026-06-26):
//    a producer whose input is extracted from the goal TEXT (goal_file_extract over
//    {{goal}}, problem_detection / source_code / code_quality on goal-derived file
//    paths) emits nothing real when dispatched cold with a goal that names no file —
//    THE hollow-composite root cause. We seed those heads with a concrete repo file
//    path at dispatch time so the head actually runs and real output flows downstream.
const [acts] = await sql(`SELECT id, input_shapes, output_shapes, tasks FROM activity WHERE proposed != true LIMIT 3000;`);
const real = (acts || []).filter((a: any) => a.id && !isHub(a.id) && !isSynthetic(a.id));
const actById = new Map<string, any>((real || []).map((a: any) => [a.id, a]));

// GOAL-SEEDED head detection (2026-06-26). A producer is "goal-seeded" if its work
// derives from a file path embedded in the goal text — i.e. it has a goal_file_extract
// task, or a task that reads file paths / source / quality from {{goal}} or
// {{impulse:goal_files}}. Cold-dispatched with a path-less goal these ENOENT and emit
// only "missing file" output → the reach-gate judges the chain HOLLOW. Detect by task
// resolvers + config strings; tolerant of missing tasks (treated as not goal-seeded).
const GOAL_FILE_RESOLVERS = ["goal_file_extract", "problem_detection", "source_code", "code_quality"];
const isGoalSeededHead = (activityId: string): boolean => {
  try {
    const a = actById.get(activityId);
    const tasks = (a?.tasks || []) as any[];
    if ((a?.input_shapes || []).includes("goal")) {
      // input is the goal itself + at least one file-deriving task ⇒ goal-seeded.
      if (tasks.some((t) => GOAL_FILE_RESOLVERS.includes(String(t?.resolver || "")))) return true;
    }
    // Or any task binds a file path off the goal text directly.
    return tasks.some((t) => {
      const cfg = JSON.stringify(t?.config || {});
      return /\{\{\s*(impulse:)?goal/.test(cfg) && /file|path|source/i.test(cfg);
    });
  } catch { return false; }
};

// 2) Reliably-succeeding activities over the last 24h (≥1 success).
const since = new Date(Date.now() - 24 * 3600_000).toISOString();
const [succRows] = await sql(`SELECT activity_id, count() AS ok FROM activity_execution_traces WHERE executed_at >= type::datetime("${since}") AND success = true GROUP BY activity_id;`);
const succeeds = new Set<string>((succRows || []).filter((r: any) => (r.ok ?? 0) > 0).map((r: any) => r.activity_id));

// 2b) PRODUCER VIABILITY (2026-06-26, hollow-composite root cause). compose-teacher
//     used to select producer→consumer pairs PURELY by declared-shape compatibility: a
//     producer that DECLARES output_shape S paired with a consumer that consumes S. But
//     many producers (e.g. analyze-source-to-concept) need external files supplied
//     upstream; from a cold start their input is empty (filePaths empty → ENOENT /
//     read_error) so they emit NO real output — the bridge shape never flows, the chain
//     is judged HOLLOW by the reach-gate, β-penalised, and no genuine λ₁-lifting edge is
//     recorded. Declaring S ≠ being able to PRODUCE S from a cold start.
//     Fix: only treat a producer as viable for shape S if it has a recent SUCCESSFUL
//     standalone trace that ACTUALLY produced S (output_impulse_shapes CONTAINS S,
//     status=success). Key the viability set by `${activity_id}|${shape}`. Tolerant: on
//     query failure, leave the set null and skip the filter (degrade to old behaviour).
const VIABILITY_WINDOW_H = Number(process.env.COMPOSE_TEACHER_VIABILITY_WINDOW_H ?? 72);
let producible: Set<string> | null = null; // `${activity_id}|${shape}` of really-produced shapes
try {
  const vSince = new Date(Date.now() - VIABILITY_WINDOW_H * 3600_000).toISOString();
  const [prodRows] = await sql(`SELECT activity_id, output_impulse_shapes FROM activity_execution_traces WHERE executed_at >= type::datetime("${vSince}") AND success = true AND output_impulse_shapes != NONE AND array::len(output_impulse_shapes) > 0 LIMIT 8000;`);
  const set = new Set<string>();
  for (const r of prodRows || []) {
    const aid = r.activity_id;
    if (!aid) continue;
    for (const s of r.output_impulse_shapes || []) if (s) set.add(`${aid}|${s}`);
  }
  producible = set; // may legitimately be empty; the filter falls back gracefully below
} catch { producible = null; /* tolerant: degrade to declared-shape-only selection */ }
// A producer is viable for the bridge shape iff it really produced that shape recently.
// When the viability set is unavailable (null) we cannot judge, so we don't filter.
const producesShape = (activityId: string, shape: string) =>
  producible === null ? true : producible.has(`${activityId}|${shape}`);

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

// Component map over the GENUINE capability graph (union-find on non-hub, non-synthetic
// edges), so we PREFER cross-component pairs. A fragmented genuine graph has λ₂=0 ⇒
// stability_headroom NEGATIVE (sub-critical, SUBSTRATE_AS_DYNAMICS.md §3); BRIDGING two
// components is the single highest-leverage move to lift λ₂ off zero. Within-component
// edges only thicken an already-connected blob and don't change connectivity. (2026-06-26)
const parent = new Map<string, string>();
const find = (x: string): string => { let r = x; while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
try {
  // CRITICAL (2026-06-27): union ONLY over edges tagged edge_kind="genuine" — the SAME
  // definition spectral-gap.ts uses for its genuine-component count. Previously this
  // unioned over ALL non-hub/non-synthetic edges, which INCLUDED the 333 `scaffold`
  // wrapper-spoke edges (compose-* dispatch parentage). Those scaffold spokes
  // artificially fuse every capability into one blob, so bridges() saw a fully-connected
  // graph and NEVER fired (rank-0 bridge tier was empty) — compose-teacher kept authoring
  // WITHIN the giant component and genuine.components stayed pinned at 5. Filtering to
  // edge_kind="genuine" makes this union-find match the REAL fragmentation spectral-gap
  // measures (1 giant comp + 4 small fragments), so bridges() now targets a producer in
  // one genuine component and a consumer in another — the only move that drops components.
  const [gedges] = await sql(`SELECT parent_activity_id, child_activity_id FROM activity_composition_graph WHERE edge_kind = "genuine" LIMIT 8000;`);
  for (const e of gedges || []) {
    const p = String(e.parent_activity_id), c = String(e.child_activity_id);
    if (isHub(p) || isHub(c) || isSynthetic(p) || isSynthetic(c)) continue; // belt-and-suspenders
    if (!parent.has(p)) parent.set(p, p);
    if (!parent.has(c)) parent.set(c, c);
    union(p, c);
  }
} catch { /* tolerant: if the edge read fails, bridging degrades to leaf/strict ordering */ }
const comp = (id: string): string => (parent.has(id) ? find(id) : `solo:${id}`);
const bridges = (p: Pair) => comp(p.producer) !== comp(p.consumer); // spans two genuine components (or pulls in an isolated node)

// COLD-RUNNABLE HEAD (2026-06-26, hollow-composite fix). A composite's head producer
// runs at dispatch time with goal = the composite description (no caller-supplied
// impulses). For the head to emit REAL output its work must NOT depend on external
// files we don't provide. Two head classes run cold successfully:
//   (a) SELF-SOURCING — input_shapes empty (or no file dependency): output derives from
//       substrate-internal state (observers/ticks/state-readers). Runs cold as-is.
//   (b) GOAL-SEEDED — derives a file path from the goal text; runs cold IFF we seed the
//       dispatched goal with a concrete real repo file path (engine.ts:1040 makes the
//       goal text the {{goal}} variable, propagated to the child via opts.variables at
//       engine.ts:1119, so goal_file_extract picks it up). We CAN seed these.
// A head we CANNOT make run cold (needs a caller-supplied impulse other than goal) is
// the hollow trap. Pick a real seed file that exists in the container.
const SEED_FILES = [
  "/vessels/local-tools-vessel/src/index.ts",
  "/vessels/discovery-vessel/src/index.ts",
  "/vessels/goal-host-vessel/src/index.ts",
];
let SEED_FILE = SEED_FILES[0]!;
for (const f of SEED_FILES) { try { if (await Bun.file(f).exists()) { SEED_FILE = f; break; } } catch { /* tolerant */ } }
const isSelfSourcing = (activityId: string): boolean => {
  const a = actById.get(activityId);
  const ins = (a?.input_shapes || []) as string[];
  // No declared inputs, or only goal — and NOT a file-deriving head ⇒ self-sourcing.
  return (ins.length === 0 || (ins.length === 1 && ins[0] === "goal")) && !isGoalSeededHead(activityId);
};
// A head is cold-runnable iff it self-sources OR is a goal-seeded head we can seed.
const coldRunnableHead = (p: Pair) => isSelfSourcing(p.producer) || isGoalSeededHead(p.producer);

// Ranking (lower = selected first): BRIDGE a component gap first, then prefer a
// COLD-RUNNABLE head (self-sourcing or seedable — this is what stops the head running
// empty and the chain going hollow), then leaf endpoints, then strict over relaxed.
const rank = (p: Pair) =>
  (bridges(p) ? 0 : 8) + (coldRunnableHead(p) ? 0 : 4) + (leafPair(p) ? 0 : 2) + (p.strict ? 0 : 1);
// VIABILITY FILTER (2026-06-26): restrict candidates to pairs whose PRODUCER demonstrably
// produced the bridge shape in a recent successful standalone trace — this is what stops
// the substrate from authoring composites around producers that ENOENT from a cold start
// (the hollow-composite root cause). The filter runs BEFORE the bridge/leaf/strict sort,
// so the existing ranking applies to the surviving viable pairs. If it empties the list
// (too few producers have real output traces), degrade to the unfiltered candidates so
// authoring never wholly stalls — the reach-gate still penalises any hollow result.
const candidates = underCap ? pairs.filter(uncomposed) : [];
const viableCandidates = candidates.filter((p) => producesShape(p.producer, p.shape));
const usedFallback = viableCandidates.length === 0 && candidates.length > 0;
const ordered = (usedFallback ? candidates : viableCandidates).sort((a, b) => rank(a) - rank(b));
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
let head_seeded = false, head_cold_runnable: boolean | null = null, seed_file: string | null = null;

if (fresh) {
  head_cold_runnable = coldRunnableHead(fresh);
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
  // SEED the dispatched goal (2026-06-26). If the head producer is goal-seeded — it
  // pulls a file path out of the goal text — embed a concrete real repo file path so
  // goal_file_extract / problem_detection run on a REAL file and emit real output,
  // which then flows producer→consumer (non-hollow). Self-sourcing heads need no seed.
  // The seed is appended to the composite description so existing reach/recommend logic
  // still sees what the composite is for. (engine.ts:1040 → {{goal}}; :1119 → child.)
  const seedHead = isGoalSeededHead(fresh.producer);
  head_seeded = seedHead;
  seed_file = seedHead ? SEED_FILE : null;
  const dispatchGoal = seedHead
    ? `${body.description}\n\nAnalyze the source file ${SEED_FILE} and produce ${fresh.shape} from it, then feed that into ${fresh.consumer}.`
    : body.description;
  const reg = await fetch(`${API}/v2/activities/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiKey ${KEY}` },
    body: JSON.stringify(body),
  });
  action = reg.ok ? "authored_and_dispatched_new_chain" : "author_failed";
  if (reg.ok) result = await dispatch(`activity:⟨${compositeId}⟩`, dispatchGoal);
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
  // producer-viability filter visibility (2026-06-26 hollow-composite fix):
  viable_pairs: producible === null ? null : viableCandidates.length,
  producible_pairs: producible === null ? null : producible.size,
  viability_fallback: usedFallback,
  producer_viability: producible === null ? "unavailable" : usedFallback ? "fallback_unfiltered" : "filtered",
  // cold-runnable / seed visibility (2026-06-26 hollow-composite fix):
  head_cold_runnable, head_seeded, seed_file,
  star_ratio, headroom, unlock_at: 0.35,
};
await log(rec);
console.log(JSON.stringify(rec));
