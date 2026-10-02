# Design: code-locality resolver

Grounded in a primitives survey of the running substrate (2026-07-05). Each of
the six expertise-formation pieces (`agent-prompt.md`) maps onto an existing
mechanism; the genuinely-new surface is deliberately small: one trace field,
one derived table, one read shape, one advisory hook.

## 0. The generic contract (design before instantiation)

- **Kind key** — a stable bucket for "tasks of kind X". Chosen key: the
  inferred goal-target shape set (`inferGoalTargetShapes`,
  `repos/goal-host-vessel/src/goal-target-inference.ts`) plus the state
  signature's `goal_type`. Rationale: `goal_hash` (MD5 of normalized text,
  `repos/activity-api/src/routes/goal-paths.ts`) is exact-text-brittle — one
  paraphrase is a new key. Target shapes are vocabulary-constrained, computed
  on the dispatch hot path already, and generalize across paraphrases. Hash the
  composite the way `hashStateSignature` does
  (`repos/activity-api/src/services/state-pattern-learner.ts`).
- **Material locator** — an opaque string identifying consulted material. Code
  instantiation: `file:<repo-relative-path>` (optionally `#symbol`). Other
  instantiations (no schema change): `memoryNote:<id>`, `concept:<id>`,
  `vault:<note>`.
- **Association row** — `{ kind_key, kind_descriptor, locator, times_consulted,
  times_changed, times_present_reached, times_present_failed, alpha, beta,
  last_seen_at, org_id }`. The α/β here is the *recall-trust* posterior for the
  (key, locator) pair; a per-key rollup gates injection.
- **Recall response** — `{ kind_key, materials: [{locator, confidence}],
  posterior: {alpha, beta, samples}, gate: "shadow"|"active" }`.

## 1. Attributed experience log — repair, don't invent

What exists: per-task `input_impulse_ids`/`output_impulse_ids`,
`impulse_resolutions[]` (impulse→resolver→vessel attribution),
`outputState.filesModified/filesCreated/filesDeleted`
(`repos/activity-api/src/models/schemas.ts`). local-tools resolvers already
put `path` in their output impulse pointers (`fileContent`, `fileEditResult`,
`codeSearchResult`, … — `repos/local-tools-vessel/src/index.ts`).

The gap: `repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts`
(~L127-142) hardcodes `filesModified: []` etc., so the feature_compose /
edit-intent path — exactly the path we want to learn from — lands **zero**
file attribution. And no field records the *read* set at all
(`filesAvailable` exists but is also zeroed, and means something else).

Fix (slice 1):
- ias trace sink populates `outputState.filesModified/filesCreated` from the
  compose ops actually applied, and a new `outputState.materialsConsulted:
  string[]` (locator strings) from the files/symbols the drafter read
  (fs_read / code-read resolution outputs are already in the task's impulse
  set — hoist their `path`s).
- activity-api: additive migration declaring `materialsConsulted` (flexible
  field; migrations 086/094 established the pattern). Legacy traces null-safe.
- Fallback for mining: where `materialsConsulted` is absent, derive it at
  mining time from `impulse_resolutions` + resolution-output pointer `path`
  fields (works for local-tools-resolved tasks today).

## 2. Consolidation — a standard mining tick

Mirror `repos/development-vessel/src/resolvers/trace-failure-pattern-report.ts`
exactly: GET `/v2/activities/execution-traces?limit=N`, aggregate, emit derived
rows with stable timestamp-free dedup ids, best-effort. New dev-vessel resolver
`code-locality-mine` + seed activity template; dispatched on the existing
boredom/upkeep cadence (no new scheduler).

Aggregation: for each trace, compute `kind_key` (re-infer target shapes from
the recorded goal, or read them from the trace when slice-1 records them),
extract locators (per §1), and upsert association rows via a new
`localityAssociation_write` impulse shape on activity-api. Reached traces
increment `times_present_reached`/α; failed ones `times_present_failed`/β
(stratified by failure mode exactly as `posterior-update.ts` does — half
penalty for budget exhaustion, full for verifier-negative).

Storage owner: **activity-api**, table `locality_associations`, adjacent to
`goal_execution_paths` — placement by data-locality: the traces being mined
and the Thompson idiom both live there. Org-scoped PERMISSIONS via
`$token.org_id` like every multi-tenant table.

## 3. Cued recall — a read shape, not a search

New read shape `codeLocality` (and its generic superset `localityRecall` —
same resolver, `material_kind` filter), advertised by activity-api through
discovery like its other ~30 read shapes. Input: `{ goal }` or
`{ target_shapes, goal_type }`; the resolver computes the kind key and returns
the ranked association rows (§0 recall response). No LLM, no exploration —
tier `deterministic`. `predict_cochanges`
(`repos/metabob-mcp/src/tools/predict-cochanges.ts`) is the ergonomic template
(confidence threshold + cache), but it is file-seeded; this is its goal-seeded
sibling, and the two compose (recall seeds → co-change expansion).

## 4. Metacognitive gating — Thompson, per key

Gate = per-key posterior over "acting on this recall led to reached". Use the
same Beta machinery as `context_thompson_scores`
(`repos/activity-api/src/lib/posterior-update.ts`): gate opens when
`mean(α,β) ≥ 0.7` AND `α+β ≥ 8` (tunable; recorded in the association rollup).
Below gate: recall is served with `gate:"shadow"` and callers MUST NOT inject —
the normal deliberate path (drafter search) runs unchanged and its trace feeds
§2. The escalation path back to deliberation is therefore structural, not a
special case.

## 5. Shadow mode — the advisory metadata-bag idiom

Precedent: failure-mode extras bag ("stored in the loose metadata bag; it
never influences selection", `activity-api-trace-sink.ts`) and
advisory H2 identity. goal-host, on edit-intent dispatch, resolves
`codeLocality` best-effort and writes the prediction
`{ kind_key, predicted: [locators], gate }` into the trace metadata. The
mining tick (§2) then scores agreement: predicted ∩ actually-consulted →
α-credit on matching (key, locator) pairs; predicted-but-unconsulted on a
reached trace → mild β (superstition decay). Promotion to `gate:"active"` is
purely the §4 posterior clearing — no manual switch.

## 6. Blame — ride the existing penalty path

When gate is active, goal-host mints each recalled material as a first-class
impulse (e.g. `fileContent` pointer with the locator's path) into the pool, so
its `impulse_id` enters the executing tasks' `input_impulse_ids`. On
`reached:false`, `writeImpulseRelevancePenalty`
(`repos/activity-api/src/lib/posterior-update.ts` L374-400) →
relevance-sink `/penalty` → `impulse_relevance_metrics.times_failed` already
lands per-impulse blame — **zero new blame plumbing**. Additionally the mining
tick decrements the (key, locator) association β so repeated attributed
failure closes the gate (habit repair: the association row is re-mined from
subsequent deliberate traces, not merely distrusted).

## Failure containment

- Every new write is best-effort/advisory until §4's gate opens; a dead
  mining tick or empty table degrades to today's behavior exactly.
- Injection never *removes* anything from the pool; worst case is irrelevant
  seed impulses, which the existing relevance machinery already penalizes.
- The sink attribution fix is additive fields; legacy traces remain valid.

## Non-goals

- No new scheduler, selection tier, or category (restated under
  impulse/activity/shape/Thompson/scope only).
- No embedding/model work in v-slice; ranking is count/posterior-based.
  (`predict_cochanges` composition is a follow-on.)
- Obsidian/memory instantiations: enabled by the generic contract, not built
  here.
