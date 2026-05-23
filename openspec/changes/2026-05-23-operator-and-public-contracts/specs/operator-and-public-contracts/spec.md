# Spec — Operator-as-Vessel and Substrate-Public Contracts

Normative requirements. Each is testable. All terminology aligned
with `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` and IAL
`2026-04-26-impulse-activity-loop/tasks.md` §27.S.5 (post-lift
agenda) and §27.S.6 (intervention rate / push-away). Section
references inline. This spec ships data primitives the substrate
uses post-lift to extend its vessel framework to all external
systems; it does NOT amend any §27.S gate.

## R0 — Sequencing and authority

- **R0.1** This spec is downstream of
  `2026-05-23-intervention-tracking` (defines `operatorIntervention`
  and `interventionRefused` whose bodies R5 amends additively) and
  `2026-05-23-signal-confidence-weighting` (defines the
  `signal_confidence_weight` field R4 writes per-category
  defaults into).
- **R0.2** Soft dependencies on `2026-05-23-vessel-federation`
  (shares H2 vessel-id construction; pre-H2 this spec uses TOFU)
  and `2026-05-23-lift-criterion-hardening` (defines
  `heldOutEvalReport`, `adversarialProbeReport`, `ciAgreementReport`,
  `chainStallReport` consumed by R6's public enumeration).
- **R0.3** Soft dependency on `2026-05-23-external-resolver-
  vesselization` (codifies the general external-system-as-vessel
  pattern this spec instantiates for the operator as a foundational
  pre-lift primitive).
- **R0.4** **Spec authority.** The shape contracts in R1–R3 (operator
  emit shapes) and R6 (substrate-public enumeration) are this spec's
  authority. Other specs MUST NOT redefine these fields inline.
  Future evolution lands via change-supersession of THIS change, not
  via inline edit by a consuming spec.
- **R0.5** This spec does NOT amend any IAL §27.S gate. It ships
  data primitives §27.S.5 references as enabling substrate-authored
  post-lift expansion.

### ADDED Requirements

#### Requirement R1 — Operator-vessel registration

- **R1.1** `discovery-vessel` MUST accept `kind: "operator"`
  registrations alongside the existing `executor | resolver |
  lifecycle-subscriber` kinds.
- **R1.2** Required registration fields:
  `vessel_id`, `kind: "operator"`, `identity_binding_method`,
  `pubkey`, `emit_shapes[]`, `consume_shapes[]`.
- **R1.3** `identity_binding_method` MUST be one of
  `session_pubkey_tofu` (pre-H2 default) or `h2_multihash`
  (post-H2). When `session_pubkey_tofu`, `vessel_id` MUST equal
  `"operator:" + base32(sha256(pubkey))`. When `h2_multihash`,
  `vessel_id` MUST equal `base32(multihash(SHA-256, pubkey))` per
  `2026-05-23-vessel-federation` §A.
- **R1.4** On first registration with a new pubkey, the substrate
  MUST accept under TOFU and persist the (operator-vessel-id,
  pubkey) binding.
- **R1.5** On subsequent registration with a previously-seen
  operator-vessel-id but a different pubkey, the substrate MUST
  refuse and emit an `interventionRefused` with
  `refusal_code: "operator_pubkey_mismatch"`.
- **R1.6** Multi-operator deployments: distinct operator session
  pubkeys MUST produce distinct operator-vessel-ids; the substrate
  MUST track reputation separately per operator-vessel-id.
- **R1.7** Operator-vessel records persist across sessions. An
  inactive operator-vessel record MUST remain queryable and
  reputation-bearing.

##### Scenario: TOFU acceptance of new operator pubkey

- WHEN the substrate boots and the first operator session opens
- THEN `bootstrap-operator-vessel` MUST register an
  `OperatorVesselRegistration` with `kind: "operator"` and the
  session's pubkey.
- AND `discovery-vessel`'s `/registry/stats` MUST include the
  operator-vessel record on the next query.

##### Scenario: pubkey mismatch rejection

- WHEN a registration arrives with an existing operator-vessel-id
  but a pubkey that does not match the persisted binding
- THEN the registration MUST fail
- AND an `interventionRefused` MUST emit with
  `refusing_gate.refusal_code: "operator_pubkey_mismatch"` and
  `cited_evidence.persisted_pubkey_hash`.

#### Requirement R2 — Operator emit-shape contracts (10 shapes)

- **R2.1** The operator-vessel MUST advertise the following ten
  shapes in `emit_shapes[]`: `operatorGoal`, `operatorIntervention`,
  `interventionAuditVerdict`, `heldOutEvalSetCuration`,
  `adversarialProbeSetCuration`, `foundationComplianceUpdate`,
  `h5BaselinePromotion`, `federationPeeringAuthorization`,
  `liftStatusConfirmation`, `directionGoal`.
- **R2.2** Each shape's body schema MUST conform to design §A's
  enumeration. Shape body schemas are fixed at `signature_version:
  1` for this spec's initial emission.
- **R2.3** `operatorIntervention` and `interventionRefused` bodies
  are amended additively to include `actor.operator_vessel_id?:
  string` and `actor.fallback?: "anonymous-operator"`. The
  amendment is forward-compatible with `2026-05-23-intervention-
  tracking` R1 and R2.
- **R2.4** Each emit shape's body MUST carry a
  `signal_confidence_weight` field populated per R4's default
  table or per operator override.

##### Scenario: operatorGoal emission carries default weight 0.9

- WHEN the operator-vessel emits an `operatorGoal`
- THEN the impulse body MUST carry `signal_confidence_weight:
  0.9` unless an operator-tunable override is configured.

##### Scenario: heldOutEvalSetCuration carries weight 1.0

- WHEN the operator publishes a new held-out set version via
  `heldOutEvalSetCuration`
- THEN the impulse body MUST carry `signal_confidence_weight: 1.0`
  reflecting operator authority over external anchors.

#### Requirement R3 — Operator consume-shape declaration

- **R3.1** The operator-vessel MUST advertise a `consume_shapes[]`
  list naming the substrate-public shapes it expects to read.
- **R3.2** The declared `consume_shapes[]` MUST be a subset of the
  substrate-public enumeration (R6).
- **R3.3** The declaration is informational; discovery-vessel does
  NOT gate reads on the declaration. The substrate-public-feed (R7)
  uses the declaration for pre-filtering when the operator-vessel
  queries without explicit `shapes` filter.

#### Requirement R4 — Confidence-weight defaults per category

- **R4.1** The operator-vessel emission path MUST populate
  `signal_confidence_weight` per design §B's default table for
  each emit-shape category.
- **R4.2** Operator-tunable overrides MUST be supported via
  `validation/state/operator-vessel-config.json`; an override
  replaces the default for the matching category.
- **R4.3** Substrate-authored tuning of the defaults is NOT in
  scope of this spec (deferred to the operator-vessel-trust-tuning
  sibling).

##### Scenario: operator override of one category

- WHEN `operator-vessel-config.json` overrides
  `directionGoal` to weight 0.5
- THEN subsequent `directionGoal` emissions MUST carry
  `signal_confidence_weight: 0.5`
- AND other category emissions MUST continue to carry their
  defaults.

#### Requirement R5 — Intervention-tracking attribution integration

- **R5.1** Each `operatorIntervention` emission MUST include
  `actor.operator_vessel_id` when the originating detection hook
  can resolve the actor's identity-vessel session to a registered
  operator-vessel-id.
- **R5.2** When attribution is not resolvable, the emission MUST
  set `actor.fallback: "anonymous-operator"` and the substrate's
  reputation surface MUST NOT update for that event.
- **R5.3** The five detection hooks (`fs-watcher`,
  `orchestration-log`, `api-origin`, `db-audit`, `spec-attribution`,
  per `2026-05-23-intervention-tracking`) MUST each implement the
  attribution path per design §F.
- **R5.4** `interventionRefused` emissions originating from
  operator-emitted impulses MUST carry
  `intervention_attempted.actor.operator_vessel_id` to enable
  per-operator-vessel push-away tracking.

##### Scenario: fs-watcher attribution

- WHEN the operator edits a file in a watched path during an
  active identity-vessel session
- THEN the emitted `operatorIntervention` MUST carry
  `actor.operator_vessel_id` populated to the session's
  operator-vessel-id.

##### Scenario: anonymous-operator fallback

- WHEN a detection hook fires but the actor's identity-vessel
  session cannot be resolved
- THEN the emission MUST carry `actor.fallback: "anonymous-
  operator"`
- AND the substrate's per-operator-vessel reputation surface MUST
  NOT update for that event.

#### Requirement R6 — Substrate-public-shapes enumeration

- **R6.1** activity-api MUST maintain a static
  `SUBSTRATE_PUBLIC_SHAPES` enumeration in its discovery config
  matching design §C's initial table.
- **R6.2** Each enumerated shape MUST be an advertised shape by
  some substrate vessel. Boot-time validation MUST fail fast on
  missing advertisement.
- **R6.3** Each enumerated shape MUST carry per-shape
  `SubstratePublicContract` metadata:
  `stability ∈ {stable, experimental, deprecated}`,
  `freshness_max_age_s: number | null`,
  `audience[]: AudienceClass[]`,
  `signature_version: number`,
  `authenticity_method ∈ {auth_boundary, h2_signature}`.
- **R6.4** The initial enumeration MUST include at minimum:
  `coverageReport`, `substrateHealthReport`, `closureStatusReport`,
  `interventionRateReport`, `interventionRefused`, `chainStallReport`,
  `heldOutEvalReport`, `adversarialProbeReport`, `ciAgreementReport`,
  `forkOutcome`, `forkPromotion`, `forkRollback`, `proposedSpec`,
  `mergeVerdict`, `recoveryReport`, `liftBlocker`.
- **R6.5** Adding a shape to the enumeration is forward-compatible
  (no supersession needed). Removing a shape requires a
  deprecation cycle: mark `stability: "deprecated"` with a
  populated `successor_shape`; remove in a successor openspec
  change.
- **R6.6** Shapes NOT in the enumeration are substrate-internal
  and MUST NOT be served by the substrate-public-feed (R7).
  Operator may query non-enumerated shapes through standard
  activity-api routes with admin scope; this is NOT under the
  public contract.

##### Scenario: enumeration boot-time validation

- WHEN activity-api boots
- THEN it MUST verify every shape in `SUBSTRATE_PUBLIC_SHAPES` is
  advertised by some substrate vessel (resolvable via discovery)
- AND boot MUST fail fast on missing advertisement.

##### Scenario: non-enumerated shape leak prevention

- WHEN a caller queries `substrate-public-feed` with any
  audience and any scope
- THEN raw `activityExecutionTrace` impulses MUST NOT appear in
  the response, even when the caller has admin scope.

#### Requirement R7 — substrate-public-feed resolver

- **R7.1** A substrate-resident resolver `substrate-public-feed`
  MUST be advertised (default placement: activity-api; alternative:
  development-vessel per closure-binding decision).
- **R7.2** Request contract: `POST /v2/substrate-public-feed/query`
  accepting `audience` (required), `shapes?` (optional filter),
  `since_cursor?` (optional opaque cursor), `limit?` (default 100,
  max 1000), `freshness_check?` (default true).
- **R7.3** The resolver MUST resolve caller audience from the
  caller's vessel record: operator-vessel → `operator`; federated
  peer discovery-vessel → `peer-substrate`; auditor-vessel
  (post-lift) → `auditor`.
- **R7.4** The resolver MUST filter the enumeration to shapes whose
  `audience` includes the caller's class.
- **R7.5** The resolver MUST aggregate per-shape emissions since
  the `since_cursor`, distributing the `limit` across shapes (round-
  robin) to prevent shape starvation.
- **R7.6** Cursors MUST be opaque, HMAC-signed, and monotonic per
  shape.
- **R7.7** Freshness warnings MUST be computed and surfaced per
  emission against the shape's `freshness_max_age_s`.
- **R7.8** Pre-H2: responses MUST NOT carry `_authenticity`
  envelopes; auth boundary is the activity-api JWT. Post-H2:
  responses MUST carry per-emission `_authenticity` envelopes per
  design §D.
- **R7.9** The resolver MUST be closure-bound: `closure-audit
  --without=operator-shell` MUST report zero failures for the
  resolver pipeline.

##### Scenario: operator queries the feed and receives all
operator-audience emissions

- WHEN the operator-vessel POSTs `/v2/substrate-public-feed/query`
  with `audience: "operator"` and no shape filter
- THEN the response MUST include emissions for every operator-
  audience shape that has activity within the window
- AND the response MUST include a non-null `next_cursor` when more
  emissions are available.

##### Scenario: monotonic cursor pagination

- WHEN the operator-vessel polls the feed twice with
  `since_cursor` from the first call's `next_cursor`
- THEN no emission MUST appear in both responses (cursor
  monotonicity invariant).

#### Requirement R8 — Push-away applies to operator-vessel

- **R8.1** The substrate's refusal gates (verify-merge-candidate,
  foundation-compliance, posterior-anomaly-check, scope-narrowing,
  self-deployment-whitelist) MUST operate against any actor,
  including operator-vessels. The refusal mechanism MUST NOT
  branch on `kind`.
- **R8.2** When a gate refuses an operator-emitted impulse, the
  emitted `interventionRefused` MUST carry
  `intervention_attempted.actor.operator_vessel_id` populated.
- **R8.3** `liftStatusConfirmation` emissions are subject to the
  IAL §27.3.d.4 constraint (operator MUST NOT write `status:
  "confirmed"` while `chainStallReport.stall_detected = true`).
  The substrate MUST refuse such an emission with
  `refusal_code: "lift_status_chain_stalled"`.

##### Scenario: foundation-violating operatorGoal is refused

- WHEN the operator-vessel emits an `operatorGoal` whose body
  violates a foundation invariant
- THEN `foundation-compliance` MUST refuse the impulse
- AND the emitted `interventionRefused` MUST carry
  `intervention_attempted.actor.operator_vessel_id` populated.

##### Scenario: liftStatusConfirmation refused under chain stall

- WHEN the most-recent `chainStallReport` has `stall_detected:
  true`
- AND the operator-vessel emits a `liftStatusConfirmation` with
  `status: "confirmed"`
- THEN the impulse MUST be refused with
  `refusal_code: "lift_status_chain_stalled"`
- AND the `interventionRefused` MUST cite the chain-stall report
  in `cited_evidence`.

#### Requirement R9 — Stability and authenticity guarantees

- **R9.1** A `stability: "stable"` shape's body schema is fixed
  at the declared `signature_version`. Field additions MUST be
  forward-compatible (consumers ignore unknown fields). Field
  removals or type changes REQUIRE change-supersession.
- **R9.2** A `stability: "experimental"` shape's body schema MAY
  change without supersession; consumers SHOULD pin
  `signature_version`.
- **R9.3** A `stability: "deprecated"` shape MUST carry
  `successor_shape` pointing to its replacement; consumers SHOULD
  migrate within the deprecation window.
- **R9.4** Pre-H2 authenticity is the activity-api auth boundary
  (the JWT response signature). Post-H2 authenticity is per-
  emission Ed25519 signatures per design §D.
- **R9.5** The pre→post-H2 transition is a `signature_version` bump
  per shape; the feed MUST serve both versions during the
  deprecation window.

#### Requirement R10 — Tests

- **R10.1** Per-resolver test for operator-vessel registration
  (TOFU acceptance, mismatch rejection, multi-operator support).
- **R10.2** Per-shape contract test for each of the ten operator-
  emit shapes pinning the body schema at `signature_version: 1`.
- **R10.3** Confidence-weight defaults test: emit one impulse per
  category; assert weight matches the default table.
- **R10.4** Operator-tunable override test: override one category;
  assert subsequent emission picks up the override.
- **R10.5** Five per-hook attribution tests (one per detection hook
  from `2026-05-23-intervention-tracking` §C).
- **R10.6** Boot-time enumeration validation test.
- **R10.7** Non-enumerated shape leak prevention test.
- **R10.8** Cursor monotonicity test.
- **R10.9** Push-away coverage tests (R8 scenarios).
- **R10.10** Closure-audit test for the
  `bootstrap-operator-vessel` activity AND the
  `substrate-public-feed` resolver.

#### Requirement R11 — Acceptance gates

- **R11.1** Operator-vessel registration: end-to-end TOFU
  acceptance on canary substrate; operator-vessel visible in
  `/registry/stats` with `kind: "operator"`.
- **R11.2** At least one impulse emitted per operator-emit shape
  (10 shapes); each carries correct `signal_confidence_weight` per
  the default table.
- **R11.3** Intervention-tracking attribution: at least one
  emission per detection hook (5 hooks) carries
  `actor.operator_vessel_id` populated (non-fallback).
- **R11.4** Substrate-public-feed query returns the full
  enumerated set when caller is operator-vessel and recent
  activity exists for each shape.
- **R11.5** Non-enumerated shape leak test: feed does NOT return
  raw `activityExecutionTrace` impulses under any audience or
  scope.
- **R11.6** Push-away test: operator-emitted impulse violating a
  gate is refused; refusal cites operator-vessel-id.
- **R11.7** Closure-audit: zero failures for the
  `bootstrap-operator-vessel` activity AND the
  `substrate-public-feed` resolver under
  `closure-audit --without=operator-shell`.
- **R11.8** Cross-reference to IAL §27.S.5 documented in CLAUDE.md
  as the foundational pre-lift primitive for substrate-authored
  post-lift expansion.
