#!/usr/bin/env bun
/**
 * auto-describe-resolvers.ts — the substrate DESCRIBES ITS OWN resolvers.
 *
 * THE GAP THIS CLOSES (the last operator/owner-load-bearing item in the
 * decomposition-planner path): the planner (development-vessel
 * author-composed-capability.ts `fetchShapeDescriptions` + `buildResolverCatalogue`)
 * can only MATCH a goal to a resolver that has a one-line DESCRIPTION advertised
 * in discovery's `GET /registry/shape-descriptions`. The fleet advertises ~200
 * shapes but only a handful carry descriptions — the rest are id-only and thus
 * NOT planner-matchable. Filling that in by hand requires the operator or each
 * vessel owner to write a line per resolver. This tick removes that requirement:
 * the substrate generates the missing one-liners itself and POSTs them as LEARNED
 * descriptions to discovery (`POST /registry/shape-descriptions`, source:"auto"),
 * where the planner picks them up automatically. A vessel-ADVERTISED description
 * always WINS over a learned one (advertised = authoritative), so this only ever
 * fills gaps — it never overrides an owner's hand-written line.
 *
 * SAFE BY CONSTRUCTION:
 *  - It NEVER invokes the resolver it is describing (could be destructive/unknown).
 *    Evidence is gathered read-only from the trace store: the shape id itself,
 *    a sample of recent impulse pointers of that shape, and the names/descriptions
 *    of activities that DECLARE the shape as an output_shape.
 *  - It SKIPS write/destructive/lifecycle/internal shapes (only describes
 *    DATA/REPORT/QUERY resolvers — the ones operator goals compose).
 *  - Bounded: at most MAX_PER_TICK shapes per fire, round-robin over the backlog
 *    via a persisted cursor, so it works through the gap over time without flooding.
 *  - NON-FATAL throughout: any LLM / discovery / DB failure → log + skip, never throw.
 *
 * Env-gated: AUTO_DESCRIBE_RESOLVERS=1 to run (anything else = no-op exit).
 * Self-activating: seeded into ${SUBSTRATE_RUN_DIR} at boot, run by the
 * auto-describe-resolvers.timer (~20min cadence).
 */
export {};
//# sourceMappingURL=auto-describe-resolvers.d.ts.map