# Proposal: code-locality resolver (expertise formation, code instantiation first)

## Why

Every edit-intent goal today pays the full deliberate-search cost: the drafter
re-discovers which files matter from scratch, every time. The substrate already
records execution traces, keys per-goal learning, runs mining ticks, carries
calibrated Thompson posteriors, and attributes failure to specific impulses —
i.e. it owns all six primitives of **expertise formation** (see
`agent-prompt.md`) — but no loop composes them into cue-triggered recall: "for
goals of kind X, the relevant material is reliably at Y."

This is not a new tier or category. It is a restatement under existing
primitives: an attributed trace field, a consolidation activity, a read shape
with a resolver, a Thompson-gated injection, an advisory (shadow) phase using
the established metadata-bag idiom, and blame riding the existing
`impulseRelevance` penalty path.

## What changes

Six slices, ordered so each is independently testable and substrate-authorable:

1. **Attribution repair (traces)** — the ias-executor trace sink currently
   zeroes `outputState.filesModified`/`filesCreated` and records no read-set.
   Populate consulted-material and changed-material attribution on the
   feature_compose / edit-intent path; add a `materialsConsulted` (read-set)
   field to the trace schema.
2. **Consolidation tick (mining)** — a dev-vessel resolver + activity template
   (mirroring `trace-failure-pattern-report`) that aggregates traces into
   locality associations keyed by goal-kind (inferred goal-target shapes +
   goal_type), written to a new derived table in activity-api adjacent to
   `goal_execution_paths`.
3. **Cued-recall resolver** — a new read shape `codeLocality` served by
   activity-api (resolver lives where the derived data lives): goal text /
   target shapes in → ranked material locators + per-key α/β + confidence out.
4. **Shadow mode (apprenticeship)** — goal-host resolves `codeLocality`
   advisorily on edit-intent dispatch, records the prediction in the trace
   metadata bag (never influences selection), and a comparison step scores
   prediction-vs-actually-consulted agreement into the per-key posterior.
5. **Confidence gate + injection (promotion)** — when a key's posterior clears
   threshold (mean + sample count), recalled materials are minted as
   first-class impulses into the pool before drafting; below threshold the
   normal deliberate path runs unchanged and keeps feeding consolidation.
6. **Blame verification** — because recalled materials enter as impulses, a
   `reached:false` outcome already fires `writeImpulseRelevancePenalty` →
   relevance-sink per-impulse counters; verify per-recalled-item blame lands
   and that repeated failure demotes the key below the gate (habit repair).

## What does NOT change

- No new selection tier, no bypass of the walk: recall only *seeds the pool*.
- `goal_hash` stays as-is (dedup/caching); goal-kind keying uses target-shape
  inference, which already runs on the dispatch hot path.
- Thompson machinery, reach-gate, oracle corpus, penalty path: reused, not
  forked.

## Impact

- Repos: `ias-executor-ts` (trace sink), `activity-api` (schema migration,
  derived table, `codeLocality` resolver), `development-vessel` (mining
  resolver + seed template), `goal-host-vessel` (shadow hook, gated injection).
- Success criteria: (a) traces from edit-intent goals carry non-empty
  consulted/changed attribution; (b) the mining tick produces associations for
  ≥1 recurring goal-kind; (c) shadow agreement measurably accumulates α/β;
  (d) a gated key injects recall and the goal reaches with lower search cost;
  (e) an induced failure decrements the specific recalled item's relevance and
  the key's posterior.
- Generic mechanism: the association table and recall contract are
  material-agnostic (locator strings + kind key); `codeLocality` is the code
  parameterization. A second instantiation (e.g. memoryNote locality) must be
  possible without schema change.
