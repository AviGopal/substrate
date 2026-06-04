# Tasks — Successor-feature decomposition of Q

## SPEC

- [ ] S.1 Cite `concept_49XNzJTL7E8V` (primary), `concept_TbN0eSf7U_hM`
  (umbrella), `concept_7mzv7SQN_7JB` (vocabulary gate),
  `concept_DQWZPkvnhxhO` (per-task input/output impulse shapes — the raw
  signal), and `concept_eSoms8g__1oP` (federation dynamics — the trust-free
  argument) as the anchor set. Confirmed in `proposal.md` §Anchors.
- [ ] S.2 Restate the mechanism under the four primitives (impulse /
  activity / signature / Thompson-per-arm). Confirmed in `proposal.md` table.
  Linter: every paragraph that names a "new tier", "new category", or "new
  storage class" is rejected at review.
- [ ] S.3 Map `φ` to **output-shape vector** of `(signature, template)`.
  Reuse concept-db's shape vocabulary. No new shape minting; ψ is keyed on
  existing shape ids only.
- [ ] S.4 Specify the ψ shape contract (`successorFeatures` impulse) with
  sparse-map vector encoding, scope field matching
  `variant_performance_metrics`. Confirmed in `proposal.md` §ψ shape contract.
- [ ] S.5 Specify the federation-aggregation rule (provenance-weighted
  pooling of ψ; reward stays local) explicitly so the future
  vessel-federation-extension spec has a concrete primitive to ship over the
  wire. Confirmed in `proposal.md` §Federation.
- [ ] S.6 List acceptance: offline-replay behavioral-continuation on novel
  reward functions, no-regression on existing reward, per-cell variance
  convergence, storage budget. Confirmed in `proposal.md` §Acceptance.
- [ ] S.7 Out-of-scope: R-only mechanisms, federation wire protocol,
  IDS-over-(ψ,w), deep-SF, selector wiring. Confirmed in `proposal.md`
  §Out of scope.
- [ ] S.8 Review for `concept_7mzv7SQN_7JB` compliance: zero new tiers,
  zero new categories. ψ is a *statistic over existing per-cell data*,
  not a new posterior type.

## DEV

### DEV-A: ψ schema (migration)

- [ ] DEV-A.1 Add migration `repos/metabob-activity-api/sql/migrations/NNN-successor-features.surql`:
  - `DEFINE TABLE successor_features SCHEMAFULL` with org-scoped PERMISSIONS
    (mirroring `variant_performance_metrics`).
  - Fields: `signature: string`, `template_id: string`, `discount: float
    DEFAULT 0.9`, `scope: string DEFAULT 'org'`, `org_id: option<string>`,
    `account_id: option<string>`, `peer_id: option<string>`,
    `vector: FLEXIBLE object` (sparse {shape: float}), `sample_count: int
    DEFAULT 0`, `variance_estimate: option<float>`, `updated_at: datetime
    DEFAULT time::now()`.
  - `DEFINE INDEX sf_cell_idx ON successor_features FIELDS signature,
    template_id, scope UNIQUE`.
  - Register in `init_migrations` per the migration-tracking contract.
- [ ] DEV-A.2 Add `SuccessorFeaturesSchema` Zod object to
  `repos/metabob-activity-api/src/models/schemas.ts` with the
  resolver-response shape from `proposal.md` §ψ shape contract.
- [ ] DEV-A.3 Confirm no change to existing per-task `input_impulse_shapes`
  / `output_impulse_shapes` fields
  (`repos/metabob-activity-api/src/models/schemas.ts:297-298`, `:432-433`,
  `:450-452`, migration
  `045-composition-graph-extended-fields.surql:32-33`). ψ is a read-only
  consumer of those fields.

### DEV-B: ψ resolver (read)

- [ ] DEV-B.1 Add `case 'successorFeatures'` to the shape-switch in
  `repos/metabob-activity-api/src/routes/impulses.ts`. Query
  `successor_features` by `(signature, template_id, scope)` with the
  partial-pool fallback ladder
  (`org → account → global → peer` if requested scope is empty).
- [ ] DEV-B.2 Add `'successorFeatures'` to `config.discovery.shapes` in
  `repos/metabob-activity-api/src/config.ts` (or equivalent
  shape-advertisement list).
- [ ] DEV-B.3 Add the shape-dispatch-check fixture entry so `bun run lint`
  passes the shape-dispatch agreement linter.
- [ ] DEV-B.4 Unit tests under
  `repos/metabob-activity-api/src/routes/impulses.test.ts` for the new
  case: missing cell returns uniform-prior ψ (empty vector,
  `sample_count = 0`); existing cell returns stored vector; scope fallback
  walks org→account→global.

### DEV-C: ψ write resolver (admin)

- [ ] DEV-C.1 Add `case 'successorFeatures_write'` to the impulse
  resolver. Idempotent UPSERT on `(signature, template_id, scope)`:
  Robbins-Monro update `ψ_new = ψ_old + η · (ψ_sample − ψ_old)` with
  `η = 1 / (sample_count + 1)` (empirical-mean variant). Increment
  `sample_count`. Update `variance_estimate` via Welford's online algorithm
  per coordinate (track per-shape running variance, store the L2 mean as
  the cell-level estimate).
- [ ] DEV-C.2 Admin-only PERMISSIONS on the write path (mirroring
  `activityTemplate_update`); emit `upkeepAuditLog` impulse per the
  learning-loop-write-resolvers contract.
- [ ] DEV-C.3 Unit tests: idempotent re-emission of same ψ_sample does
  *not* drift the mean; variance falls as `1/n` under stationary input.

### DEV-D: ψ observer vessel

- [ ] DEV-D.1 Scaffold `repos/successor-features-vessel/` following
  `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md`. Port 8270. Discovery
  registration on startup. Health endpoint. Bun + Hono.
- [ ] DEV-D.2 WebSocket client to `activity-api:8080/ws`. Subscribe to
  `task.completed` and `execution:succeeded`. Standard handshake +
  catchup-on-reconnect protocol (mirroring ribosome-vessel + concept-db
  observer).
- [ ] DEV-D.3 ψ-estimator core (`src/estimator.ts`):
  - On `execution:succeeded`, fetch the full trace via
    `executionTraceWithSignatures` (already exposes per-task
    `input_impulse_shapes` / `output_impulse_shapes`).
  - Walk tasks in execution order. For each `(s_t, a_t)` pair (signature
    at task `t`, template at task `t`), accumulate the discounted
    output-shape vector `ψ̂_τ(s_t, a_t) = Σ_{k=t..T} γ^{k-t} φ_k`.
  - For each `(s, a)` encountered, emit one `successorFeatures_write`
    impulse with the sample vector.
- [ ] DEV-D.4 Failure handling: estimator errors are logged and dropped
  (mirroring ribosome's `swallow-and-log` discipline); never throw into
  the WS loop. Trace-ingestion path is **never** blocked by ψ-estimator
  failures.
- [ ] DEV-D.5 Unit tests: replay a fixture trace with known
  output-shape vectors, verify estimator emits the expected ψ vector.
  Property tests: ψ values for shapes never observed must stay 0;
  ψ values respect discount monotonicity (`γ < 1` ⇒ later-task shapes
  weighted less).

### DEV-E: Offline replay harness

- [ ] DEV-E.1 New script
  `validation/scripts/successor-features-replay-harness.ts`:
  - Pull a window of completed traces from activity-api.
  - 80/20 train/test split.
  - Train `ψ̂` and `ŵ_old` on train set (ψ̂ via the same estimator;
    `ŵ_old` via ridge regression on `success ~ φ`).
  - Synthesize `w_new` by perturbing `ŵ_old` (controlled L1 distance).
  - Measure top-1 template selection accuracy of three rules on test set:
    (a) SF: `argmax_a ψ̂_a · w_new`; (b) Beta-Thompson alone;
    (c) uniform-random.
  - Emit a `successorFeaturesReplayReport` impulse with the three accuracy
    numbers + `‖w_new − w_old‖_1 / ‖w_old‖_1`.
- [ ] DEV-E.2 Define `successorFeaturesReplayReport` shape; register as
  read-only resolver for harness output retrieval.

## DEPLOY

- [ ] DEPLOY.1 Apply migration `NNN-successor-features.surql` via
  `bun run init-db` on the substrate-live SurrealDB. Confirm via
  `INFO FOR TABLE successor_features` and the new entry in
  `init_migrations`.
- [ ] DEPLOY.2 Ship `successor-features-vessel` as a substrate systemd
  unit under `scripts/substrate/units/successor-features-vessel.service`,
  alongside `ribosome-vessel.service` and friends. Document under
  `docs/SUBSTRATE.md` once green.
- [ ] DEPLOY.3 Helm chart at `repos/deployment/charts/successor-features-vessel/`
  for canary deployment (mirroring the ribosome chart). Out-of-scope for
  initial substrate-live ship; gated on substrate-live coverage.
- [ ] DEPLOY.4 No production deploy until acceptance criteria pass on
  substrate-live for ≥ 3 windows (mirroring lift-criterion-hardening
  discipline).

## VERIFY

- [ ] VERIFY.1 Smoke: after one day of substrate-live activity, query
  `SELECT count() FROM successor_features` — must be > 0 and roughly
  match `SELECT count() FROM variant_performance_metrics WHERE
  sample_count > 0`. ψ cell count ≈ informed Thompson cell count.
- [ ] VERIFY.2 Replay-success acceptance (Acceptance #1 in `proposal.md`):
  SF selection outperforms Beta-Thompson by ≥ 15% top-1 accuracy on ≥ 3
  `(w_old, w_new)` pairs with `‖w_new − w_old‖_1 / ‖w_old‖_1 ≥ 0.3`.
- [ ] VERIFY.3 No-regression acceptance (Acceptance #2): SF selection
  matches Beta-Thompson within ± 2% on `w_new = w_old`.
- [ ] VERIFY.4 ψ-cell convergence (Acceptance #3): for cells with
  `sample_count ≥ 30`, `variance_estimate < 0.05` in ≥ 80% of cases.
  Non-converging cells produce a `nonStationaryCellFinding` impulse —
  detector dividend, log for follow-up.
- [ ] VERIFY.5 Storage budget (Acceptance #4): `SELECT
  array::len(object::keys(vector)) AS nnz FROM successor_features` —
  median `nnz` ≤ 50; total table size ≤ 2× `variant_performance_metrics`.
- [ ] VERIFY.6 Trace-ingestion isolation: kill the
  `successor-features-vessel` for a window; confirm activity-api trace
  writes continue uninterrupted; restart vessel; confirm it catches up
  via WS `catchup` protocol without duplication
  (idempotent UPSERT in DEV-C.1 covers this).
- [ ] VERIFY.7 `concept_7mzv7SQN_7JB` compliance audit: grep the diff for
  the substrings "new tier", "tier-4", "category-new" — must return zero
  hits. ψ rides on existing primitives only.
- [ ] VERIFY.8 Behavioral-continuation gate met for ≥ 3 consecutive windows
  before the federation-extension spec can build on ψ as the trust-free
  transfer primitive. Promote `concept_49XNzJTL7E8V` from `relevance ≈ 0.25`
  to `succeeded > 0` upon first replay-acceptance pass.
