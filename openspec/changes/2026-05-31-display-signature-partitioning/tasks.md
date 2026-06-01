# Tasks — display-signature-partitioning

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Cap lift + LRU eviction (independent, ship first)

- [ ] **A.1** — Add `signature_cardinality_cap` column to
  `activity_template` schema in
  `repos/metabob-activity-api/sql/migrations/<next>-template-cardinality-cap.surql`.
  - Type: `option<int>`. Default at read time: 200; for templates with
    `tags ∋ "display"`, 5000.
  - Acceptance: migration applies cleanly; existing rows remain valid;
    SELECT against the field returns expected defaults.
- [ ] **A.2** — Modify the LET/IF/CREATE block in
  `repos/metabob-activity-api/src/lib/posterior-update.ts:~487-533` to:
  - Read `$cap` from `activity_template.signature_cardinality_cap` for
    the current `template_id` (single LET prefix added).
  - When `$cardinality >= $cap`, run a `LET $evictable = (SELECT id FROM
    context_thompson_scores WHERE … AND n_observations < $eviction_floor
    ORDER BY last_updated_at ASC LIMIT 1)`, DELETE the row, then proceed
    with CREATE.
  - When no evictable row exists, skip CREATE and emit a
    `signature_bucket_skipped_no_evictable` log event.
  - `$eviction_floor` from env `SIGNATURE_EVICTION_FLOOR` (default 3).
  - Acceptance: unit test in
    `src/lib/posterior-update.test.ts` reproduces the silent-drop bug
    against the OLD code path (with-cap-no-eviction), then asserts the
    NEW path evicts an n=1 bucket and creates the new one.
- [ ] **A.3** — Emit `signature_bucket_evicted` and
  `signature_bucket_skipped_no_evictable` events through the existing
  structured logger; document the event names in
  `repos/metabob-activity-api/docs/events.md`.
  - Acceptance: integration test asserts the event appears in the
    captured log when the eviction path fires.

## Phase B — Display coarsening tier (depends on A)

- [ ] **B.1** — Extend `SignatureTier` type and `computeStateSpaceSignature`
  in `repos/metabob-activity-api/src/utils/session-context.ts:~141`:
  - Add `tier?: 'default' | 'display' | 'display+source_app'` to
    `StateSpaceSignatureInput`.
  - For `display`, project `input.shapes` through a
    `coarsenForDisplay(shape) → string` helper that maps
    OCR-derived shapes to icon-label-class + functional-caption-class
    tokens (the classifier itself is a separate impulse — this proposal
    only defines the projection contract).
  - For `display+source_app`, additionally accept
    `sourceApps?: string[]` on the input; sorted-unique included in
    hash with a `|sa=` separator.
  - Hash output stays 8-byte truncated sha256 for parity with v1c.
  - Acceptance: unit test covering each tier; collision test
    asserting that a Firefox-impersonator's identical caption set hashes
    different from genuine Firefox when `source_app_id` differs.
- [ ] **B.2** — Add `signature_tier` column to `activity_template`
  (migration). Templates default to `default`; display-tagged templates
  to `display`.
  - Acceptance: migration applies; selector reads the field when
    computing the signature for posterior writes.
- [ ] **B.3** — Extend the shape-dispatch-check
  (`packages/shape-dispatch-check/`) with a rule: any template whose
  `input_shapes` intersects the registered `display.*` shape namespace
  MUST have `signature_tier ∈ {display, display+source_app}`.
  - Acceptance: lint fails on a synthetic template that consumes
    `display.dom_snapshot` with `signature_tier: default`.

## Phase C — Hierarchical empirical-Bayes prior (depends on B)

- [ ] **C.1** — Schema for the EB roll-up.
  `repos/metabob-activity-api/sql/migrations/<next>-template-signature-aggregate.surql`
  defines `template_signature_aggregate { template_id (PK), alpha_0,
  beta_0, n_signatures_observed, last_recomputed_at }`.
  - Acceptance: migration applies; PERMISSIONS clause matches the
    template-table policy.
- [ ] **C.2** — Periodic recompute job.
  `repos/metabob-activity-api/src/jobs/recompute-template-eb-prior.ts`
  runs every 15 min (via existing scheduled-job harness):
  - For each `template_id` with ≥ 5 distinct signatures, set
    `alpha_0 = mean(alpha)`, `beta_0 = mean(beta)` over
    `context_thompson_scores` rows for that template.
  - Templates with < 5 signatures: write `(1.0, 1.0)`.
  - Acceptance: unit test against a seeded fixture; integration test
    asserts the roll-up converges on a known synthetic distribution
    within 1 cycle.
- [ ] **C.3** — Read path in posterior-update.
  Modify the CREATE branch in `posterior-update.ts:~511-521` to:
  - Prepend a `LET $prior = (SELECT alpha_0, beta_0 FROM
    template_signature_aggregate WHERE template_id = $activity_id
    LIMIT 1)[0]`.
  - Use `($prior.alpha_0 ?? 1.0) + $alpha_delta` and
    `($prior.beta_0  ?? 1.0) + $beta_delta` in the CREATE CONTENT.
  - Acceptance: unit test against a seeded aggregate row asserting the
    fresh bucket inherits the prior; second test against an empty
    aggregate falls back to (1.0, 1.0).
- [ ] **C.4** — Compose with info-gain bonus from
  `2026-05-30-info-gain-bonus-on-success`. Verify the multiplicative
  composition: `α_fresh = α_0 + 1 × infoGainFactor(n=0) = α_0 + 1`.
  Document in `docs/architecture/POSTERIOR_UPDATE.md`.
  - Acceptance: doc updated; cross-link added in both proposals.

## Phase D — Partition dimensions (depends on C)

- [ ] **D.1** — Schema extensions on `context_thompson_scores`.
  `repos/metabob-activity-api/sql/migrations/<next>-thompson-partition-dimensions.surql`
  adds `source_app_id`, `source_window_id`, `reversibility_class` as
  `option<string>` fields.
  - Acceptance: migration applies; existing rows remain valid with
    NULLs in the new fields.
- [ ] **D.2** — `signature_partitions` field on `activity_template`
  (`option<array<string>>`, values drawn from
  `["source_app_id", "source_window_id", "reversibility_class"]`).
  - Templates opt-in per dimension; default empty.
- [ ] **D.3** — Extend the LET/IF/CREATE upsert in `posterior-update.ts`
  to include the opted-in partition dimensions in the WHERE/CREATE
  payload. Bucket lookups now match on
  `(template_id, signature_version, context_bucket, … partitions)`.
  - Acceptance: unit test asserting two writes with same
    `context_bucket` but different `reversibility_class` produce two
    rows.
- [ ] **D.4** — Selector read-path update.
  `src/services/thompson-sampling.ts` (or wherever the signature read
  occurs for selection) passes the partition tuple through to the
  bucket lookup. Document the partitioned-Q-table read in
  `docs/architecture/POSTERIOR_UPDATE.md`.
  - Acceptance: end-to-end test issuing one
    `(reversible)` success and one `(hard_irreversible)` failure
    against the same `context_bucket` produces divergent posteriors;
    `v_shape_conditioned_score` returns different draws per partition.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — closes the silent-drop bug standalone | Required before any display-vessel posterior writes |
| B | Phase A migration applied | `display` tier callable but harmless against `default`-tagged templates |
| C | `2026-05-30-info-gain-bonus-on-success` Phase 1 deployed | EB prior composes with info-gain step; either order works but joint deploy is cleaner |
| D | Phase C deployed | Partition dimensions are inert without the EB prior because flat (1,1) priors would dominate |

## Cross-references

- `2026-05-30-info-gain-bonus-on-success/` — info-gain success discount
  composes against the EB prior introduced in Phase C
- `2026-05-30-event-driven-novelty-surface/` — novelty channel consumes
  the per-tier signatures from Phase B
- `2026-05-30-trace-to-concept-mining/` — supplies the trace history the
  EB roll-up draws from
- `2026-05-31-display-failure-mode-extensions/` — sibling spec adding
  failure-mode coverage for the display layer that this proposal
  enables on the success side
