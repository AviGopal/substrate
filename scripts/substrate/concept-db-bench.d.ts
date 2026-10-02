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
export {};
//# sourceMappingURL=concept-db-bench.d.ts.map