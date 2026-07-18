# Investigating and benchmarking concept-db

How to assess a concept-db instance's health, performance, and learning-loop
integrity without disrupting a production substrate. The method is
instance-agnostic: point the harness at any concept-db and compare records
across instances and across time. Probing that mutates state belongs on an
isolated substrate container; only read-only phases run against live systems.

Harness: `scripts/substrate/concept-db-bench.ts` (phases are subcommands;
`CDB=<endpoint>` selects the instance, `OUT=<file>` accumulates JSONL records).

## Principles

- **Never benchmark without vitals.** Every latency number is meaningless
  without corpus size, index inventory, and upkeep-arm posteriors recorded
  alongside it. The `vitals` phase is the first and last step of every run.
- **Probe on an isolated instance, read on live.** A full substrate boots from
  the image with its own volumes (`make up LIVE_NAME=<probe> PORT_OFFSET=<n>`);
  seeding, upkeep triggering, and restart experiments happen there. The live
  system gets only read-only phases (`vitals`, `shapes`, read benchmarks) — the
  database is memory-fragile and ad-hoc write load is how outages start.
- **Scale is the experiment.** The store's cost curves (dense search, upkeep
  candidate queries, backfill) are functions of corpus size. Benchmark at
  stepped corpus sizes (`seed N` → `bench-search`, repeated) and read the
  curve, not a point. A path that is flat with corpus growth is index-backed;
  one that grows linearly is a scan and will eventually take the store down.
- **Trust the running code, not the checkout.** A container runs the code baked
  into its image plus any synced overlays. Before attributing a behavior to
  current source, confirm the running instance actually has it (grep the
  in-container file, or date the relevant commit against the image build).
  Symptoms reproduced on a stale image are findings about deploy lag, not
  about the code.
- **Exercise the loop, not just the endpoints.** A healthy store is one where
  usage records move relevance, upkeep arms do real semantic work, and expired
  rows get pruned. `loop-probe` verifies the first; reading each upkeep arm's
  `execute` body against its reported success verifies the second (an arm that
  always succeeds without changing what its candidate query selects on is
  gaming its own bandit); row-count deltas across resolve bursts verify the
  third.

## Phase map

| Phase | Mutates? | What it answers |
|---|---|---|
| `vitals` | no | health latency, corpus size, upkeep arms + posteriors |
| `shapes` | writes 1 probe concept | does every advertised shape resolve; drift between discovery list, dispatch cases, and error-message list |
| `seed N` | yes | write latency/throughput; builds the stepped corpus |
| `bench-embed` | no | embedding latency; whether batching is real (linear growth with batch size = serial execution) |
| `bench-search` | no | hybrid/BM25/dense latency at current corpus size; pair with `seed` steps for the scaling curve |
| `bench-graph` | writes edges | traversal latency at depth 1–2 |
| `bench-upkeep` | yes | per-cycle upkeep cost; which arms find candidates; whether reported success matches semantic work |
| `loop-probe` | yes | usage → relevance roundtrip (the learning loop's read-side) |
| `impulse-growth` | yes | impulse-row accumulation per resolve burst (pruning liveness) |

In-container ground truth (probe instances only): row counts and index
inventory come from SurrealDB directly, since HTTP surfaces paginate and cache —
`INFO FOR TABLE concept` for indexes, `SELECT count() FROM impulse WHERE
expires_at < time::now() GROUP ALL` for prune liveness.

## Standing checks worth automating

These are the classes this method has caught; each is a candidate for a
substrate activity that detects it without an operator:

- **Shape drift**: a shape advertised to discovery but rejected by the resolve
  dispatcher (or listed in an error message but absent from dispatch). The
  `shapes` phase is the deterministic per-commit check.
- **Scan regression**: dense or upkeep queries whose latency grows linearly
  with corpus size. The stepped `bench-search` curve is the detector; the fix
  pattern is an index plus an index-backed operator, verified by re-running the
  same curve.
- **Hollow upkeep arm**: an arm whose `execute` reports success while doing no
  semantic work, or whose effect removes its own candidates without achieving
  the arm's stated purpose. Detected by diffing reported changes against the
  arm's description, not by reading its success rate — the success rate is
  exactly what the hollowness inflates.
- **Prune liveness**: any table with an `expires_at` should have a scheduled
  deleter, and the fraction of expired rows is the health metric (near-100%
  expired means the deleter never runs).
- **Fake batching**: batch endpoints whose cost is linear in batch size.
- **Per-hop table scan**: graph traversal whose neighbor hydration filters on a
  computed expression (`meta::id(id) IN …`) instead of direct record lookups —
  cost is O(corpus) per hop and shows up as slow `neighbors`/`conceptGraph`
  reads that worsen as the store grows.
- **Concurrency collapse**: the vessel processes requests as a single queue, so
  N parallel searches multiply every caller's latency by ~N and drag `/health`
  with them. This is the mechanism behind health-observer flapping: an observer
  with a timeout probing a vessel under search load reads "down" for a vessel
  that is merely busy. Detect by running the health probe during a parallel
  search burst; fix classes are embed/query offload, load shedding, or a
  health path that bypasses the work queue.
- **Silent ranking degradation**: a scoring path whose primary signal is dead
  (BM25 IDF not persisted by the DB → all-zero scores) and whose fallback runs
  on every query. The warning log is the detector; the point is that "search
  works" can hide "search ranks by a crude proxy and pays extra CPU for it".
- **Dropped write fields**: a write shape that silently discards caller fields
  (e.g. `shape` on the from-source path) — detected by writing with a
  distinctive field value and reading it back, which the `shapes`/`seed`
  phases do implicitly when ground truth is checked in-container.
- **Empty constitutional store**: a fresh substrate must not boot with zero
  concepts if the ontology expects constitutional knowledge at walk time;
  seeding must be part of bootstrap, not host-side tooling (verify it ran, and
  when).
