# Design notes

Two decisions carry the design; both were validated against the live substrate.

## 1. The orphan signal: `live_resolver_shapes − invoked_resolvers`

The orphan is on the **producer** side: a resolver capability that no activity ever
invokes. Compute it directly, not via the consumer-side audit:

- `live_resolver_shapes` ← discovery `GET :8100/registry/shapes` (262 shapes).
- `invoked_resolvers` ← union over all activity templates of every task's
  `resolver_id` / `resolver` / `config.type` (activity-api
  `GET /v2/activities/templates?limit=…`). Measured: 28 distinct.
- Orphan candidates = set difference. Measured: 250.

**Why this separates internal machinery from capability automatically (mostly):** each
internal tick/observer resolver is invoked by *its own* tick template's task, so it
appears in `invoked_resolvers` and drops out of the candidate set. What remains is
dominated by the outward capability surface. The residual internal items
(`concept_db_health_observer`, `signature_cluster_scan`, `vessel_gap_to_cluster`,
`code_needs_report`, …) are removed by the filter below.

`consumer_productivity_audit` answers a different (downstream-consumer) question and is
kept as-is; this detector is its producer-side complement.

## 2. The capability filter (exclude internal machinery, keep capability writes)

A candidate shape `S` is reported as an orphaned capability iff it passes ALL:
- not matched by the internal-machinery regex
  `/(_tick|_observer|_scan|_audit|_report|_registry|_matrix_score)$/`;
- not in the dev-vessel meta set (`substrateGap`, `memoryNote`, `loadAttribution*`,
  `intervention*`, `pick_priority_scenario`, `compute_state_signature`, `dispatch_goal`,
  `boredom_enqueue`, the `*_audit`/`*_observer` already covered, etc. — explicit deny-set);
- not a discovery meta shape (`vessel*`) or activity-api learning/read shape
  (`activity*`, `execution*`, `thompson_*`, `variant*`, `impulseRelevance*`,
  `compositionSuccess`, `preValidationResult`, `templateAuditReport`,
  `*Recommendation`, `*ByMetrics`, `goal`, `discoverByShapesQuery`, `mcpTool`,
  `*_search`, `test_*`, `lift_demo_noop`);
- KEEP capability writes that perform genuine outward mutation
  (`concept_create_write`, `conceptLink_write`, `concept_write`, the `*_write` that map
  to a real resolver) — do NOT blanket-exclude `_write`.

The filter is encoded as data (two regexes + an explicit deny-set + an explicit
keep-set for capability writes) so it is auditable and adjustable without logic changes.
Imperfect classification is non-fatal: emitted gaps are reviewed by the
draft/drain loop, and stable ids prevent spam.

## 3. Emission + dedup (reuse capability_gap_audit's `emitGap` pattern)

Per orphan, POST a `substrateGap_write` to the dev-vessel impulses URL:
```
gap.id        = `orphaned-capability-${shape}`        // stable → upsert, no dupes
gap.category  = "orphaned_capability"
gap.source    = "substrate_detected"
gap.status    = "open"
gap.summary    = `Resolver "${shape}" (vessel ${owner}) is live but invoked by 0 of ${N} activities. Author an activity that invokes it and routes ${shape} onward.`
gap.classification_metadata = {
  detector: "orphaned_capability_scan",
  cite_principle: "substrate_expresses_the_full_capability_surface_it_advertises",
  shape, owner_vessel, invocation_count: 0, live_resolver: true,
  suggested_remediation: "Dispatch draft-gap-closing-activity / gap-compose against this gap to author a bridge activity that invokes the resolver (deterministic tier — NOT an LLM re-derivation).",
}
```
Owner vessel is resolved from discovery per-shape when cheaply available; otherwise
omitted (the shape name is sufficient for the draft loop). Emission is gated by
`emit_gaps !== false` (default true) so the resolver can be run in report-only mode.

## Resolver contract

```ts
interface OrphanedCapabilityScanPointer {
  type: "orphaned_capability_scan";
  metabobEndpoint?: string;     // activity-api, default env
  discoveryEndpoint?: string;   // discovery, default env
  devVesselImpulsesUrl?: string;
  apiKey?: string;
  emit_gaps?: boolean;          // default true
  template_limit?: number;      // default 2000
  max_emit?: number;            // safety cap, default 40 per tick
}
// returns:
interface OrphanedCapabilityReport {
  shape: "orphanedCapabilityReport";
  live_shape_count: number;
  invoked_resolver_count: number;
  orphan_candidate_count: number;     // live − invoked
  capability_orphan_count: number;    // after filter
  gaps_emitted: number;
  orphans: Array<{ shape: string; owner_vessel?: string }>;
  generated_at: string;
}
```

## Cadence

Tick template `development-vessel:orphaned-capability-tick` (single task, resolver
`orphaned_capability_scan`, `max_emit: 40`), tagged `boredom_target_template`,
`light_dispatch_eligible`, `phase:detect`, `horizon:meta`. Boredom dispatches it on
cadence alongside `capability-gap-audit-tick`; the two are complementary halves of the
find-stage (failure-driven + demand-driven).
