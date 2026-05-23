# Proposal: Operator-as-Vessel and Substrate-Public Contracts

## Why

IAL Phase 27 (`2026-04-26-impulse-activity-loop/tasks.md` §27.S.4 →
§27.S.6) declares the IAL's terminal phase: at S1 → S2 the substrate
lifts from operator-authored to substrate-authored development; on
S2 → S3 the substrate hardens against adversarial conditions and the
operator's load-bearing role decays toward zero. The framing implies
a structural inversion that Phase 27 names but does not encode:
**post-lift, the operator becomes one external system among many that
the substrate models**, and **the substrate publishes its own state
for the operator (and other externals) to consume**.

Today the substrate has all the pieces it needs to apply that framing
recursively to every external system EXCEPT for two categorical primitives:

1. **The operator is not a vessel.** The substrate observes operator
   actions through `2026-05-23-intervention-tracking`'s detection
   hooks, but "the operator" is referenced as an implicit category
   rather than a registered participant with a `vessel_id`, an
   advertised shape contract, and a confidence-weight ancestry. The
   intervention-tracking spec calls out this gap explicitly (its
   "Out of scope" enumerates "automatic operator-identity
   attestation" and defers H2 binding). Without an
   operator-as-vessel registration, the substrate post-lift would
   have to invent the categorical framing before applying it to
   non-operator externals (LLM providers, GitHub, CI, peer
   substrates).
2. **There is no public contract for substrate emissions.** The
   substrate emits `coverageReport`, `substrateHealthReport`,
   `closureStatusReport`, `interventionRateReport`, `chainStallReport`,
   `heldOutEvalReport`, `adversarialProbeReport`, `ciAgreementReport`,
   `forkOutcome`, `proposedSpec`, `liftBlocker`, and others — but
   none of these are formally declared as substrate-public with
   stability, freshness, or authenticity guarantees. External
   consumers (operator, peers, auditors) scrape individual shape
   emissions with no contract telling them which shapes are stable,
   which are versioned, who may consume them, or how to detect
   tampering.

The vessel pattern is already general. What is missing is its
recursive application to the substrate-operator (and substrate-
external) relationship. This change supplies the two missing
primitives:

- **Addition 1 — Operator-as-vessel.** A formal vessel registration
  for the operator with `kind: "operator"`, identity bound to the
  operator's identity-vessel session pubkey via the H2 multihash
  construction (best-effort pre-H2; forward-compatible). The operator
  advertises the shapes it emits (operator-authored impulses) and
  declares the shapes it consumes (substrate emissions). Operator-
  emitted impulses carry confidence weights derived from operator-
  vessel reputation; the substrate learns operator-vessel reputation
  via Thompson on (impulse_category, operator-vessel-id).
- **Addition 2 — Substrate-public contracts.** A formal enumeration
  of which shapes the substrate emits for external consumption, with
  stability / freshness / authenticity guarantees per shape, and a
  `substrate-public-feed` aggregator resolver that external vessels
  query rather than scraping individual shape emissions.

The two ship in one bundled change because they are categorically
paired: the operator-vessel is the canonical consumer of the
substrate-public contract; the substrate-public contract is the
canonical surface the operator-vessel reads. They are the same
inversion viewed from the two sides of the substrate boundary.

The scope pattern matches `2026-05-23-lift-criterion-hardening`: two
related additions in one bundled spec, each independently testable,
both addressing the same structural gap.

## What Changes

### Addition 1 — Operator-as-vessel

1. **Operator-vessel registration**: at substrate boot (or first
   operator session), the substrate registers an `operatorVessel`
   record against discovery-vessel with `kind: "operator"`,
   `vessel_id` derived from the operator's identity-vessel session
   pubkey via the H2 construction (`base32(multihash(SHA-256,
   pubkey))`), and a TOFU acceptance policy for the pubkey. Multi-
   operator deployments register one operator-vessel per operator
   identity (each with a distinct `vessel_id`).
2. **Advertised emit shapes**: the operator-vessel advertises the
   shapes the operator EMITS:
   - `operatorGoal` — goal-shape impulses authored by the operator
   - `operatorIntervention` — already specified by
     `2026-05-23-intervention-tracking`; this spec attributes the
     emission to the operator-vessel categorically
   - `interventionAuditVerdict` — operator audit verdicts on
     substrate refusals
   - `heldOutEvalSetCuration` — operator publishes a new held-out
     set version (per `2026-05-23-lift-criterion-hardening`)
   - `adversarialProbeSetCuration` — operator publishes a new
     adversarial probe set version
   - `foundationComplianceUpdate` — operator updates the validator's
     check list
   - `h5BaselinePromotion` — operator authorizes baseline promotion
   - `federationPeeringAuthorization` — H4 authority-key signature
     for peering establishment
   - `liftStatusConfirmation` — operator writes
     `validation/state/lift-status.json` (status = confirmed |
     reverted)
   - `directionGoal` — strategic direction impulses (new shapes to
     learn, new substrates to deploy)
3. **Advertised consume shapes**: the operator-vessel declares the
   substrate-public shapes it reads (mirror of Addition 2's
   enumeration).
4. **Confidence-weighting defaults**: operator-emitted impulses
   carry confidence weights per impulse category (see Self-application).
5. **Intervention-tracking integration**: the existing
   `operatorIntervention` and `interventionRefused` emission paths
   classify the observed action by `operator_vessel_id` when the
   identity-vessel session attribution is available; fall back to
   `anonymous-operator` when not.

### Addition 2 — Substrate-public contracts

1. **Public-shape enumeration**: the substrate publishes a static
   enumeration of which advertised shapes are substrate-public. The
   initial set (full list in spec R6):
   - Topology & health: `coverageReport`, `substrateHealthReport`,
     `closureStatusReport`
   - Intervention surface: `interventionRateReport`,
     `interventionRefused`, `chainStallReport`
   - Anchor-driven reports: `heldOutEvalReport`,
     `adversarialProbeReport`, `ciAgreementReport`
   - Forge & deployment: `forkOutcome`, `forkPromotion`,
     `forkRollback`
   - Self-deployment: `proposedSpec`, `mergeVerdict`,
     `recoveryReport`
   - Gate-blockers: `liftBlocker` (class)
2. **Per-shape contract metadata**: each public shape carries
   `{stability_class, freshness_max_age_seconds, audience_classes,
   authenticity_method}` declared in activity-api's discovery config.
3. **Authenticity guarantees**: pre-H2, authenticity is the
   activity-api auth boundary (consumer trusts the substrate's
   identity-vessel-issued JWT on the response). Post-H2, public
   emissions are signed via the emitting vessel's H2 key; consumers
   verify against the pubkey resolved through discovery.
4. **The `substrate-public-feed` resolver**: a substrate-resident,
   closure-bound activity (advertised by activity-api or
   development-vessel) that aggregates recent emissions across all
   public shapes. Supports `audience` filtering, incremental polling
   via `last_seen_id` cursor, and per-shape pagination.
5. **Stability versioning**: each public shape's body schema is
   versioned via `signature_version`; breaking changes require a
   new openspec change (the existing change-supersession discipline).
6. **What is NOT public**: raw execution traces, internal validator
   outputs, raw Thompson posteriors, activity-template variant
   internals, and memory notes are substrate-internal. They MAY be
   queried by the operator through the standard activity-api routes
   with admin scope, but they are NOT under the public contract and
   are NOT served by `substrate-public-feed`.

## Self-application

Both additions follow the substrate's existing patterns:

- **Foundation alignment** — operator-vessel registration uses the
  existing discovery-vessel machinery; substrate-public-feed is a
  resolver advertising aggregated shape impulses. No new primitives.
- **Closure** — the operator-vessel registration logic is
  substrate-resident (identity-vessel session → discovery-vessel
  record). The `substrate-public-feed` resolver is substrate-resident
  and closure-bound; `closure-audit --without=operator-shell` covers
  it.
- **Confidence weighting** (per `2026-05-23-signal-confidence-weighting`)
  — operator-emitted impulses carry weights derived from operator-
  vessel reputation. Defaults:
  | Operator-impulse category | Default `signal_confidence_weight` |
  |---|---|
  | `heldOutEvalSetCuration`, `adversarialProbeSetCuration` (external anchors) | 1.0 — operator IS the authority per `lift-criterion-hardening` |
  | `interventionAuditVerdict` | 0.95 — load-bearing for §27.S.6 soundness audit |
  | `federationPeeringAuthorization`, `h5BaselinePromotion` (H4/H5 AUMs) | 1.0 — per H4 authority machinery |
  | `liftStatusConfirmation` | 1.0 — operator IS the hand-over authority per §27.2.1 |
  | `foundationComplianceUpdate` | 0.9 — operator-authored but substrate-checkable against the foundation doc |
  | `operatorGoal` | 0.9 — high but not absolute (operator can make mistakes) |
  | `operatorIntervention` (when classified by detection hook) | per `2026-05-23-intervention-tracking` R7.4 (already 1.0) |
  | `directionGoal` | 0.8 — strategic but easily superseded |

  These are pre-tuning defaults; the substrate learns operator-vessel
  reputation over time via Thompson on `(impulse_category,
  operator_vessel_id)`. Operator-vessel-trust-tuning is a sibling
  spec deferred to substrate-authored post-lift work.
- **Push-away applies recursively** — the substrate may refuse
  operator-vessel-emitted impulses through the same gates that refuse
  other interventions (verify-merge-candidate, foundation-compliance,
  posterior-anomaly-check, scope-narrowing). An operator-emitted
  `operatorGoal` that violates foundation invariants is refused and
  emits an `interventionRefused` impulse with the operator-vessel-id
  in `intervention_attempted.actor`. The operator-vessel framing makes
  push-away categorical: the substrate refuses *vessels*, and the
  operator is one such vessel.
- **Variant-first repair** — fixes to operator-vessel registration or
  substrate-public-feed land as new variants of the seed templates;
  existing templates are not mutated in place.

## Self-application against THIS spec

The proposal/design/spec/tasks files in
`openspec/changes/2026-05-23-operator-and-public-contracts/` are
operator-authored under §27.S.6's "spec authorship the substrate
should have done" classification. The intervention-tracking spec
emits a corresponding `operatorIntervention` against this authorship.
Once the substrate's `propose-spec` activity is operational (per
`2026-05-23-closure-replacement-suite` §B), the substrate may author
a successor spec that supersedes this one; until then, this spec is
operator-authored and the matching intervention is the first datum
of its own operator-vessel corpus.

## Phase 27 binding

This spec is one of the foundational pre-lift primitives §27.S.5
references as enabling substrate-authored post-lift expansion. It is
listed under §27.S.5's **Authenticity** and **Cooperation / coopting
external vessels** rows:

- **Authenticity** — the operator-vessel-id construction inherits
  H2's multihash from the operator's identity-vessel session pubkey;
  post-H2 the construction becomes cryptographically rigorous. The
  pre-H2 form is forward-compatible (`identity_binding_method:
  "session_pubkey_tofu"` → upgrades to `"h2_multihash"` when H2
  lands).
- **Cooperation / coopting external vessels** — the operator-vessel
  is an INSTANCE of the external-system-as-vessel pattern that
  `2026-05-23-external-resolver-vesselization` codifies for non-
  operator externals. Vesselization is the general mechanism; this
  spec instantiates it for the operator as a foundational primitive
  the substrate can extend post-lift to LLM providers, GitHub, CI
  systems, and peer substrates.

No amendment to existing §27.S gates. This spec ships data
primitives (the operator-vessel and the substrate-public-feed) that
the substrate uses post-lift to extend its vessel framework to all
external systems; the lift criterion itself is unchanged.

## What this is NOT

Explicitly out of scope:

- **Specific external-system vessels other than the operator.** This
  spec defines the categorical primitive (operator-as-vessel) and
  the publication primitive (substrate-public-contracts). Vessels
  for Anthropic API, Perplexity, GitHub, CI providers, and peer
  substrates are authored post-lift by the substrate following the
  `2026-05-23-external-resolver-vesselization` mechanism. The
  substrate maintains the full external-system catalog post-lift;
  the operator-vessel is the first instance shipped as a
  foundational primitive.
- **Operator-vessel-trust-tuning.** Thompson on
  `(impulse_category, operator_vessel_id)` reputation is a sibling
  spec. This spec ships the pre-tuning defaults only.
- **Substrate-state-snapshot publication.** A more general
  publication of substrate posterior state, trace summaries, and
  internal metrics for federated peers is a sibling spec. This spec
  publishes only the enumerated public shapes.
- **Operator workflow for setting up the operator-vessel session.**
  The substrate accepts the operator's identity-vessel session on
  first contact (TOFU); the workflow doc for operators is a
  follow-up under `docs/`.
- **Authoritative cryptographic binding of operator identity pre-H2.**
  The pre-H2 form uses the operator's identity-vessel session pubkey
  with TOFU acceptance. Forge-resistant binding lands when H2 ships.
- **`substrate-public-feed` as a federation primitive.** The feed is
  externally consumable but not specifically structured for peer-
  substrate consumption. Federation peering reuses the
  discovery-vessel pubkey path from `2026-05-23-vessel-federation`.

## Capabilities

### New Capabilities

- `operator-and-public-contracts` (this change) — establishes the
  operator-as-vessel registration with H2-derived (best-effort
  pre-H2) identity, advertised emit/consume shape contracts, default
  confidence weights per operator-impulse category, intervention-
  tracking integration; plus the substrate-public-contracts
  enumeration, per-shape stability/freshness/authenticity metadata,
  the `substrate-public-feed` aggregator resolver, and the public-
  vs-internal shape boundary. Spec:
  `specs/operator-and-public-contracts/spec.md`. Two new shapes
  (`operatorVessel`, `substratePublicContract`), one new resolver
  (`substrate-public-feed`), and an attribution amendment in
  intervention-tracking's emission paths.

### Modified Capabilities

- `discovery-vessel` registry gains a `kind: "operator"` registration
  type (existing types: `executor`, `resolver`, `lifecycle-
  subscriber`).
- `2026-05-23-intervention-tracking` emission paths classify the
  observed action by `operator_vessel_id` when available. The
  integration is additive: the existing `operatorIntervention` and
  `interventionRefused` bodies grow an optional
  `actor.operator_vessel_id` field.
- `metabob-activity-api` config gains the public-shape enumeration
  and per-shape contract metadata. No schema change to existing
  shape advertisements; only metadata enrichment.
- IAL Phase 27.S.5's **Authenticity** and **Cooperation** rows
  reference this spec as one of the foundational pre-lift primitives.

## Dependencies

- `2026-05-23-intervention-tracking` (sibling) — defines
  `operatorIntervention` and `interventionRefused` whose bodies this
  spec amends additively. Hard dependency for R5
  (intervention-tracking integration).
- `2026-05-23-signal-confidence-weighting` (sibling) — defines the
  `signal_confidence_weight` field this spec writes per-operator-
  impulse-category defaults into. Soft dependency (the defaults
  document a contract that is operative regardless of whether the
  field is surfaced explicitly).
- `2026-05-23-vessel-federation` — shares the H2 vessel-id
  construction. The operator-vessel applies the same multihash
  formula to the operator's identity-vessel session pubkey. Soft
  dependency: pre-H2 the construction is "best-effort"; post-H2 the
  same code path applies cryptographic rigor.
- `2026-05-23-lift-criterion-hardening` — defines `heldOutEvalReport`,
  `adversarialProbeReport`, `ciAgreementReport`, `chainStallReport`
  consumed by Addition 2's public-shape enumeration. Soft dependency
  (the substrate-public-feed degrades gracefully when these shapes
  are absent).
- `2026-05-23-external-resolver-vesselization` — codifies the
  general external-system-as-vessel pattern this spec instantiates
  for the operator. The operator-vessel is the foundational
  instance; substrate-authored vesselization of other externals
  follows the external-resolver-vesselization machinery. Soft
  dependency (cross-reference only).
- `2026-04-26-security-hardening-findings` §H2 — supplies the
  multihash construction. This spec is forward-compatible with H2:
  pre-H2 uses TOFU; post-H2 uses H2-rigorous binding. Soft
  dependency.
- `2026-05-23-closure-replacement-suite` — establishes
  development-vessel as the meta-vessel for substrate self-
  development. `substrate-public-feed` may be resident in
  development-vessel or activity-api per closure-binding
  convenience; final placement is a tasks.md decision. Soft
  dependency.
- IAL `2026-04-26-impulse-activity-loop/tasks.md` §27.S.5 — names
  this spec as a foundational pre-lift primitive enabling
  substrate-authored post-lift expansion. No amendment to §27.S.5
  itself; this spec fills the categorical-primitive gap §27.S.5
  leaves open.

## Out of scope

- External-system vessels other than the operator (Anthropic API,
  Perplexity, GitHub, CI providers, peer substrates) — substrate
  authors post-lift via external-resolver-vesselization.
- The full external-system catalog (substrate maintains post-lift).
- Operator-vessel-trust-tuning (Thompson on operator-impulse-
  category reputation) — sibling spec deferred.
- Substrate-state-snapshot publication for federation peers —
  sibling spec deferred.
- Hardware-backed or HSM-stored operator keys — out of scope; pre-
  H2 inherits identity-vessel session keys, post-H2 inherits H2's
  key-storage decisions.
- Operator UX for managing operator-vessel session lifecycle
  (rotation, revocation, multi-device) — follow-up operations doc.
- Per-shape signature_version migration paths — when a public
  shape's body schema changes incompatibly, a new openspec change
  defines the migration. This spec ships only the initial
  versioning convention.
