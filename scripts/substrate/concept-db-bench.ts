#!/usr/bin/env bun
/**
 * concept-db-bench.ts — investigation + benchmarking harness for concept-db.
 *
 * Runs against ANY concept-db instance (probe container, local, hub) — point it
 * with CDB=http://host:port. Phases are subcommands so runs are composable and
 * safe to repeat; every phase emits one JSON result object to stdout (and
 * appends to OUT if set) so runs are comparable across instances and time.
 *
 *   bun run concept-db-bench.ts vitals            # health, counts, index/migration state
 *   bun run concept-db-bench.ts shapes            # resolve every advertised shape; detect drift
 *   bun run concept-db-bench.ts seed N            # seed N synthetic concepts (idempotent per run-tag)
 *   bun run concept-db-bench.ts bench-embed       # embed latency 1/8/32 texts
 *   bun run concept-db-bench.ts bench-search      # BM25 / dense / hybrid latency at current corpus size
 *   bun run concept-db-bench.ts bench-graph       # neighbors depth 1-2, select-for-prompt style reads
 *   bun run concept-db-bench.ts bench-upkeep      # trigger each upkeep activity, time + effect
 *   bun run concept-db-bench.ts impulse-growth    # impulse-table accumulation (pruneExpiredImpulses gap)
 *   bun run concept-db-bench.ts loop-probe        # usage->relevance learning-loop roundtrip
 *   bun run concept-db-bench.ts all               # vitals shapes bench-embed bench-search bench-graph
 *
 * Methodology notes live beside each phase. Scaling runs: seed 100 → bench-search,
 * seed 400 more → bench-search, … the dense path is a documented O(n) scan; the
 * curve makes the cost visible instead of anecdotal.
 */

const CDB = process.env.CDB ?? "http://localhost:43260";
const OUT = process.env.OUT ?? "";
const TAG = process.env.RUN_TAG ?? "cdb-bench";

type J = Record<string, unknown>;

async function http(method: string, path: string, body?: unknown, timeoutMs = 30000): Promise<{ ms: number; status: number; json: any }> {
  const t0 = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${CDB}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const ms = performance.now() - t0;
    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    return { ms, status: res.status, json };
  } catch (e: any) {
    return { ms: performance.now() - t0, status: 0, json: { transport_error: String(e?.message ?? e) } };
  } finally {
    clearTimeout(timer);
  }
}

const resolve = (pointer: J, timeoutMs?: number) => http("POST", "/v2/impulses/resolve", { pointer }, timeoutMs);

function stats(samples: number[]): J {
  const s = [...samples].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    n: s.length,
    p50_ms: +q(0.5).toFixed(1),
    p90_ms: +q(0.9).toFixed(1),
    max_ms: +s[s.length - 1].toFixed(1),
    mean_ms: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1),
  };
}

async function repeat(n: number, fn: () => Promise<{ ms: number; status: number }>): Promise<{ latency: J; errors: number }> {
  const lat: number[] = [];
  let errors = 0;
  for (let i = 0; i < n; i++) {
    const r = await fn();
    if (r.status >= 200 && r.status < 300) lat.push(r.ms);
    else errors++;
  }
  return { latency: lat.length ? stats(lat) : { n: 0 }, errors };
}

// ---------- corpus generator: varied, deterministic, embeddable prose ----------
const TOPICS = [
  "impulse routing over shape metadata", "thompson sampling posterior updates", "vessel discovery registration heartbeat",
  "trace extraction into reusable templates", "goal walk backward chaining", "relevance decay for stale knowledge",
  "libp2p federation transport relay", "surrealdb permissions token org isolation", "bm25 full text scoring",
  "dense embedding cosine similarity search", "concept graph edge traversal", "upkeep scheduler activity selection",
];
function synthConcept(i: number): J {
  const t = TOPICS[i % TOPICS.length];
  const long = i % 17 === 0; // some oversized bodies so split-long-concept has candidates
  const body = `[${TAG} ${i}] Notes on ${t}. ` +
    `Instance ${i} discusses ${t} in the context of substrate self-development, iteration ${i % 7}. ` +
    ("The mechanism binds data flow shape to shape and records the outcome in a trace. ".repeat(long ? 120 : 3));
  return {
    source_type: "memo",
    shape: "bench_note",
    content: body,
    summary: `${TAG} ${i}: ${t}`,
    priority: (i % 10) / 10,
  };
}

// ---------- phases ----------
const phases: Record<string, (args: string[]) => Promise<J>> = {

  // What: single source of truth for instance state before/after any experiment.
  // Why: every benchmark result is meaningless without corpus size + index state alongside it.
  async vitals() {
    const health = await http("GET", "/health");
    const counts: J = {};
    {
      let total = 0;
      for (let off = 0; ; off += 500) {
        const page = (await http("GET", `/concepts/search?limit=500&offset=${off}`)).json?.concepts?.length ?? 0;
        total += page;
        if (page < 500) break;
      }
      counts.concepts = total;
    }
    // impulse-table + edge counts via shapes (no direct SQL from outside)
    const edges = await resolve({ type: "impulseCooccurrenceEdges", limit: 1 });
    const upkeep = await http("GET", "/upkeep/status");
    return {
      health_ms: +health.ms.toFixed(1),
      health: health.json,
      counts,
      cooccurrence_probe_status: edges.status,
      upkeep: {
        running: upkeep.json?.running,
        interval_ms: upkeep.json?.interval_ms,
        arms: (upkeep.json?.activity_summary ?? []).map((a: any) => ({ id: a.id, ev: a.expectedValue, trials: a.totalTrials })),
      },
    };
  },

  // What: resolve one representative pointer per advertised shape + the known handled-but-unlisted ones.
  // Why: catches SUPPORTED_SHAPES drift (conceptSearch class) and envelope regressions mechanically —
  // this is the deterministic per-commit check the class question asks for.
  async shapes() {
    const probes: Array<[string, J]> = [
      ["concept", { type: "concept", query: "substrate", limit: 1 }],
      ["conceptGraph", { type: "conceptGraph", concept_id: "nonexistent" }],
      ["conceptSearch", { type: "conceptSearch", query: "substrate", limit: 1 }],
      ["relatedConcepts", { type: "relatedConcepts", concept_id: "nonexistent" }],
      ["conceptUsageStats", { type: "conceptUsageStats", concept_id: "nonexistent" }],
      ["conceptSequence", { type: "conceptSequence", concept_id: "nonexistent" }],
      ["impulseSignatureConcept", { type: "impulseSignatureConcept", pointer_type: "bench", shape: "bench_note" }],
      ["impulseCooccurrenceEdges", { type: "impulseCooccurrenceEdges", limit: 1 }],
      ["mcpTool", { type: "mcpTool", context: { goal_keywords: ["search"] }, limit: 1 }],
      ["embed", { type: "embed", text: "shape drift probe" }],
      ["cluster", { type: "cluster", items: [{ id: "a", text: "alpha" }, { id: "b", text: "beta" }] }],
      ["concept_write", { type: "concept_write", source_type: "memo", content: `[${TAG}] shape-probe write`, summary: `${TAG} shape probe`, shape: "bench_note" }],
      ["conceptCreditDecontaminate_write", { type: "conceptCreditDecontaminate_write", dry_run: true }],
    ];
    const results: J = {};
    for (const [name, ptr] of probes) {
      const r = await resolve(ptr);
      results[name] = {
        status: r.status,
        ms: +r.ms.toFixed(1),
        rejected_as_unknown: typeof r.json?.error === "string" && r.json.error.includes("Unknown impulse shape"),
      };
    }
    return { probes: results };
  },

  async seed(args) {
    const n = parseInt(args[0] ?? "100", 10);
    const t0 = performance.now();
    let ok = 0, failed = 0;
    const lat: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = await resolve({ type: "concept_write", ...synthConcept(i) });
      if (r.status >= 200 && r.status < 300 && !r.json?.error) { ok++; lat.push(r.ms); } else failed++;
    }
    return { requested: n, ok, failed, write_latency: stats(lat), wall_s: +((performance.now() - t0) / 1000).toFixed(1) };
  },

  // Why: embedding is in-process ONNX with a Promise.all pseudo-batch — serial cost
  // should show linearly in the "batch" numbers if batching is fake.
  async "bench-embed"() {
    const text = "The walk binds data flow shape to shape and lands a trace.";
    const single = await repeat(10, () => resolve({ type: "embed", text }));
    const batch8 = await repeat(5, () => resolve({ type: "embed", texts: Array(8).fill(text) }));
    const batch32 = await repeat(3, () => resolve({ type: "embed", texts: Array(32).fill(text) }));
    return { single, batch8, batch32 };
  },

  // Why: dense path is a documented O(n) full-scan; hybrid = BM25 + dense + RRF.
  // Run this after each seed increment to draw the scaling curve.
  async "bench-search"() {
    // /concepts/search's `count` echoes the returned page, not the table total — paginate for truth
    let corpus = 0;
    for (let off = 0; ; off += 500) {
      const page = (await http("GET", `/concepts/search?limit=500&offset=${off}`)).json?.concepts?.length ?? 0;
      corpus += page;
      if (page < 500) break;
    }
    const queries = ["thompson sampling posterior", "federation relay transport", "relevance decay stale"];
    const perQuery: J = {};
    for (const q of queries) {
      // REST search (hybrid path)
      const hybrid = await repeat(5, () => http("GET", `/concepts/search?query=${encodeURIComponent(q)}&limit=10`));
      // resolve-path search (concept shape falls through to search)
      const viaResolve = await repeat(5, () => resolve({ type: "concept", query: q, limit: 10 }));
      perQuery[q] = { hybrid, viaResolve };
    }
    // no-query listing (pure scalar-index path) as control
    const listing = await repeat(5, () => http("GET", "/concepts/search?source_type=memo&limit=10"));
    return { corpus_size: corpus, perQuery, listing };
  },

  async "bench-graph"() {
    // pick real ids from the bench corpus
    const list = await http("GET", "/concepts/search?source_type=memo&limit=20");
    const ids: string[] = (list.json?.concepts ?? []).map((c: any) => String(c.id).replace(/^concept:/, ""));
    if (ids.length < 5) return { error: "need >=5 bench concepts; run seed first" };
    // build a small ring of edges so traversal has something to walk
    let linked = 0;
    for (let i = 0; i < Math.min(ids.length, 10); i++) {
      const r = await resolve({ type: "conceptLink_write", linkData: { from_concept_id: ids[i], to_concept_id: ids[(i + 1) % ids.length], edge_type: "related_to", weight: 0.6 } });
      if (r.status < 300) linked++;
    }
    const neighbors = await repeat(10, () => http("GET", `/concepts/${ids[0]}/neighbors`));
    const graphResolve = await repeat(10, () => resolve({ type: "conceptGraph", concept_id: ids[0], limit: 20 }));
    const deepResolve = await repeat(5, () => http("POST", `/concepts/${ids[0]}/resolve`, { include_neighbors: true, neighbor_depth: 2 }));
    return { linked, neighbors, graphResolve, deepResolve };
  },

  // Why: the six upkeep arms run inline candidate queries (unindexed predicates,
  // correlated subqueries) — timing each trigger at corpus scale prices the 5-min
  // cycle and shows which arms are load risks on a big store.
  async "bench-upkeep"() {
    const arms = ["split-long-concept", "resolve-island", "adjust-priority-relevance", "prune-irrelevant-neighbors", "decay-stale-relevance", "prune-per-execution-concepts"];
    const results: J = {};
    for (const id of arms) {
      const r = await http("POST", "/upkeep/trigger", { activity_id: id }, 120000);
      results[id] = { status: r.status, ms: +r.ms.toFixed(1), body: r.json };
    }
    return results;
  },

  // Why: pruneExpiredImpulses is written+tested but never scheduled → the impulse
  // table should grow monotonically with resolves and never shrink. This phase
  // measures accumulation per resolve burst.
  async "impulse-growth"(args) {
    const bursts = parseInt(args[0] ?? "3", 10);
    const perBurst = 25;
    const counts: number[] = [];
    const count = async () => {
      // impulse rows aren't directly countable via HTTP; use health db info as a proxy is not exposed —
      // so this phase reports resolve-burst timing and leaves row-count verification to in-container SQL:
      //   docker exec <c> surreal sql ... "SELECT count() FROM impulse GROUP ALL"
      return -1;
    };
    const burstLat: J[] = [];
    for (let b = 0; b < bursts; b++) {
      const r = await repeat(perBurst, () => resolve({ type: "concept", query: "routing", limit: 3 }));
      burstLat.push(r.latency);
      counts.push(await count());
    }
    return { bursts, perBurst, burstLat, note: "verify impulse row growth via in-container SQL; see comment" };
  },

  // Why: the learning loop = usage records → adjust-priority-relevance moves relevance.
  // Roundtrip proves (or disproves) that recorded outcomes actually steer the store.
  async "loop-probe"() {
    const list = await http("GET", "/concepts/search?source_type=memo&limit=3");
    const ids: string[] = (list.json?.concepts ?? []).map((c: any) => String(c.id).replace(/^concept:/, ""));
    if (!ids.length) return { error: "no bench concepts; run seed first" };
    const id = ids[0];
    const before = (await http("GET", `/concepts/${id}`)).json?.concept ?? (await http("GET", `/concepts/${id}`)).json;
    for (let i = 0; i < 8; i++) {
      await resolve({ type: "conceptUsage_write", usageData: { concept_id: id, outcome: "success", trace_id: `${TAG}-trace-${i}` } });
    }
    const trig = await http("POST", "/upkeep/trigger", { activity_id: "adjust-priority-relevance" }, 120000);
    const after = (await http("GET", `/concepts/${id}`)).json?.concept ?? (await http("GET", `/concepts/${id}`)).json;
    return {
      concept: id,
      relevance_before: before?.relevance_score ?? before?.relevance ?? null,
      relevance_after: after?.relevance_score ?? after?.relevance ?? null,
      loaded_before: before?.loaded_count ?? null,
      loaded_after: after?.loaded_count ?? null,
      trigger: { status: trig.status, body: trig.json },
    };
  },
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const run = async (name: string, a: string[] = []) => {
    const fn = phases[name];
    if (!fn) { console.error(`unknown phase ${name}; phases: ${Object.keys(phases).join(", ")}`); process.exit(2); }
    const started = new Date().toISOString();
    const result = await fn(a);
    const record = { phase: name, cdb: CDB, tag: TAG, started, result };
    const line = JSON.stringify(record, null, 2);
    console.log(line);
    if (OUT) await Bun.write(OUT, ((await Bun.file(OUT).exists()) ? await Bun.file(OUT).text() : "") + JSON.stringify(record) + "\n");
  };
  if (!cmd || cmd === "all") {
    for (const p of ["vitals", "shapes", "bench-embed", "bench-search", "bench-graph"]) await run(p);
  } else {
    await run(cmd, args);
  }
}

main();
