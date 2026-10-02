# Substrate self-audit meta-template (lifecycle-driven detector fan-out)

## Why

The substrate-self-detection family has four canonical detectors —
`detect-phantom-success-trace`, `detect-precondition-rejection`,
`audit-dispatch-target-drift`, `detect-service-oom-cascade` — plus the
`detect-stale-pointer` prototype and `trace_failure_pattern_report` as
a resolver-only (no seed wrapper). They are **catalogue citizens**:
each appears in `repos/development-vessel/src/seed/index.ts:56-107`
and rides the bootstrap upload to activity-api.

They are not **loop citizens**. The existing lifecycle observer
`repos/development-vessel/src/observers/registry-change-observer.ts`
fires the topology chain (`learned_topology_snapshot`,
`reachable_unlearned_report`, `unknown_shape_report`) plus the two
aggregators (`coverage_tick`, `substrate_health_tick`) on every
qualifying `lifecycle:execution:succeeded` event (`shouldRescore`
predicate at `registry-change-observer.ts:260-268`). The four
substrate-self-detection family members are **not subscribed to that
chain**. They only run when Thompson boredom rotation picks them on
its 5-minute tick, which is stochastic, lag-laden, and decoupled from
the events the detectors are meant to observe.

Concrete cost: when a `validator-dispatch` execution writes a
phantom-success trace at time `T`, the substrate has no event-side
trigger for `detect-phantom-success-trace`. The detector fires the
next time boredom happens to draw it — minutes or hours later, on a
random batch of traces. By the time the gap is emitted, the
selector's Thompson posteriors have already absorbed the polluted α
update. The detection arrives after the damage.

This proposal closes the loop. A new meta-template
`substrate-self-audit-meta` fans the family out on lifecycle events,
making detection event-driven rather than rotation-stochastic, and
keeping the underlying detectors structurally unchanged. The
substrate's evidence-collection rate for its own failures becomes
deterministic.

## Empirical motivation

- `concept_9ldsmRgqSTd5` (`substrate_self_detection_principle`) — the
  constitutional principle every detector in the family cites in its
  header comment (see
  `repos/development-vessel/src/seed/detect-precondition-rejection.ts:16-25`,
  `repos/development-vessel/src/seed/detect-service-oom-cascade.ts:30-33`).
  Principle is encoded in seeds but not in the lifecycle path.
- 9367+ phantom-success traces observed from `validator-dispatch`
  alone as of 2026-05-30
  (`repos/development-vessel/src/seed/detect-phantom-success-trace.ts:8-9`).
  Detector exists but absorbs that volume only when boredom samples it.
- The topology chain in `registry-change-observer.ts:70-114` already
  demonstrates the pattern: a single lifecycle event fans out a known
  catalogue of observers in parallel, then aggregates. The
  substrate-self-detection family deserves the same wiring.

## What changes

### 1. New seed template

`repos/development-vessel/src/seed/substrate-self-audit-meta.ts`
following the immunity pattern (siblings
`concept_Y2zGpFNBrcgb`, `concept_pFSLV6s5s3lQ`,
`concept_t2jHO8I-LxD3`):

- `inputShapes: []` — nothing to pre-flight-reject (matches
  `detect-precondition-rejection.ts:49`).
- `variables: []` — no caller-seeded values required (matches
  `detect-service-oom-cascade.ts:57`).
- Single task `audit_fan_out` dispatching the resolver
  `self_audit_fan_out` (deterministic, no LLM).
- `outputShapes: ["selfAuditReport", "substrateGap"]` — the meta
  republishes any gaps the underlying detectors emit so that the
  observer surface still sees them at the meta-execution level.

The meta-template itself is structurally immune to every bug class
its members detect. This is load-bearing: a meta that fans out
detectors must not be the next entry on the detectors' findings list.

### 2. New resolver

`repos/development-vessel/src/resolvers/self-audit-fan-out.ts`:

- Reads recent traces via the existing activity-api
  `/v2/activities/execution-traces?since=…` surface (the resolvers
  the family members use today: `phantom_trace_scan`,
  `precondition_rejection_scan`, `dispatch_target_drift_scan`,
  `service_oom_cascade_scan`).
- Dispatches all four canonical family members **in parallel** via
  `resolveDispatch` (the same path the topology chain uses at
  `registry-change-observer.ts:55-67`). Each member is dispatched
  with its own scoped trace window.
- Aggregates per-detector `{executed, succeeded, gap_count}` into a
  single `selfAuditReport` impulse.
- Re-emits the `substrateGap` impulses each member produced so they
  are visible at the meta-execution's `output_impulse_ids` without
  changing the underlying gap semantics.

### 3. Lifecycle wiring

Extend `registry-change-observer.ts` to subscribe
`substrate-self-audit-meta` to two events:

- **`lifecycle:execution:succeeded`** for top-level executions
  (where `composition_chain.length == 0`). The dispatch is
  **debounced by `template_id` within a 1-minute window** — a burst
  of identical executions triggers one audit, not N. The debounce
  table reuses the `recentDispatches` `Map` pattern at
  `registry-change-observer.ts:138-152`.
- **`activityRegistryChange`** — the existing observer trigger.
  Keeps the substrate-self-audit cadence aligned with the
  topology-discovery rhythm so a registry edit (variant promotion,
  new template upload) immediately re-audits.

The meta-template's own `template_id` is excluded from triggering
further audits (loop guard, see Risk below).

### 4. New shape

```ts
selfAuditReport = {
  audit_window_start: ISO8601,
  audit_window_end: ISO8601,
  family_members_dispatched: string[],
  gaps_emitted: substrateGap[],
  detector_summary: Record<
    string, // detector template_id
    { executed: boolean, succeeded: boolean, gap_count: number, duration_ms: number }
  >,
  audit_duration_ms: number,
}
```

Register the shape via the three-place rule
(`repos/development-vessel/CLAUDE.md` §"Shape-dispatch agreement is
enforced"): resolver file + `discovery.shapes` in `src/config.ts` +
`case` in `src/routes/impulses.ts`.

### 5. Rate-limit

Default ≤1 audit per 2 minutes (configurable via
`SUBSTRATE_AUDIT_META_MIN_INTERVAL_MS` env, default `120_000`).
Without rate-limit, the fan-out would amplify a load problem the
detectors are meant to surface — a runaway audit loop is itself a
phantom-success-class bug.

## Out of scope

- New detectors themselves. `detect-oov-goal-no-escalation`,
  `detect-posterior-asymmetry`, `detect-cascading-misattribution`,
  and other proposed family members are separate openspecs. This
  proposal explicitly **does not change the detectors** — they
  remain immutable seed templates with their existing immunity
  patterns.
- Graduation of `trace_failure_pattern_report` (resolver-only today)
  into a first-class detection-seed wrapper. Tracked separately;
  the fan-out can include it once it has a seed template id.
- Graduation of the load-attribution stack into the family. That
  bridge is the companion openspec
  `2026-05-31-detect-resource-budget-violation`.
- Mutation of the immunity pattern. The meta-template itself
  follows the pattern exactly; the proposal documents why this is
  load-bearing rather than relaxing it.

## Dependencies

- All four family members already shipped (super-repo `5bb048e` and
  subsequent commits adding `detect-service-oom-cascade`).
- `executionTraceList`-equivalent surface in activity-api — already
  consumed by the four detectors.
- Lifecycle event bus + `resolveDispatch` mechanism — already
  exercised by the topology chain at
  `registry-change-observer.ts:55-114`.
- Three-place rule enforcement via
  `scripts/check-shape-dispatch.ts` — already enforced in
  development-vessel CI.

## Risk

- **Cascading-detection / infinite loop.** A successful
  `substrate-self-audit-meta` execution itself emits
  `lifecycle:execution:succeeded`, which would re-trigger the
  audit. Mitigation: explicit `template_id` self-exclusion in the
  observer's predicate AND the 2-minute rate-limit as a second
  guard.
- **Fan-out amplifies load under degradation.** Audits firing on
  every top-level execution could overwhelm a substrate already
  under cgroup pressure (concept_RYl73llSCGfc, the OOM-cascade bug
  class). Mitigation: the rate-limit caps frequency; each detector
  runs as a deterministic O(query) scan rather than O(model)
  inference; family members run in parallel within one audit but
  one audit at a time globally.
- **Posterior pollution from meta-success.** If the meta-template
  "succeeds" merely by dispatching the fan-out (regardless of what
  the detectors emit), it becomes a phantom-success candidate
  itself. Mitigation: a meta execution with empty
  `family_members_dispatched` array emits its own
  `failure_mode.type: "verifier_negative"` with
  `failed_evidence` citing the empty fan-out, ensuring success is
  contingent on doing real work.
- **Debounce window tuning.** 1-minute debounce per template_id
  may be too tight under high-throughput template families.
  Mitigation: configurable via env; tighten or loosen after
  observation.

## Companion concepts

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
  (the constitutional principle the family cites; this proposal
  graduates it from catalogue principle to loop principle)
- `concept_Y2zGpFNBrcgb`, `concept_pFSLV6s5s3lQ`,
  `concept_t2jHO8I-LxD3` — immunity-pattern siblings the
  meta-template itself adheres to
- `concept_qcctOLBT5-CL` — F25 signature (precondition-rejection
  detector cites this; the fan-out forwards it)

## Related openspecs

- `2026-05-30-trace-to-concept-mining/` — complementary arm: this
  proposal is the known-taxonomy detection arm; trace-mining is the
  unknown-discovery arm. Together they form the full substrate
  self-learning surface.
- `2026-05-30-event-driven-novelty-surface/` — the
  `lifecycle:execution:novelty` event is a natural future
  subscriber for the audit-meta in addition to today's
  `succeeded` + `registry-change` triggers.
- `2026-05-31-detect-resource-budget-violation/` — companion in
  this commit; once shipped, the resource-budget detector joins
  the audit-meta's fan-out automatically.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  this proposal's push-away credit hook (Phase E below) feeds the
  same S3 sustained-push-away window §27.S.6 specifies.

## Graph-RL framing

The substrate-self-detection family currently sits on
ε-greedy exploration: whether a detector fires after a suspicious
execution is a coin flip driven by Thompson rotation. This
proposal converts the family into a **guaranteed lifecycle
observer**: every top-level success becomes an event the family
collectively examines, debounced and rate-limited but not
randomized.

In RL terms: the substrate moves from an asynchronous reward
attribution (the detector might tell you about the bad action
later) to a synchronous reward attribution (every action is
audited at completion). This is exactly the structural move from
**passive surveillance to active monitoring** — the substrate
collecting its own evidence at the time the evidence is
freshest, rather than hoping a sampler picks the right window.

The audit-meta is also a candidate refusal-citation source for S3
push-away: when `gaps_emitted.length` exceeds threshold for a
given template_id, the load-aware gate from super-repo
`04441ca9` reads the per-template gap-count as additional
refusal evidence (Phase E.1).
